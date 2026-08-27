/**
 * R-153: Beaver連携の最小統合（ProjectRegistryScreen）
 * - overviewにリンクがある行に「Beaver」バッジ＋結論1行
 * - missing_upstream／キャンセルは要確認表示
 * - API失敗（503）時はBeaver UIを一切出さず一覧は従来どおり
 * - 「今すぐ同期」で full/force=true の sync → overview 再取得
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ProjectRegistryScreen } from '../ProjectRegistryScreen';
import { useAuth } from '@/features/core/auth/providers/AuthProvider';
import { BeaverApi, BeaverOverview } from '@/api/beaver';

vi.mock('@/api/beaver', () => ({
	BeaverApi: {
		sync: vi.fn(),
		getOverview: vi.fn(),
	},
}));

vi.mock('@/features/core/youkan/contexts/FilterContext', () => ({
	useFilter: () => ({ filterMode: 'company' }),
}));

vi.mock('@/features/core/youkan/contexts/ViewModeContext', () => ({
	useViewMode: () => ({ projectViewMode: 'card' }),
}));

const viewModelMock = {
	projects: [] as any[],
	members: [] as any[],
	loading: false,
	fetchProjects: vi.fn(),
	deleteProject: vi.fn(),
	trashProject: vi.fn(),
	archiveProject: vi.fn(),
	assignProject: vi.fn(),
	activeScope: 'company' as const,
	setActiveScope: vi.fn(),
};

vi.mock('@/features/core/youkan/viewmodels/useProjectViewModel', () => ({
	useProjectViewModel: () => viewModelMock,
}));

const baseProjects = [
	{ id: 'p1', title: '玄関引戸', tenantId: 'test-tenant', judgmentStatus: 'inbox', updatedAt: Date.now() },
	{ id: 'p2', title: '通常案件', tenantId: 'test-tenant', judgmentStatus: 'inbox', updatedAt: Date.now() },
];

const makeOverview = (linkOverrides: Partial<BeaverOverview['links'][number]> = {}): BeaverOverview => ({
	links: [{
		externalProjectId: 123,
		youkanProjectId: 'p1',
		name: '玄関引戸',
		sourceStatus: '製造中',
		syncState: 'ok',
		deliveryDate: '2026-09-10',
		baselineMinutes: 1200,
		baselineSource: 'estimate',
		feasibility: {
			feasible: true,
			shortageMinutes: 0,
			earliestCompletionDate: '2026-09-01',
			deadline: '2026-09-10',
			message: '入ります',
		},
		workPackages: [],
		...linkOverrides,
	}],
	lastSyncedAt: 1756100000,
	lastError: null,
});

describe('R-153: ProjectRegistryScreen Beaver最小統合', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		viewModelMock.projects = baseProjects;
		vi.mocked(useAuth).mockReturnValue({
			isAuthenticated: true,
			user: { id: 'test-user', name: 'Test User' },
			tenant: { id: 'test-tenant', name: 'テスト社' },
			joinedTenants: [{ id: 'test-tenant', name: 'テスト社' }],
			login: vi.fn(),
			logout: vi.fn(),
		} as any);
		vi.mocked(BeaverApi.sync).mockResolvedValue({ synced: 1, skipped: false, lastSyncedAt: 1756100000, error: null });
		vi.mocked(BeaverApi.getOverview).mockResolvedValue(makeOverview());
	});

	it('リンクのある行にBeaverバッジと結論1行を表示し、画面表示時に diff/force=false で同期する', async () => {
		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByTestId('beaver-badge')).toBeInTheDocument();
		});
		expect(screen.getByText('入ります')).toBeInTheDocument();
		expect(BeaverApi.sync).toHaveBeenCalledWith('diff', false);
		// リンクのない行（通常案件）にはバッジが付かない
		expect(screen.getAllByTestId('beaver-badge')).toHaveLength(1);
		expect(screen.getByText('通常案件').closest('[class*="group"]')?.textContent).not.toContain('Beaver');
	});

	it('不足ケースはサーバーのmessageを赤系で表示する', async () => {
		vi.mocked(BeaverApi.getOverview).mockResolvedValue(makeOverview({
			feasibility: {
				feasible: false,
				shortageMinutes: 180,
				earliestCompletionDate: '2026-09-12',
				deadline: '2026-09-10',
				message: '9/10納期では3h不足（9/12なら入る）',
			},
		}));

		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		const message = await screen.findByText('9/10納期では3h不足（9/12なら入る）');
		expect(message.className).toMatch(/red/);
	});

	it('missing_upstream とキャンセルは要確認表示になる', async () => {
		vi.mocked(BeaverApi.getOverview).mockResolvedValue({
			links: [
				makeOverview({ syncState: 'missing_upstream' }).links[0],
				makeOverview({ youkanProjectId: 'p2', externalProjectId: 456, sourceStatus: 'キャンセル' }).links[0],
			],
			lastSyncedAt: 1756100000,
			lastError: null,
		});

		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		expect(await screen.findByText('Beaver側から消えています・要確認')).toBeInTheDocument();
		expect(await screen.findByText('Beaverでキャンセル・要確認')).toBeInTheDocument();
	});

	it('API失敗（503）時はBeaver UIを一切出さず、一覧は従来どおり表示される', async () => {
		const error = Object.assign(new Error('Beaver連携が設定されていません'), { status: 503 });
		vi.mocked(BeaverApi.sync).mockRejectedValue(error);
		vi.mocked(BeaverApi.getOverview).mockRejectedValue(error);

		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		await waitFor(() => {
			expect(BeaverApi.getOverview).toHaveBeenCalled();
		});
		expect(screen.getByText('玄関引戸')).toBeInTheDocument();
		expect(screen.getByText('通常案件')).toBeInTheDocument();
		expect(screen.queryByTestId('beaver-badge')).toBeNull();
		expect(screen.queryByText('今すぐ同期')).toBeNull();
	});

	it('「今すぐ同期」で full/force=true の同期と overview 再取得が行われる', async () => {
		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		const button = await screen.findByText('今すぐ同期');
		expect(BeaverApi.getOverview).toHaveBeenCalledTimes(1);

		fireEvent.click(button);

		await waitFor(() => {
			expect(BeaverApi.sync).toHaveBeenCalledWith('full', true);
			expect(BeaverApi.getOverview).toHaveBeenCalledTimes(2);
		});
	});

	it('同期失敗時は「同期できませんでした（前回同期: X）」を表示する', async () => {
		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		const button = await screen.findByText('今すぐ同期');
		vi.mocked(BeaverApi.sync).mockRejectedValue(new Error('Beaver到達不能'));

		fireEvent.click(button);

		expect(await screen.findByText(/同期できませんでした（前回同期: /)).toBeInTheDocument();
	});
});

describe('R-154: ProjectRegistryScreen work_package段階分解表示', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		viewModelMock.projects = baseProjects;
		vi.mocked(useAuth).mockReturnValue({
			isAuthenticated: true,
			user: { id: 'test-user', name: 'Test User' },
			tenant: { id: 'test-tenant', name: 'テスト社' },
			joinedTenants: [{ id: 'test-tenant', name: 'テスト社' }],
			login: vi.fn(),
			logout: vi.fn(),
		} as any);
		vi.mocked(BeaverApi.sync).mockResolvedValue({ synced: 1, skipped: false, lastSyncedAt: 1756100000, error: null });
	});

	const makeWorkPackage = (overrides: Partial<BeaverOverview['links'][number]['workPackages'][number]> = {}) => ({
		externalWorkPackageId: 'beaver:voucher:60:line:201:factory',
		youkanItemId: 'wp1',
		label: '建具A 製作',
		category: 'factory' as const,
		baselineMinutes: 480,
		decomposedMinutes: 420,
		effectiveTotalMinutes: 480,
		virtualResidualMinutes: 60,
		overageMinutes: 0,
		syncState: 'ok' as const,
		...overrides,
	});

	it('work_packagesが非空の案件に分解済み/未分解の1行とwork_package行を表示する', async () => {
		vi.mocked(BeaverApi.getOverview).mockResolvedValue({
			links: [{
				externalProjectId: 123,
				youkanProjectId: 'p1',
				name: '玄関引戸',
				sourceStatus: '製造中',
				syncState: 'ok',
				deliveryDate: '2026-09-10',
				baselineMinutes: 1200,
				baselineSource: 'estimate',
				feasibility: null,
				workPackages: [makeWorkPackage()],
			}],
			lastSyncedAt: 1756100000,
			lastError: null,
		});

		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		expect(await screen.findByText('分解済み8h／未分解12h')).toBeInTheDocument();
		expect(await screen.findByText('建具A 製作')).toBeInTheDocument();
		expect(await screen.findByText('分解済み7h／未分解1h')).toBeInTheDocument();
	});

	it('超過時は「基準◯h→現在計画◯h（+◯h）」を表示する', async () => {
		vi.mocked(BeaverApi.getOverview).mockResolvedValue({
			links: [{
				externalProjectId: 123,
				youkanProjectId: 'p1',
				name: '玄関引戸',
				sourceStatus: '製造中',
				syncState: 'ok',
				deliveryDate: '2026-09-10',
				baselineMinutes: 1200,
				baselineSource: 'estimate',
				feasibility: null,
				workPackages: [makeWorkPackage({ baselineMinutes: 480, decomposedMinutes: 540, effectiveTotalMinutes: 540, virtualResidualMinutes: 0, overageMinutes: 60 })],
			}],
			lastSyncedAt: 1756100000,
			lastError: null,
		});

		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		expect(await screen.findByText('基準8h→現在計画9h（+1h）')).toBeInTheDocument();
	});

	it('missing_upstreamのwork_packageに要確認バッジを表示する', async () => {
		vi.mocked(BeaverApi.getOverview).mockResolvedValue({
			links: [{
				externalProjectId: 123,
				youkanProjectId: 'p1',
				name: '玄関引戸',
				sourceStatus: '製造中',
				syncState: 'ok',
				deliveryDate: '2026-09-10',
				baselineMinutes: 1200,
				baselineSource: 'estimate',
				feasibility: null,
				workPackages: [makeWorkPackage({ syncState: 'missing_upstream' })],
			}],
			lastSyncedAt: 1756100000,
			lastError: null,
		});

		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		expect(await screen.findByText('建具A 製作')).toBeInTheDocument();
		expect(await screen.findByText('Beaver側から消えています・要確認')).toBeInTheDocument();
	});

	it('work_packagesが空の案件ではY1表示（バッジ＋結論1行のみ）が変わらない（回帰）', async () => {
		vi.mocked(BeaverApi.getOverview).mockResolvedValue({
			links: [{
				externalProjectId: 123,
				youkanProjectId: 'p1',
				name: '玄関引戸',
				sourceStatus: '製造中',
				syncState: 'ok',
				deliveryDate: '2026-09-10',
				baselineMinutes: 1200,
				baselineSource: 'estimate',
				feasibility: { feasible: true, shortageMinutes: 0, earliestCompletionDate: '2026-09-01', deadline: '2026-09-10', message: '入ります' },
				workPackages: [],
			}],
			lastSyncedAt: 1756100000,
			lastError: null,
		});

		render(<ProjectRegistryScreen onSelect={vi.fn()} />);

		await waitFor(() => {
			expect(screen.getByTestId('beaver-badge')).toBeInTheDocument();
		});
		expect(screen.getByText('入ります')).toBeInTheDocument();
		expect(screen.queryByTestId('beaver-decompose-line')).toBeNull();
		expect(screen.queryByTestId('beaver-work-package-row')).toBeNull();
	});
});
