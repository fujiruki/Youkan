import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverviewBoard } from '../OverviewBoard';
import type { OverviewItemWrapper } from '../useOverviewItems';
import type { Dependency } from '../../../types';

/**
 * R-092: 全体一覧の右クリックメニューに「前に挿入 (a)」「後に挿入 (b)」を追加する。
 * 既存の項目（プロジェクト化/今日やる/とりかかる/保留/いつかやる/待機/完了にする/アーカイブ/ゴミ箱）は
 * すべて維持したまま統合する（発注者確認済み）。前/後挿入では R-084 相当の依存関係自動繋ぎ直しも行う。
 */

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

vi.mock('../../Inputs/QuickInputWidget', () => ({
	QuickInputWidget: ({ placeholder }: any) => (
		<input data-testid="quick-input" placeholder={placeholder} />
	)
}));

vi.mock('../../../contexts/FilterContext', () => ({
	useFilter: () => ({ filterMode: 'all', setFilterMode: vi.fn(), hideCompleted: false, setHideCompleted: vi.fn() })
}));

vi.mock('../../../../auth/providers/AuthProvider', () => ({
	useAuth: () => ({ joinedTenants: [] })
}));

let mockItems: OverviewItemWrapper[] = [];
vi.mock('../useOverviewItems', () => ({
	useOverviewItems: () => mockItems
}));

const makeProject = (id: string) => ({
	id,
	title: `Project ${id}`,
	isProject: true,
	type: 'project',
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
	tenantId: 'tenant-1',
});

const makeItemWrapper = (id: string, projectId: string, depth = 1): OverviewItemWrapper => ({
	id,
	type: 'item',
	item: {
		id,
		title: `Item ${id}`,
		status: 'inbox',
		focusOrder: 0,
		isEngaged: false,
		statusUpdatedAt: 0,
		interrupt: false,
		weight: 2,
		parentId: null,
		projectId,
		tenantId: 'tenant-1',
		createdAt: 1000,
		updatedAt: 0,
		memo: '',
		due_date: '',
		flags: {},
	},
	project: makeProject(projectId) as any,
	depth,
});

const makeHeaderWrapper = (projectId: string, depth = 0): OverviewItemWrapper => ({
	id: `header-${projectId}`,
	type: 'header',
	projectId,
	projectTitle: `Project ${projectId}`,
	project: makeProject(projectId) as any,
	depth,
});

const makeDependency = (id: string, sourceItemId: string, targetItemId: string): Dependency => ({
	id,
	sourceItemId,
	targetItemId,
	createdAt: 0,
});

const createMockViewModel = (overrides: Record<string, any> = {}) => ({
	gdbActive: [],
	gdbPreparation: [],
	gdbIntent: [],
	gdbLog: [],
	allProjects: [],
	joinedTenants: [],
	deleteItem: vi.fn(),
	updateItem: vi.fn(),
	projectizeItem: vi.fn(),
	resolveDecision: vi.fn(),
	setEngaged: vi.fn(),
	moveToSomeday: vi.fn(),
	archiveItem: vi.fn(),
	throwIn: vi.fn(),
	todayCandidates: [],
	todayCommits: [],
	...overrides,
});

const rightClickItem = (itemId: string) => {
	const row = screen.getByText(`Item ${itemId}`);
	fireEvent.contextMenu(row);
};

