import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React, { useCallback, useState } from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { Item, Dependency } from '../../../types';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

const mockGetDependencies = vi.fn();
const mockCreateDependency = vi.fn();
const mockDeleteDependency = vi.fn();

vi.mock('../../../repositories/DependencyRepository', () => ({
	DependencyRepository: vi.fn().mockImplementation(function (this: any) {
		this.getDependencies = mockGetDependencies;
		this.createDependency = mockCreateDependency;
		this.deleteDependency = mockDeleteDependency;
	}),
}));

vi.mock('../../../../../../api/client', () => ({
	ApiClient: {
		reorderItems: vi.fn().mockResolvedValue(undefined),
	},
}));

/**
 * R-094-A: ガントの前後挿入で連続インライン入力UX
 *
 * タイトル確定→目安時間欄フォーカス→確定→次のインライン行フォーカス→未入力なら消える、
 * の一連の流れを検証する。
 *
 * items propは親から渡される制御下にあるため、実際のアプリと同じく
 * onCreateItem完了後にitems propが更新されて初めて新規行がDOMへ現れる。
 * この非同期の間合いを再現するため、items stateを自前で持つラッパーで検証する。
 */

const renderWithProviders = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

const makeAllDays = (): Date[] => {
	const days: Date[] = [];
	for (let d = 1; d <= 31; d++) days.push(new Date(2026, 2, d));
	return days;
};

const makeItem = (id: string, title: string, estimatedMinutes = 0): Item => ({
	id,
	title,
	status: 'inbox',
	focusOrder: 0,
	isEngaged: false,
	statusUpdatedAt: 0,
	interrupt: false,
	weight: 2,
	parentId: null,
	projectId: null,
	createdAt: 0,
	updatedAt: 0,
	memo: '',
	due_date: '',
	flags: {},
	estimatedMinutes,
});

const defaultProps = {
	allDays: makeAllDays(),
	heatMap: new Map(),
	today: new Date(2026, 2, 15),
	safeConfig: {},
	rowHeight: 40,
	renderItemTitle: (item: Item) => item.title,
	projects: [],
	showGroups: false,
};

const performInlineInsert = async (sourceItemId: string, position: 'before' | 'after', newTitle: string) => {
	const titleCell = screen.getByTestId(`gantt-title-cell-${sourceItemId}`);
	fireEvent.contextMenu(titleCell);

	const menuLabel = position === 'before' ? '前に挿入 (a)' : '後に挿入 (b)';
	const menuButton = await screen.findByText(menuLabel);
	fireEvent.click(menuButton);

	const placeholder = position === 'before' ? '前に追加...' : '後に追加...';
	const input = await screen.findByPlaceholderText(placeholder);
	fireEvent.change(input, { target: { value: newTitle } });
	fireEvent.keyDown(input, { key: 'Enter' });
};

/** onCreateItem完了→items反映(=擬似的なonReloadItems)までを行うテスト用ホスト */
const ChainTestHost: React.FC<{
	onCreateItemSpy: ReturnType<typeof vi.fn>;
	onUpdateItemSpy: ReturnType<typeof vi.fn>;
}> = ({ onCreateItemSpy, onUpdateItemSpy }) => {
	const [items, setItems] = useState<Item[]>([makeItem('A', 'タスクA')]);
	let counter = 0;

	const onCreateItem = useCallback(async (partial: Partial<Item>) => {
		counter += 1;
		const newId = `new-${counter}`;
		onCreateItemSpy(partial);
		setItems((prev) => [...prev, makeItem(newId, partial.title as string, 0)]);
		return newId;
	}, [onCreateItemSpy]);

	const onUpdateItem = useCallback(async (id: string, updates: Partial<Item>) => {
		onUpdateItemSpy(id, updates);
		setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...updates } : i)));
	}, [onUpdateItemSpy]);

	return (
		<RyokanGanttView
			{...defaultProps}
			items={items}
			onCreateItem={onCreateItem}
			onUpdateItem={onUpdateItem}
			onReloadItems={vi.fn()}
		/>
	);
};

describe('R-094-A: ガントの前後挿入で連続インライン入力UX', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockGetDependencies.mockResolvedValue([]);
		mockCreateDependency.mockImplementation(async (sourceItemId: string, targetItemId: string) => ({
			id: `new-dep-${sourceItemId}-${targetItemId}`,
			sourceItemId,
			targetItemId,
			createdAt: 0,
		}) as Dependency);
		mockDeleteDependency.mockResolvedValue(undefined);
	});

	it('タイトル確定後、作成行の目安時間欄にフォーカスし、同時に次の空インライン行が出現する', async () => {
		const onCreateItemSpy = vi.fn();
		const onUpdateItemSpy = vi.fn();
		renderWithProviders(<ChainTestHost onCreateItemSpy={onCreateItemSpy} onUpdateItemSpy={onUpdateItemSpy} />);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await performInlineInsert('A', 'after', '新タスクD');

		await waitFor(() => expect(onCreateItemSpy).toHaveBeenCalled());

		// 作成された行(new-1)の目安時間欄が編集状態でフォーカスされている
		await waitFor(() => {
			const timeInput = screen.getByPlaceholderText('1h') as HTMLInputElement;
			expect(document.activeElement).toBe(timeInput);
		});

		// 同時に、続きの挿入位置(new-1の後)に空のインライン行(タイトル欄)が出現している
		const nextInlineInput = screen.getByPlaceholderText('後に追加...') as HTMLInputElement;
		expect(nextInlineInput.value).toBe('');
	});

	it('目安時間欄でEnter確定すると保存され、フォーカスが次のインライン行(タイトル欄)へ移る', async () => {
		const onCreateItemSpy = vi.fn();
		const onUpdateItemSpy = vi.fn();
		renderWithProviders(<ChainTestHost onCreateItemSpy={onCreateItemSpy} onUpdateItemSpy={onUpdateItemSpy} />);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await performInlineInsert('A', 'after', '新タスクD');

		const timeInput = await screen.findByPlaceholderText('1h') as HTMLInputElement;
		fireEvent.change(timeInput, { target: { value: '2h' } });
		fireEvent.keyDown(timeInput, { key: 'Enter' });

		await waitFor(() => expect(onUpdateItemSpy).toHaveBeenCalledWith('new-1', { estimatedMinutes: 120 }));

		await waitFor(() => {
			const nextInlineInput = screen.getByPlaceholderText('後に追加...') as HTMLInputElement;
			expect(document.activeElement).toBe(nextInlineInput);
		});
	});

	it('連続作成後、次のインライン行に何も入力せず離脱すると保存されず消える', async () => {
		const onCreateItemSpy = vi.fn();
		const onUpdateItemSpy = vi.fn();
		renderWithProviders(<ChainTestHost onCreateItemSpy={onCreateItemSpy} onUpdateItemSpy={onUpdateItemSpy} />);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await performInlineInsert('A', 'after', '新タスクD');

		const timeInput = await screen.findByPlaceholderText('1h') as HTMLInputElement;
		fireEvent.change(timeInput, { target: { value: '2h' } });
		fireEvent.keyDown(timeInput, { key: 'Enter' });

		const nextInlineInput = await screen.findByPlaceholderText('後に追加...') as HTMLInputElement;
		expect(nextInlineInput.value).toBe('');

		fireEvent.blur(nextInlineInput);

		await waitFor(() => {
			expect(screen.queryByPlaceholderText('後に追加...')).not.toBeInTheDocument();
		});
		// 2回目のonCreateItem(空タイトルでの保存)は発生しない
		expect(onCreateItemSpy).toHaveBeenCalledTimes(1);
	});
});
