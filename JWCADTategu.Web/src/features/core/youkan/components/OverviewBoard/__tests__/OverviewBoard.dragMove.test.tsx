import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { OverviewBoard } from '../OverviewBoard';
import type { OverviewItemWrapper } from '../useOverviewItems';

/**
 * R-155: 全体一覧ドラッグでプロジェクト移動。
 * @dnd-kit/core の実際のポインタ操作はjsdomでの再現が難しいため、
 * DndContext/useDraggable/useDroppableをモックしてonDragStart/onDragEndを
 * 直接呼び出す方式でテストする（PanoramaBoard等、既存のDnDコンポーネントにも
 * ジェスチャーレベルのテストは存在せず、本テストではロジックの結線を検証する）。
 * docs/SPEC/09_全体一覧ドラッグでプロジェクト移動.md §12 を正とする。
 */

let capturedOnDragStart: ((e: any) => void) | null = null;
let capturedOnDragEnd: ((e: any) => Promise<void> | void) | null = null;
let capturedOnDragOver: ((e: any) => void) | null = null;
const droppableDisabledById: Record<string, boolean> = {};

vi.mock('@dnd-kit/core', () => ({
	DndContext: ({ children, onDragStart, onDragEnd, onDragOver }: any) => {
		capturedOnDragStart = onDragStart;
		capturedOnDragEnd = onDragEnd;
		capturedOnDragOver = onDragOver;
		return children;
	},
	DragOverlay: ({ children }: any) => children ?? null,
	useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => { }, isDragging: false }),
	useDroppable: ({ id, disabled }: any) => {
		droppableDisabledById[id] = !!disabled;
		return { setNodeRef: () => { }, isOver: false };
	},
	useSensor: () => ({}),
	useSensors: () => [],
	PointerSensor: function PointerSensor() { },
	KeyboardSensor: function KeyboardSensor() { },
	pointerWithin: () => null,
}));

vi.mock('@dnd-kit/sortable', () => ({
	sortableKeyboardCoordinates: () => null,
}));

const mockShowToast = vi.fn();
vi.mock('../../../../../../contexts/ToastContext', () => ({
	useToast: () => ({ showToast: mockShowToast, toasts: [], dismissToast: vi.fn() }),
}));

vi.mock('../../../repositories/DependencyRepository', () => ({
	DependencyRepository: vi.fn().mockImplementation(function (this: any) {
		this.getDependencies = vi.fn().mockResolvedValue([]);
		this.createDependency = vi.fn();
		this.deleteDependency = vi.fn();
	}),
}));

vi.mock('../../Inputs/QuickInputWidget', () => ({
	QuickInputWidget: () => null,
}));

vi.mock('../../../contexts/FilterContext', () => ({
	useFilter: () => ({ filterMode: 'all', setFilterMode: vi.fn(), hideCompleted: false, setHideCompleted: vi.fn() }),
}));

vi.mock('../../../../auth/providers/AuthProvider', () => ({
	useAuth: () => ({ joinedTenants: [] }),
}));

let mockItems: OverviewItemWrapper[] = [];
vi.mock('../useOverviewItems', () => ({
	useOverviewItems: () => mockItems,
}));

const makeProject = (id: string, overrides: Record<string, any> = {}) => ({
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
	isArchived: false,
	...overrides,
});

const makeItemWrapper = (id: string, projectId: string | null, overrides: Record<string, any> = {}, depth = 1): OverviewItemWrapper => ({
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
		estimatedMinutes: 45,
		assignedTo: 'member-9',
		flags: {},
		...overrides,
	},
	project: projectId ? (makeProject(projectId) as any) : null,
	depth,
});

const makeHeaderWrapper = (project: ReturnType<typeof makeProject>, depth = 0): OverviewItemWrapper => ({
	id: `header-${project.id}`,
	type: 'header',
	projectId: project.id,
	projectTitle: project.title,
	project: project as any,
	depth,
});