describe('R-092: OverviewBoard 右クリックメニュー（ガント同等）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockItems = [
			makeHeaderWrapper('proj-1'),
			makeItemWrapper('item-1', 'proj-1'),
		];
		mockGetDependencies.mockResolvedValue([]);
		mockCreateDependency.mockImplementation(async (sourceItemId: string, targetItemId: string) =>
			makeDependency(`new-${sourceItemId}-${targetItemId}`, sourceItemId, targetItemId)
		);
		mockDeleteDependency.mockResolvedValue(undefined);
	});

	it('既存項目を維持したまま前後挿入が追加されたメニューが表示される', () => {
		render(<OverviewBoard viewModel={createMockViewModel()} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');

		// 既存項目（維持）
		expect(screen.getByText('プロジェクト化')).toBeInTheDocument();
		expect(screen.getByText('今日やる (Focus)')).toBeInTheDocument();
		expect(screen.getByText('とりかかる (Execute)')).toBeInTheDocument();
		expect(screen.getByText('保留（外的要因待ち）(Pending)')).toBeInTheDocument();
		expect(screen.getByText('💭 いつかやる (Someday)')).toBeInTheDocument();
		expect(screen.getByText('待機 (Waiting)')).toBeInTheDocument();
		expect(screen.getByText('完了にする (d)')).toBeInTheDocument();
		expect(screen.getByText('アーカイブ')).toBeInTheDocument();
		expect(screen.getByText('ゴミ箱 (Del)')).toBeInTheDocument();
		// 新規追加項目
		expect(screen.getByText('前に挿入 (a)')).toBeInTheDocument();
		expect(screen.getByText('後に挿入 (b)')).toBeInTheDocument();
	});

	it('「いつかやる」クリックで moveToSomeday が呼ばれる（既存機能の回帰なし）', () => {
		const moveToSomeday = vi.fn();
		render(<OverviewBoard viewModel={createMockViewModel({ moveToSomeday })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		fireEvent.click(screen.getByText('💭 いつかやる (Someday)'));
		expect(moveToSomeday).toHaveBeenCalledWith('item-1');
	});

	it('「アーカイブ」クリックで archiveItem が呼ばれる（既存機能の回帰なし）', () => {
		const archiveItem = vi.fn();
		render(<OverviewBoard viewModel={createMockViewModel({ archiveItem })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		fireEvent.click(screen.getByText('アーカイブ'));
		expect(archiveItem).toHaveBeenCalledWith('item-1');
	});

	it('「完了にする」クリックで status: done に更新される', () => {
		const updateItem = vi.fn();
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		fireEvent.click(screen.getByText('完了にする (d)'));
		expect(updateItem).toHaveBeenCalledWith('item-1', { status: 'done' });
	});

	it('「ゴミ箱」クリックで deleteItem が呼ばれる', () => {
		const deleteItem = vi.fn();
		render(<OverviewBoard viewModel={createMockViewModel({ deleteItem })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		fireEvent.click(screen.getByText('ゴミ箱 (Del)'));
		expect(deleteItem).toHaveBeenCalledWith('item-1');
	});

	it('メニューを閉じた後もDeleteキーで直前右クリックしたアイテムを削除できる（既存動作の回帰なし）', () => {
		const deleteItem = vi.fn();
		render(<OverviewBoard viewModel={createMockViewModel({ deleteItem })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		// メニュー外をクリックして閉じる
		fireEvent.mouseDown(document.body);
		fireEvent.keyDown(window, { key: 'Delete' });
		expect(deleteItem).toHaveBeenCalledWith('item-1');
	});

	it('「後に挿入」でインライン入力が出現し、Enterで throwIn が呼ばれ依存関係が1本作成される', async () => {
		const throwIn = vi.fn().mockResolvedValue('new-item');
		render(<OverviewBoard viewModel={createMockViewModel({ throwIn })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		fireEvent.click(screen.getByText('後に挿入 (b)'));

		const input = await screen.findByPlaceholderText('後に追加...');
		fireEvent.change(input, { target: { value: '新タスク' } });
		fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => expect(throwIn).toHaveBeenCalledWith('新タスク', 'tenant-1', 'proj-1'));
		await waitFor(() => expect(mockCreateDependency).toHaveBeenCalledWith('item-1', 'new-item'));
		expect(mockDeleteDependency).not.toHaveBeenCalled();
	});

	it('「前に挿入」でインライン入力が出現し、Enterで throwIn が呼ばれ依存関係が1本作成される', async () => {
		const throwIn = vi.fn().mockResolvedValue('new-item');
		render(<OverviewBoard viewModel={createMockViewModel({ throwIn })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		fireEvent.click(screen.getByText('前に挿入 (a)'));

		const input = await screen.findByPlaceholderText('前に追加...');
		fireEvent.change(input, { target: { value: '新タスクX' } });
		fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => expect(throwIn).toHaveBeenCalledWith('新タスクX', 'tenant-1', 'proj-1'));
		await waitFor(() => expect(mockCreateDependency).toHaveBeenCalledWith('new-item', 'item-1'));
		expect(mockDeleteDependency).not.toHaveBeenCalled();
	});

	it('R-095: メニュー内の全ボタンにonClickとラベルがある（separatorがボタン化しない）', () => {
		render(<OverviewBoard viewModel={createMockViewModel()} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');

		const menuButtons = screen.getAllByRole('button');
		expect(menuButtons.length).toBeGreaterThan(0);
		menuButtons.forEach((button) => {
			expect(button.textContent?.trim()).not.toBe('');
		});
	});

	it('R-095: 旧separator位置に隣接する項目（今日やる/アーカイブ）をクリックしても例外が発生しない', () => {
		const updateItem = vi.fn();
		const archiveItem = vi.fn();
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem, archiveItem })} onOpenItem={vi.fn()} />);

		rightClickItem('item-1');
		expect(() => fireEvent.click(screen.getByText('今日やる (Focus)'))).not.toThrow();
		expect(updateItem).toHaveBeenCalledWith('item-1', { status: 'focus' });

		rightClickItem('item-1');
		expect(() => fireEvent.click(screen.getByText('アーカイブ'))).not.toThrow();
		expect(archiveItem).toHaveBeenCalledWith('item-1');
	});

	it('要望原文の例: A→B→C の状態でBの後にDを挿入すると A→B, B→D, D→C になる（R-084相当）', async () => {
		mockItems = [
			makeHeaderWrapper('proj-1'),
			makeItemWrapper('A', 'proj-1'),
			makeItemWrapper('B', 'proj-1'),
			makeItemWrapper('C', 'proj-1'),
		];
		mockGetDependencies.mockResolvedValue([
			makeDependency('dep-ab', 'A', 'B'),
			makeDependency('dep-bc', 'B', 'C'),
		]);
		const throwIn = vi.fn().mockResolvedValue('D');
		render(<OverviewBoard viewModel={createMockViewModel({ throwIn })} onOpenItem={vi.fn()} />);
		rightClickItem('B');
		fireEvent.click(screen.getByText('後に挿入 (b)'));

		const input = await screen.findByPlaceholderText('後に追加...');
		fireEvent.change(input, { target: { value: '新タスクD' } });
		fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => expect(throwIn).toHaveBeenCalled());
		await waitFor(() => expect(mockDeleteDependency).toHaveBeenCalledWith('dep-bc'));
		expect(mockCreateDependency).toHaveBeenCalledWith('D', 'C');
		expect(mockCreateDependency).toHaveBeenCalledWith('B', 'D');
		expect(mockDeleteDependency).not.toHaveBeenCalledWith('dep-ab');
	});
});
