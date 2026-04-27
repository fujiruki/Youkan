import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYoukanViewModel } from '../useYoukanViewModel';
import { CloudYoukanRepository } from '../../repositories/CloudYoukanRepository';

vi.mock('../../repositories/YoukanRepository', () => ({
	YoukanRepository: {
		getGdbShelf: vi.fn().mockResolvedValue({ active: [], preparation: [], intent: [], log: [] }),
		getTodayView: vi.fn().mockResolvedValue({ commits: [], execution: null, candidates: [] }),
		getMemos: vi.fn().mockResolvedValue([]),
		getMembers: vi.fn().mockResolvedValue([]),
		getCapacityConfig: vi.fn().mockResolvedValue(null),
		getProjects: vi.fn().mockResolvedValue([]),
		getJoinedTenants: vi.fn().mockResolvedValue([]),
		getCurrentUser: vi.fn().mockResolvedValue(null),
	}
}));

vi.mock('../../repositories/CloudYoukanRepository', () => {
	const makeItem = (id: string, overrides: Record<string, unknown> = {}) => ({
		id,
		title: `Task ${id}`,
		status: 'inbox',
		createdAt: 0,
		updatedAt: 0,
		statusUpdatedAt: 0,
		weight: 1,
		interrupt: false,
		doorId: '',
		category: 'door',
		type: 'start',
		memo: '',
		tenantId: 'tenant-A',
		projectId: null,
		focusOrder: 0,
		isEngaged: false,
		...overrides,
	});

	return {
		CloudYoukanRepository: {
			getGdbShelf: vi.fn().mockResolvedValue({
				active: [
					makeItem('parent-1', { tenantId: 'tenant-A' }),
					makeItem('child-1', { tenantId: 'tenant-A', parentId: 'parent-1' }),
					makeItem('child-2', { tenantId: 'tenant-A', parentId: 'parent-1' }),
					makeItem('grandchild-1', { tenantId: 'tenant-A', parentId: 'child-1' }),
				],
				preparation: [],
				intent: [],
				log: [],
			}),
			getTodayView: vi.fn().mockResolvedValue({ commits: [], execution: null, candidates: [] }),
			getMemos: vi.fn().mockResolvedValue([]),
			getMembers: vi.fn().mockResolvedValue([]),
			getCapacityConfig: vi.fn().mockResolvedValue(null),
			getProjects: vi.fn().mockResolvedValue([]),
			getJoinedTenants: vi.fn().mockResolvedValue([]),
			getCurrentUser: vi.fn().mockResolvedValue(null),
			updateItem: vi.fn().mockResolvedValue({ success: true, affectedDescendantIds: [] }),
			archiveItem: vi.fn().mockResolvedValue({ success: true, affectedDescendantIds: [] }),
			fetchItemsByIds: vi.fn().mockResolvedValue([]),
			trashItem: vi.fn().mockResolvedValue({ success: true, affectedDescendantIds: [] }),
			restoreItem: vi.fn().mockResolvedValue({ success: true, affectedDescendantIds: [] }),
			destroyItem: vi.fn().mockResolvedValue({ success: true, deletedDescendantIds: [] }),
			addItemToInbox: vi.fn().mockResolvedValue('new-id'),
			createItem: vi.fn().mockResolvedValue('new-id'),
			deleteItem: vi.fn().mockResolvedValue(undefined),
			getSubTasks: vi.fn().mockResolvedValue([]),
			resolveDecision: vi.fn().mockResolvedValue(undefined),
			commitToToday: vi.fn().mockResolvedValue(undefined),
			startExecution: vi.fn().mockResolvedValue(undefined),
			completeItem: vi.fn().mockResolvedValue(undefined),
			saveCapacityConfig: vi.fn().mockResolvedValue(undefined),
		}
	};
});

vi.mock('../../contexts/UndoContext', () => ({
	useUndo: () => ({ addUndoAction: vi.fn() })
}));

vi.mock('../../contexts/FilterContext', () => ({
	useFilter: () => ({ filterMode: 'all', setFilterMode: vi.fn() })
}));

const mockedRepo = () => vi.mocked(CloudYoukanRepository);

const waitForLoad = async () => {
	await act(async () => {
		await new Promise(r => setTimeout(r, 50));
	});
};

