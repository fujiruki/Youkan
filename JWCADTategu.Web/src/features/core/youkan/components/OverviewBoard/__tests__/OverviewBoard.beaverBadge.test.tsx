import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { OverviewBoard } from '../OverviewBoard';
import type { OverviewItemWrapper } from '../useOverviewItems';
import type { BeaverOverview } from '../../../../../../api/beaver';

/**
 * R-156: 全体一覧Beaver連携バッジ。
 * docs/SPEC/10_全体一覧Beaver連携バッジ.md §6 を正とする。
 * useBeaverIntegration()はネットワークを叩く副作用フックのため、実装（useWorkPackageSummaryは
 * 純粋なMap化ロジックなので実物を使う）と分けてモックする。
 */

const mockUseBeaverIntegration = vi.fn();
vi.mock('../../../viewmodels/useBeaverIntegration', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../viewmodels/useBeaverIntegration')>();
	return {
		...actual,
		useBeaverIntegration: () => mockUseBeaverIntegration(),
	};
});

vi.mock('@dnd-kit/core', () => ({
	DndContext: ({ children }: any) => children,
	DragOverlay: ({ children }: any) => children ?? null,
	useDraggable: () => ({ attributes: {}, listeners: {}, setNodeRef: () => { }, isDragging: false }),
	useDroppable: () => ({ setNodeRef: () => { }, isOver: false }),
	useSensor: () => ({}),
	useSensors: () => [],
	PointerSensor: function PointerSensor() { },
	KeyboardSensor: function KeyboardSensor() { },
	pointerWithin: () => null,
}));
vi.mock('@dnd-kit/sortable', () => ({ sortableKeyboardCoordinates: () => null }));

vi.mock('../../../../../contexts/ToastContext', () => ({
	useToast: () => ({ showToast: vi.fn(), toasts: [], dismissToast: vi.fn() }),
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

const makeOverview = (overrides: Partial<BeaverOverview> = {}): BeaverOverview => ({
	links: [{
		externalProjectId: 1,
		youkanProjectId: 'root-1',
		name: 'Beaver案件',
		sourceStatus: '製造中',
		syncState: 'ok',
		deliveryDate: null,
		baselineMinutes: 600,
		baselineSource: 'estimate',
		feasibility: null,
		workPackages: [{
			externalWorkPackageId: 'ewp-1',
			youkanItemId: 'wp-1',
			label: '製作',
			category: null,
			baselineMinutes: 480,
			decomposedMinutes: 0,
			effectiveTotalMinutes: 480,
			virtualResidualMinutes: 480,
			overageMinutes: 0,
			syncState: 'ok',
		}],
	}],
	lastSyncedAt: 1756100000,
	lastError: null,
	...overrides,
});

const withBeaverIntegration = (overview: BeaverOverview | null) => {
	const map = new Map();
	overview?.links.forEach(link => map.set(String(link.youkanProjectId), link));
	mockUseBeaverIntegration.mockReturnValue({
		overview,
		linkByProjectId: map,
		syncNow: vi.fn(),
		syncing: false,
		syncFailed: false,
	});
};

const badgeWithin = (title: string) => {
	const titleEl = screen.getByText(title);
	return within(titleEl.parentElement as HTMLElement).queryByTestId('overview-beaver-badge');
};

describe('R-156: OverviewBoard Beaverバッジ', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('ルート案件（Beaverリンクあり）のheader行にバッジが表示される', () => {
		const root = makeProject('root-1');
		mockItems = [makeHeaderWrapper(root)];
		withBeaverIntegration(makeOverview());

		render(<OverviewBoard viewModel={createMockViewModel()} onOpenItem={vi.fn()} />);

		expect(badgeWithin('Project root-1')).toBeInTheDocument();
	});

	it('Beaver由来work_packageのheader行にバッジが表示される', () => {
		const root = makeProject('root-1');
		const workPackage = makeProject('wp-1', { parentId: null, projectId: 'root-1' });
		mockItems = [makeHeaderWrapper(root), makeHeaderWrapper(workPackage, 1)];
		withBeaverIntegration(makeOverview());

		render(<OverviewBoard viewModel={createMockViewModel()} onOpenItem={vi.fn()} />);

		expect(badgeWithin('Project wp-1')).toBeInTheDocument();
	});

	it('通常の手動プロジェクト・手動サブプロジェクトのheader行にはバッジが表示されない', () => {
		const manualRoot = makeProject('manual-root');
		const manualSub = makeProject('manual-sub', { parentId: 'manual-root' });
		mockItems = [makeHeaderWrapper(manualRoot), makeHeaderWrapper(manualSub, 1)];
		withBeaverIntegration(makeOverview());

		render(<OverviewBoard viewModel={createMockViewModel()} onOpenItem={vi.fn()} />);

		expect(badgeWithin('Project manual-root')).not.toBeInTheDocument();
		expect(badgeWithin('Project manual-sub')).not.toBeInTheDocument();
		expect(screen.queryAllByTestId('overview-beaver-badge')).toHaveLength(0);
	});

	it('missing_upstream状態のリンクでも「連携されている」バッジ自体は表示される', () => {
		const root = makeProject('root-1');
		mockItems = [makeHeaderWrapper(root)];
		withBeaverIntegration(makeOverview({
			links: [{
				externalProjectId: 1,
				youkanProjectId: 'root-1',
				name: 'Beaver案件',
				sourceStatus: null,
				syncState: 'missing_upstream',
				deliveryDate: null,
				baselineMinutes: 600,
				baselineSource: 'estimate',
				feasibility: null,
				workPackages: [],
			}],
		}));

		render(<OverviewBoard viewModel={createMockViewModel()} onOpenItem={vi.fn()} />);

		expect(badgeWithin('Project root-1')).toBeInTheDocument();
	});

	it('overview取得失敗（.env未設定含む）時は一切表示されない', () => {
		const root = makeProject('root-1');
		const workPackage = makeProject('wp-1', { projectId: 'root-1' });
		mockItems = [makeHeaderWrapper(root), makeHeaderWrapper(workPackage, 1)];
		withBeaverIntegration(null);

		render(<OverviewBoard viewModel={createMockViewModel()} onOpenItem={vi.fn()} />);

		expect(screen.queryAllByTestId('overview-beaver-badge')).toHaveLength(0);
	});
});