const createMockViewModel = (overrides: Record<string, any> = {}) => ({
	gdbActive: [],
	gdbPreparation: [],
	gdbIntent: [],
	gdbLog: [],
	allProjects: [],
	joinedTenants: [],
	deleteItem: vi.fn(),
	updateItem: vi.fn().mockResolvedValue({ success: true }),
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

const dragStart = async (activeId: string) => {
	await act(async () => {
		capturedOnDragStart?.({ active: { id: activeId } });
	});
};

const dragEnd = async (activeId: string, overId: string | null) => {
	await act(async () => {
		await capturedOnDragEnd?.({ active: { id: activeId }, over: overId ? { id: overId } : null });
	});
};

const dragOver = async (activeId: string, overId: string | null) => {
	await act(async () => {
		capturedOnDragOver?.({ active: { id: activeId }, over: overId ? { id: overId } : null });
	});
};

describe('R-155: OverviewBoard ドラッグでプロジェクト移動', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockShowToast.mockClear();
		Object.keys(droppableDisabledById).forEach(k => delete droppableDisabledById[k]);
		capturedOnDragStart = null;
		capturedOnDragEnd = null;
		capturedOnDragOver = null;
	});

	it('タスクを別ルートプロジェクトへ移動する: updateItemにprojectId/parentId:nullのみ渡る', async () => {
		const projA = makeProject('proj-A');
		const projB = makeProject('proj-B');
		mockItems = [
			makeHeaderWrapper(projA),
			makeItemWrapper('task-1', 'proj-A'),
			makeHeaderWrapper(projB),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'header-proj-B');

		expect(updateItem).toHaveBeenCalledWith('task-1', { projectId: 'proj-B', parentId: null });
	});

	it('タスクをサブプロジェクトへ移動する: parentId=サブプロジェクト, projectId=ルート案件ID', async () => {
		const root = makeProject('root-1');
		const sub = makeProject('sub-1', { parentId: 'root-1' });
		mockItems = [
			makeHeaderWrapper(root),
			makeItemWrapper('task-1', 'root-1'),
			makeHeaderWrapper(sub, 1),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'header-sub-1');

		expect(updateItem).toHaveBeenCalledWith('task-1', { parentId: 'sub-1', projectId: 'root-1' });
	});

	it('タスクをBeaver work_packageへ移動する: parentId=work_package, projectId=案件ルートID', async () => {
		const beaverRoot = makeProject('beaver-root');
		const workPackage = makeProject('wp-1', { parentId: null, projectId: 'beaver-root' });
		mockItems = [
			makeHeaderWrapper(beaverRoot),
			makeItemWrapper('task-1', null),
			makeHeaderWrapper(workPackage, 1),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'header-wp-1');

		expect(updateItem).toHaveBeenCalledWith('task-1', { parentId: 'wp-1', projectId: 'beaver-root' });
	});

	it('多階層サブプロジェクトで、ドロップした階層だけが対象になる（親子混同なし）', async () => {
		const root = makeProject('root-1');
		const mid = makeProject('mid-1', { parentId: 'root-1' });
		const leaf = makeProject('leaf-1', { parentId: 'mid-1' });
		mockItems = [
			makeHeaderWrapper(root),
			makeItemWrapper('task-1', 'root-1'),
			makeHeaderWrapper(mid, 1),
			makeHeaderWrapper(leaf, 2),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'header-mid-1');
		expect(updateItem).toHaveBeenLastCalledWith('task-1', { parentId: 'mid-1', projectId: 'root-1' });

		updateItem.mockClear();
		await dragEnd('task-1', 'header-leaf-1');
		expect(updateItem).toHaveBeenLastCalledWith('task-1', { parentId: 'leaf-1', projectId: 'root-1' });

		updateItem.mockClear();
		await dragEnd('task-1', 'header-root-1');
		expect(updateItem).toHaveBeenLastCalledWith('task-1', { projectId: 'root-1', parentId: null });
	});

	it('ドロップ後、工数・担当等の他フィールドはupdateItemに渡されない（projectId/parentIdのみ）', async () => {
		const projA = makeProject('proj-A');
		const projB = makeProject('proj-B');
		mockItems = [
			makeHeaderWrapper(projA),
			makeItemWrapper('task-1', 'proj-A', { estimatedMinutes: 120, assignedTo: 'someone', status: 'focus', due_date: '2026-09-01' }),
			makeHeaderWrapper(projB),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'header-proj-B');

		expect(updateItem).toHaveBeenCalledTimes(1);
		const payload = updateItem.mock.calls[0][1];
		expect(Object.keys(payload).sort()).toEqual(['parentId', 'projectId']);
	});

	it('自分の子孫へのdropはhover時にdisabled、drop確定時もupdateItemを呼ばない', async () => {
		const parentTask = makeItemWrapper('parent-task', null);
		const childProjectRaw = makeProject('child-proj', { parentId: 'parent-task' });
		mockItems = [
			parentTask,
			makeHeaderWrapper(childProjectRaw, 1),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragStart('parent-task');
		expect(droppableDisabledById['header-child-proj']).toBe(true);

		await dragEnd('parent-task', 'header-child-proj');
		expect(updateItem).not.toHaveBeenCalled();
	});

	it('テナントが異なるheaderへのdropはhover時にdisabled、drop確定時もupdateItemを呼ばない', async () => {
		const projSameTenant = makeProject('proj-same', { tenantId: 'tenant-1' });
		const projOtherTenant = makeProject('proj-other', { tenantId: 'tenant-2' });
		mockItems = [
			makeHeaderWrapper(projSameTenant),
			makeItemWrapper('task-1', 'proj-same', { tenantId: 'tenant-1' }),
			makeHeaderWrapper(projOtherTenant),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragStart('task-1');
		expect(droppableDisabledById['header-proj-other']).toBe(true);

		await dragEnd('task-1', 'header-proj-other');
		expect(updateItem).not.toHaveBeenCalled();
	});

	it('自分自身へのdropはdisabled扱いになる（プロジェクト化されたタスクが自分自身のheaderとして存在するケース）', async () => {
		const selfProjectized = makeProject('self-1');
		mockItems = [
			makeItemWrapper('self-1', null, { isProject: true }),
			makeHeaderWrapper(selfProjectized),
		];
		render(<OverviewBoard viewModel={createMockViewModel()} onOpenItem={vi.fn()} />);

		await dragStart('self-1');
		expect(droppableDisabledById['header-self-1']).toBe(true);
	});

	it('アーカイブ済みheaderへのdropはdisabled扱いになる', async () => {
		const projA = makeProject('proj-A');
		const archived = makeProject('proj-archived', { isArchived: true });
		mockItems = [
			makeHeaderWrapper(projA),
			makeItemWrapper('task-1', 'proj-A'),
			makeHeaderWrapper(archived),
		];
		render(<OverviewBoard viewModel={createMockViewModel()} onOpenItem={vi.fn()} />);

		await dragStart('task-1');
		expect(droppableDisabledById['header-proj-archived']).toBe(true);
	});

	it('ドロップ成功後、Undoアクション付きトーストを表示する', async () => {
		const projA = makeProject('proj-A');
		const projB = makeProject('proj-B');
		mockItems = [
			makeHeaderWrapper(projA),
			makeItemWrapper('task-1', 'proj-A'),
			makeHeaderWrapper(projB),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'header-proj-B');

		expect(mockShowToast).toHaveBeenCalledTimes(1);
		const toastArg = mockShowToast.mock.calls[0][0];
		expect(toastArg.title).toContain('Item task-1');
		expect(toastArg.title).toContain('Project proj-B');
		expect(toastArg.action?.label).toBe('元に戻す');
	});

	it('Undo「元に戻す」クリックで、移動前のprojectId/parentIdへ逆方向のupdateItemが呼ばれる', async () => {
		const projA = makeProject('proj-A');
		const projB = makeProject('proj-B');
		mockItems = [
			makeHeaderWrapper(projA),
			makeItemWrapper('task-1', 'proj-A', { parentId: null }),
			makeHeaderWrapper(projB),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'header-proj-B');
		updateItem.mockClear();

		const toastArg = mockShowToast.mock.calls[0][0];
		await act(async () => {
			toastArg.action.onClick();
		});

		expect(updateItem).toHaveBeenCalledWith('task-1', { projectId: 'proj-A', parentId: null });
	});

	it('API失敗時はエラートーストを表示し、元の所属へ戻すupdateItemを呼ぶ（Undoトーストは出さない）', async () => {
		const projA = makeProject('proj-A');
		const projB = makeProject('proj-B');
		mockItems = [
			makeHeaderWrapper(projA),
			makeItemWrapper('task-1', 'proj-A', { parentId: null }),
			makeHeaderWrapper(projB),
		];
		const updateItem = vi.fn()
			.mockResolvedValueOnce({ success: false, error: new Error('Cannot move item into its own descendant') })
			.mockResolvedValueOnce({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'header-proj-B');

		expect(updateItem).toHaveBeenNthCalledWith(1, 'task-1', { projectId: 'proj-B', parentId: null });
		expect(updateItem).toHaveBeenNthCalledWith(2, 'task-1', { projectId: 'proj-A', parentId: null });
		expect(mockShowToast).toHaveBeenCalledTimes(1);
		expect(mockShowToast.mock.calls[0][0].type).toBe('error');
		expect(mockShowToast.mock.calls[0][0].action).toBeUndefined();
	});
});

describe('R-157: 全体一覧ドラッグ範囲拡大（item行へのドロップ・ハイライト範囲拡大）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockShowToast.mockClear();
		Object.keys(droppableDisabledById).forEach(k => delete droppableDisabledById[k]);
		capturedOnDragStart = null;
		capturedOnDragEnd = null;
		capturedOnDragOver = null;
	});

	it('サブプロジェクトA配下のitem行へドロップすると、Aへ移動する（Aの親やAの兄弟にならない）', async () => {
		const root = makeProject('root-1');
		const subA = makeProject('sub-a', { parentId: 'root-1' });
		const subB = makeProject('sub-b', { parentId: 'root-1' });
		mockItems = [
			makeHeaderWrapper(root),
			makeItemWrapper('task-1', 'root-1'),
			makeHeaderWrapper(subA, 1),
			makeItemWrapper('target-in-suba', 'sub-a', {}, 2),
			makeHeaderWrapper(subB, 1),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'item-drop-target-in-suba');

		expect(updateItem).toHaveBeenCalledWith('task-1', { parentId: 'sub-a', projectId: 'root-1' });
	});

	it('item行ドロップとheader行ドロップで同じ移動先になる', async () => {
		const root = makeProject('root-1');
		const subA = makeProject('sub-a', { parentId: 'root-1' });
		mockItems = [
			makeHeaderWrapper(root),
			makeItemWrapper('task-1', 'root-1'),
			makeHeaderWrapper(subA, 1),
			makeItemWrapper('target-in-suba', 'sub-a', {}, 2),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragEnd('task-1', 'item-drop-target-in-suba');
		expect(updateItem).toHaveBeenLastCalledWith('task-1', { parentId: 'sub-a', projectId: 'root-1' });

		updateItem.mockClear();
		await dragEnd('task-1', 'header-sub-a');
		expect(updateItem).toHaveBeenLastCalledWith('task-1', { parentId: 'sub-a', projectId: 'root-1' });
	});

	it('ドラッグ中、対象groupのheader行・item行すべてにdata-drop-highlighted="true"が付き、他groupには付かない', async () => {
		const root = makeProject('root-1');
		const subA = makeProject('sub-a', { parentId: 'root-1' });
		mockItems = [
			makeHeaderWrapper(root),
			makeItemWrapper('task-1', 'root-1'),
			makeHeaderWrapper(subA, 1),
			makeItemWrapper('target-in-suba', 'sub-a', {}, 2),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		const { container } = render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragStart('task-1');
		await dragOver('task-1', 'header-sub-a');

		const highlighted = container.querySelectorAll('[data-drop-highlighted="true"]');
		// sub-aのheader行と、その配下item行(target-in-suba)の2行だけがハイライトされる
		expect(highlighted.length).toBe(2);
	});

	it('item行をoverしてもそのitem行が属するgroup全体がハイライトされる（headerだけでなくitem行経由でも解決される）', async () => {
		const root = makeProject('root-1');
		const subA = makeProject('sub-a', { parentId: 'root-1' });
		mockItems = [
			makeHeaderWrapper(root),
			makeItemWrapper('task-1', 'root-1'),
			makeHeaderWrapper(subA, 1),
			makeItemWrapper('target-in-suba', 'sub-a', {}, 2),
		];
		const updateItem = vi.fn().mockResolvedValue({ success: true });
		const { container } = render(<OverviewBoard viewModel={createMockViewModel({ updateItem })} onOpenItem={vi.fn()} />);

		await dragStart('task-1');
		await dragOver('task-1', 'item-drop-target-in-suba');

		const highlighted = container.querySelectorAll('[data-drop-highlighted="true"]');
		expect(highlighted.length).toBe(2);
	});
});