describe('useYoukanViewModel - カスケード楽観更新', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(CloudYoukanRepository.getGdbShelf).mockResolvedValue({
			active: [
				{ id: 'parent-1', title: 'Task parent-1', status: 'inbox', createdAt: 0, updatedAt: 0, statusUpdatedAt: 0, weight: 1, interrupt: false, doorId: '', category: 'door', type: 'start', memo: '', tenantId: 'tenant-A', projectId: null, focusOrder: 0, isEngaged: false },
				{ id: 'child-1', title: 'Task child-1', status: 'inbox', createdAt: 0, updatedAt: 0, statusUpdatedAt: 0, weight: 1, interrupt: false, doorId: '', category: 'door', type: 'start', memo: '', tenantId: 'tenant-A', projectId: null, parentId: 'parent-1', focusOrder: 0, isEngaged: false },
				{ id: 'child-2', title: 'Task child-2', status: 'inbox', createdAt: 0, updatedAt: 0, statusUpdatedAt: 0, weight: 1, interrupt: false, doorId: '', category: 'door', type: 'start', memo: '', tenantId: 'tenant-A', projectId: null, parentId: 'parent-1', focusOrder: 0, isEngaged: false },
				{ id: 'grandchild-1', title: 'Task grandchild-1', status: 'inbox', createdAt: 0, updatedAt: 0, statusUpdatedAt: 0, weight: 1, interrupt: false, doorId: '', category: 'door', type: 'start', memo: '', tenantId: 'tenant-A', projectId: null, parentId: 'child-1', focusOrder: 0, isEngaged: false },
			],
			preparation: [],
			intent: [],
			log: [],
		} as any);
		vi.mocked(CloudYoukanRepository.getTodayView).mockResolvedValue({ commits: [], execution: null, candidates: [] });
		vi.mocked(CloudYoukanRepository.getMemos).mockResolvedValue([]);
		vi.mocked(CloudYoukanRepository.getMembers).mockResolvedValue([]);
		vi.mocked(CloudYoukanRepository.getCapacityConfig).mockResolvedValue(null);
		vi.mocked(CloudYoukanRepository.getProjects).mockResolvedValue([]);
		vi.mocked(CloudYoukanRepository.getJoinedTenants).mockResolvedValue([]);
		vi.mocked(CloudYoukanRepository.updateItem).mockResolvedValue({ success: true, affectedDescendantIds: [] });
		vi.mocked(CloudYoukanRepository.archiveItem).mockResolvedValue({ success: true, affectedDescendantIds: [] });
		vi.mocked(CloudYoukanRepository.fetchItemsByIds).mockResolvedValue([]);
	});

	it('updateItem({tenantId: "tenant-B"}) 呼出後、親の tenantId が即時更新される', async () => {
		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		await act(async () => {
			await result.current.updateItem('parent-1', { tenantId: 'tenant-B' });
		});

		const updatedParent = result.current.gdbActive.find(i => i.id === 'parent-1');
		expect(updatedParent?.tenantId).toBe('tenant-B');
	});

	it('updateItem({tenantId}) 呼出後、子孫の tenantId も楽観的に更新される', async () => {
		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		await act(async () => {
			await result.current.updateItem('parent-1', { tenantId: 'tenant-B' });
		});

		const allActive = result.current.gdbActive;
		expect(allActive.find(i => i.id === 'child-1')?.tenantId).toBe('tenant-B');
		expect(allActive.find(i => i.id === 'child-2')?.tenantId).toBe('tenant-B');
		expect(allActive.find(i => i.id === 'grandchild-1')?.tenantId).toBe('tenant-B');
	});

	it('API成功時、affectedDescendantIds が空なら fetchItemsByIds は呼ばれない', async () => {
		vi.mocked(CloudYoukanRepository.updateItem).mockResolvedValue({ success: true, affectedDescendantIds: [] });

		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		await act(async () => {
			await result.current.updateItem('parent-1', { tenantId: 'tenant-B' });
		});

		expect(mockedRepo().fetchItemsByIds).not.toHaveBeenCalled();
	});

	it('API成功時、affectedDescendantIds がある場合 fetchItemsByIds が呼ばれる', async () => {
		vi.mocked(CloudYoukanRepository.updateItem).mockResolvedValue({
			success: true,
			affectedDescendantIds: ['child-1', 'child-2', 'grandchild-1'],
		});
		vi.mocked(CloudYoukanRepository.fetchItemsByIds).mockResolvedValue([]);

		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		await act(async () => {
			await result.current.updateItem('parent-1', { tenantId: 'tenant-B' });
		});

		expect(mockedRepo().fetchItemsByIds).toHaveBeenCalledWith(['child-1', 'child-2', 'grandchild-1']);
	});

	it('API失敗時、snapshot から rollback されて子孫の tenantId が元に戻る', async () => {
		vi.mocked(CloudYoukanRepository.updateItem).mockRejectedValue(new Error('ネットワークエラー'));

		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		const originalTenantId = result.current.gdbActive.find(i => i.id === 'child-1')?.tenantId;

		await act(async () => {
			try {
				await result.current.updateItem('parent-1', { tenantId: 'tenant-B' });
			} catch {
				// エラーは想定内
			}
		});

		const rolledBack = result.current.gdbActive.find(i => i.id === 'child-1');
		expect(rolledBack?.tenantId).toBe(originalTenantId);
	});

	it('archiveItem(parentId) → API成功後 affectedDescendantIds で fetchItemsByIds が呼ばれる', async () => {
		vi.mocked(CloudYoukanRepository.archiveItem).mockResolvedValue({
			success: true,
			affectedDescendantIds: ['child-1', 'child-2'],
		});
		vi.mocked(CloudYoukanRepository.fetchItemsByIds).mockResolvedValue([]);

		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		await act(async () => {
			await result.current.archiveItem('parent-1');
		});

		expect(mockedRepo().fetchItemsByIds).toHaveBeenCalledWith(['child-1', 'child-2']);
	});
});
