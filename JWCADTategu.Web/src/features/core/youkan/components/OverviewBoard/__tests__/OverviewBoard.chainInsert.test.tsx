import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { OverviewBoard } from '../OverviewBoard';
import type { OverviewItemWrapper } from '../useOverviewItems';
import type { Dependency } from '../../../types';

/**
 * R-094-B: 全体一覧の前後挿入で連続インライン入力UX。
 * タイトルEnter確定→作成行の目安時間欄へ自動フォーカス→目安時間Enter確定→
 * 次の空インライン行へフォーカス、未入力のまま終われば消える、という連鎖を検証する。
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

describe('R-094-B: 全体一覧の連続インライン入力チェーンUX', () => {
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

	it('タイトルEnter確定後、作成行の目安時間欄に自動フォーカスし、次の空インライン行が同時に出現する', async () => {
		const throwIn = vi.fn().mockImplementation(async (_title: string, _tenantId: string, projectId: string) => {
			mockItems = [...mockItems, makeItemWrapper('new-item', projectId)];
			return 'new-item';
		});
		render(<OverviewBoard viewModel={createMockViewModel({ throwIn })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		fireEvent.click(screen.getByText('後に挿入 (b)'));

		const input = await screen.findByPlaceholderText('後に追加...');
		fireEvent.change(input, { target: { value: '新タスク' } });
		fireEvent.keyDown(input, { key: 'Enter' });

		await waitFor(() => expect(throwIn).toHaveBeenCalled());

		const estimateInput = await screen.findByTestId('estimate-input-new-item');
		await waitFor(() => expect(document.activeElement).toBe(estimateInput));

		const nextInsertInput = await screen.findByPlaceholderText('後に追加...');
		expect(nextInsertInput).toBeTruthy();
		expect(document.activeElement).not.toBe(nextInsertInput);
	});

	it('目安時間欄でEnter確定すると保存され、フォーカスが次の空インライン行に移る', async () => {
		const updateItem = vi.fn();
		const throwIn = vi.fn().mockImplementation(async (_title: string, _tenantId: string, projectId: string) => {
			mockItems = [...mockItems, makeItemWrapper('new-item', projectId)];
			return 'new-item';
		});
		render(<OverviewBoard viewModel={createMockViewModel({ throwIn, updateItem })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		fireEvent.click(screen.getByText('後に挿入 (b)'));

		const input = await screen.findByPlaceholderText('後に追加...');
		fireEvent.change(input, { target: { value: '新タスク' } });
		fireEvent.keyDown(input, { key: 'Enter' });

		const estimateInput = await screen.findByTestId('estimate-input-new-item');
		fireEvent.change(estimateInput, { target: { value: '1h' } });
		fireEvent.keyDown(estimateInput, { key: 'Enter' });

		await waitFor(() => expect(updateItem).toHaveBeenCalledWith('new-item', { estimatedMinutes: 60 }));

		const nextInsertInput = await screen.findByPlaceholderText('後に追加...');
		await waitFor(() => expect(document.activeElement).toBe(nextInsertInput));
	});

	it('連鎖で出現した空のインライン行が未入力のままフォーカスを失うと消える', async () => {
		const throwIn = vi.fn().mockImplementation(async (_title: string, _tenantId: string, projectId: string) => {
			mockItems = [...mockItems, makeItemWrapper('new-item', projectId)];
			return 'new-item';
		});
		render(<OverviewBoard viewModel={createMockViewModel({ throwIn })} onOpenItem={vi.fn()} />);
		rightClickItem('item-1');
		fireEvent.click(screen.getByText('後に挿入 (b)'));

		const input = await screen.findByPlaceholderText('後に追加...');
		fireEvent.change(input, { target: { value: '新タスク' } });
		fireEvent.keyDown(input, { key: 'Enter' });

		const estimateInput = await screen.findByTestId('estimate-input-new-item');
		fireEvent.keyDown(estimateInput, { key: 'Enter' });

		const nextInsertInput = await screen.findByPlaceholderText('後に追加...');
		fireEvent.blur(nextInsertInput);

		await waitFor(() => {
			const remaining = screen.queryAllByPlaceholderText('後に追加...');
			expect(remaining.length).toBe(0);
		});
	});
});
