import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
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
 * R-084: ガント「前に挿入」「後に挿入」で依存関係も自動的に繋ぎ直すテスト
 */

const renderWithProviders = (ui: React.ReactElement) =>
	render(<ToastProvider>{ui}</ToastProvider>);

const makeAllDays = (): Date[] => {
	const days: Date[] = [];
	for (let d = 1; d <= 31; d++) {
		days.push(new Date(2026, 2, d));
	}
	return days;
};

const makeItem = (id: string, title: string): Item => ({
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
});

const makeDependency = (id: string, sourceItemId: string, targetItemId: string): Dependency => ({
	id,
	sourceItemId,
	targetItemId,
	createdAt: 0,
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

/** 対象アイテムのタイトルセルで右クリック→挿入メニュークリック→タイトル入力→Enterまでを実施する */
const performInlineInsert = async (
	sourceItemId: string,
	position: 'before' | 'after',
	newTitle: string
) => {
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

describe('R-084: ガント挿入時の依存関係自動繋ぎ直し', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockCreateDependency.mockImplementation(async (sourceItemId: string, targetItemId: string) =>
			makeDependency(`new-${sourceItemId}-${targetItemId}`, sourceItemId, targetItemId)
		);
		mockDeleteDependency.mockResolvedValue(undefined);
	});

	it('依存関係が無い場合、「後に挿入」は source→new の依存を1本作成するだけ', async () => {
		mockGetDependencies.mockResolvedValue([]);
		const items = [makeItem('A', 'タスクA')];
		const onCreateItem = vi.fn().mockResolvedValue('D');

		renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onCreateItem={onCreateItem} onReloadItems={vi.fn()} />
		);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await performInlineInsert('A', 'after', '新タスクD');

		await waitFor(() => expect(onCreateItem).toHaveBeenCalled());
		await waitFor(() => expect(mockCreateDependency).toHaveBeenCalledTimes(1));
		expect(mockCreateDependency).toHaveBeenCalledWith('A', 'D');
		expect(mockDeleteDependency).not.toHaveBeenCalled();
	});

	it('依存関係が無い場合、「前に挿入」は new→source の依存を1本作成するだけ', async () => {
		mockGetDependencies.mockResolvedValue([]);
		const items = [makeItem('A', 'タスクA')];
		const onCreateItem = vi.fn().mockResolvedValue('X');

		renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onCreateItem={onCreateItem} onReloadItems={vi.fn()} />
		);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await performInlineInsert('A', 'before', '新タスクX');

		await waitFor(() => expect(onCreateItem).toHaveBeenCalled());
		await waitFor(() => expect(mockCreateDependency).toHaveBeenCalledTimes(1));
		expect(mockCreateDependency).toHaveBeenCalledWith('X', 'A');
		expect(mockDeleteDependency).not.toHaveBeenCalled();
	});

	it('要望原文の例: A→B→C の状態でBの後にDを挿入すると A→B, B→D, D→C になる', async () => {
		const depBC = makeDependency('dep-bc', 'B', 'C');
		mockGetDependencies.mockResolvedValue([
			makeDependency('dep-ab', 'A', 'B'),
			depBC,
		]);
		const items = [makeItem('A', 'タスクA'), makeItem('B', 'タスクB'), makeItem('C', 'タスクC')];
		const onCreateItem = vi.fn().mockResolvedValue('D');

		renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onCreateItem={onCreateItem} onReloadItems={vi.fn()} />
		);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await performInlineInsert('B', 'after', '新タスクD');

		await waitFor(() => expect(onCreateItem).toHaveBeenCalled());
		await waitFor(() => expect(mockDeleteDependency).toHaveBeenCalledWith('dep-bc'));
		expect(mockCreateDependency).toHaveBeenCalledWith('D', 'C');
		expect(mockCreateDependency).toHaveBeenCalledWith('B', 'D');
		// A→B は一切触られない
		expect(mockDeleteDependency).not.toHaveBeenCalledWith('dep-ab');
	});

	it('A→B→C の状態でBの前にXを挿入すると A→X, X→B, B→C になる', async () => {
		const depAB = makeDependency('dep-ab', 'A', 'B');
		mockGetDependencies.mockResolvedValue([
			depAB,
			makeDependency('dep-bc', 'B', 'C'),
		]);
		const items = [makeItem('A', 'タスクA'), makeItem('B', 'タスクB'), makeItem('C', 'タスクC')];
		const onCreateItem = vi.fn().mockResolvedValue('X');

		renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onCreateItem={onCreateItem} onReloadItems={vi.fn()} />
		);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await performInlineInsert('B', 'before', '新タスクX');

		await waitFor(() => expect(onCreateItem).toHaveBeenCalled());
		await waitFor(() => expect(mockDeleteDependency).toHaveBeenCalledWith('dep-ab'));
		expect(mockCreateDependency).toHaveBeenCalledWith('A', 'X');
		expect(mockCreateDependency).toHaveBeenCalledWith('X', 'B');
		// B→C は一切触られない
		expect(mockDeleteDependency).not.toHaveBeenCalledWith('dep-bc');
	});

	it('分岐がある場合（B→C, B→E）、Bの後にDを挿入すると両方が新規アイテム経由に繋ぎ変わる', async () => {
		mockGetDependencies.mockResolvedValue([
			makeDependency('dep-bc', 'B', 'C'),
			makeDependency('dep-be', 'B', 'E'),
		]);
		const items = [makeItem('B', 'タスクB'), makeItem('C', 'タスクC'), makeItem('E', 'タスクE')];
		const onCreateItem = vi.fn().mockResolvedValue('D');

		renderWithProviders(
			<RyokanGanttView {...defaultProps} items={items} onCreateItem={onCreateItem} onReloadItems={vi.fn()} />
		);

		await waitFor(() => expect(mockGetDependencies).toHaveBeenCalled());
		await performInlineInsert('B', 'after', '新タスクD');

		await waitFor(() => expect(onCreateItem).toHaveBeenCalled());
		await waitFor(() => expect(mockDeleteDependency).toHaveBeenCalledTimes(2));
		expect(mockDeleteDependency).toHaveBeenCalledWith('dep-bc');
		expect(mockDeleteDependency).toHaveBeenCalledWith('dep-be');
		expect(mockCreateDependency).toHaveBeenCalledWith('D', 'C');
		expect(mockCreateDependency).toHaveBeenCalledWith('D', 'E');
		expect(mockCreateDependency).toHaveBeenCalledWith('B', 'D');
	});
});
