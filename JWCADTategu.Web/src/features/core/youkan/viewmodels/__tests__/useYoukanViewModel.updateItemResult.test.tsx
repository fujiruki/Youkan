import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYoukanViewModel } from '../useYoukanViewModel';
import { CloudYoukanRepository } from '../../repositories/CloudYoukanRepository';

/**
 * R-155: 全体一覧ドラッグでプロジェクト移動の失敗時エラートースト表示のために、
 * updateItem() が成功/失敗を呼び出し元へ返すことを確認する。
 * 既存の呼び出し箇所は戻り値を使っていないため後方互換（呼び出し方は一切変更不要）。
 */

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

vi.mock('../../repositories/CloudYoukanRepository', () => ({
	CloudYoukanRepository: {
		getGdbShelf: vi.fn().mockResolvedValue({
			active: [{
				id: 'item-1',
				title: 'Task item-1',
				status: 'inbox',
				createdAt: 0,
				updatedAt: 0,
				statusUpdatedAt: 0,
				weight: 1,
				interrupt: false,
				tenantId: 'tenant-1',
				projectId: null,
				focusOrder: 0,
				isEngaged: false,
			}],
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
		updateItem: vi.fn(),
	}
}));

vi.mock('../../contexts/UndoContext', () => ({
	useUndo: () => ({ addUndoAction: vi.fn() })
}));

vi.mock('../../contexts/FilterContext', () => ({
	useFilter: () => ({ filterMode: 'all', setFilterMode: vi.fn(), hideCompleted: false, setHideCompleted: vi.fn() })
}));

const STABLE_JOINED_TENANTS: unknown[] = [];
vi.mock('../../../auth/providers/AuthProvider', () => ({
	useAuth: () => ({ joinedTenants: STABLE_JOINED_TENANTS })
}));

const waitForLoad = async () => {
	await act(async () => {
		await new Promise(r => setTimeout(r, 20));
	});
};

describe('useYoukanViewModel.updateItem の戻り値（R-155）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('API成功時は { success: true } を返す', async () => {
		vi.mocked(CloudYoukanRepository.updateItem).mockResolvedValue({ success: true, affectedDescendantIds: [] } as any);
		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		let outcome: any;
		await act(async () => {
			outcome = await result.current.updateItem('item-1', { projectId: 'proj-X', parentId: null });
		});

		expect(outcome).toEqual({ success: true });
	});

	it('API失敗（400等）時は { success: false, error } を返し、例外を投げない', async () => {
		const apiError = new Error('Cannot move item into its own descendant');
		vi.mocked(CloudYoukanRepository.updateItem).mockRejectedValue(apiError);
		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		let outcome: any;
		await act(async () => {
			outcome = await result.current.updateItem('item-1', { parentId: 'proj-X', projectId: 'proj-X' });
		});

		expect(outcome).toEqual({ success: false, error: apiError });
	});
});
