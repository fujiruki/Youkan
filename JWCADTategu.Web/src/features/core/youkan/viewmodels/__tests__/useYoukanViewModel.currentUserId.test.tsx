import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYoukanViewModel } from '../useYoukanViewModel';
import { ApiClient } from '../../../../../api/client';
import { CloudYoukanRepository } from '../../repositories/CloudYoukanRepository';

// R-135: currentUserId は AuthContext（/auth/me）が唯一の正であることを検証する。
// このテストは currentUserId を直接モック注入しない。useAuth をモックし、
// 実際の解決チェーン（auth.user.id → currentUserId）を通した上で正しく解決される
// ことを担保する（旧実装は Repository に存在しない getCurrentUser?.() を呼んでおり、
// 本番で currentUserId が常に null になっていた）。
//
// joinedTenants は毎回新しい配列参照を返すと refreshContextMetadata の
// useCallback依存が壊れ無限リフェッチになるため、モジュールスコープの安定参照を使う
// （他のuseYoukanViewModelテストと同じ回避策）。

const STABLE_JOINED_TENANTS: unknown[] = [];
vi.mock('../../../auth/providers/AuthProvider', () => ({
	useAuth: () => ({
		isAuthenticated: true,
		user: { id: 'test-user', name: 'Test User' },
		tenant: null,
		joinedTenants: STABLE_JOINED_TENANTS,
		login: vi.fn(),
		logout: vi.fn(),
	})
}));

vi.mock('../../repositories/YoukanRepository', () => ({
	YoukanRepository: {
		getGdbShelf: vi.fn().mockResolvedValue({ active: [], preparation: [], intent: [], log: [] }),
		getTodayView: vi.fn().mockResolvedValue({ commits: [], execution: null, candidates: [] }),
		getMemos: vi.fn().mockResolvedValue([]),
		getMembers: vi.fn().mockResolvedValue([]),
		getCapacityConfig: vi.fn().mockResolvedValue(null),
		getProjects: vi.fn().mockResolvedValue([]),
		getJoinedTenants: vi.fn().mockResolvedValue([]),
	}
}));
vi.mock('../../repositories/CloudYoukanRepository', () => ({
	CloudYoukanRepository: {
		getGdbShelf: vi.fn().mockResolvedValue({ active: [], preparation: [], intent: [], log: [] }),
		getTodayView: vi.fn().mockResolvedValue({ commits: [], execution: null, candidates: [] }),
		getMemos: vi.fn().mockResolvedValue([]),
		getMembers: vi.fn().mockResolvedValue([]),
		getCapacityConfig: vi.fn().mockResolvedValue(null),
		getProjects: vi.fn().mockResolvedValue([]),
		getJoinedTenants: vi.fn().mockResolvedValue([]),
	}
}));
vi.mock('../../contexts/UndoContext', () => ({
	useUndo: () => ({ addUndoAction: vi.fn() })
}));
vi.mock('../../contexts/FilterContext', () => ({
	useFilter: () => ({ filterMode: 'all', setFilterMode: vi.fn(), hideCompleted: false, setHideCompleted: vi.fn() })
}));
vi.mock('../../../../../api/client', () => ({
	ApiClient: {
		updateMember: vi.fn().mockResolvedValue({ success: true }),
	}
}));

const waitForLoad = async () => {
	await act(async () => {
		await new Promise(r => setTimeout(r, 20));
	});
};

describe('useYoukanViewModel currentUserId（R-135: 実際の解決チェーンを通した検証）', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('Repositoryに getCurrentUser が存在しなくても useAuth の user.id から currentUserId が解決される', async () => {
		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		// このファイル内でモックした useAuth の user.id
		expect(result.current.currentUserId).toBe('test-user');
	});

	// [R-137] updateCapacityException の自分のメンバー特定は、localStorage['youkan_user']への
	// フォールバックを廃止し currentUserId（useAuth由来）のみで行う。旧実装のOR条件フォールバックが
	// 無くても、正しい自分の membership が特定できることを確認する。
	it('localStorageにyoukan_userが無くても、currentUserIdだけで自分のmembershipを特定しキャパシティ例外を保存できる', async () => {
		vi.mocked(CloudYoukanRepository.getMembers).mockResolvedValueOnce([
			{
				id: 'member-1',
				userId: 'test-user',
				display_name: 'Test User',
				role: 'member',
				isCore: true,
				dailyCapacityMinutes: 480,
				capacityProfile: { standardWeeklyPattern: {}, exceptions: {} }
			}
		] as any);
		vi.mocked(CloudYoukanRepository.getProjects).mockResolvedValueOnce([
			{ id: 'proj-1', isProject: true, tenantId: 'tenant-1', title: 'Project' }
		] as any);

		const { result } = renderHook(() => useYoukanViewModel('proj-1'));
		await waitForLoad();

		await act(async () => {
			await result.current.updateCapacityException(new Date('2026-08-18'), [{ tenantId: 'tenant-1', minutes: 300 }]);
		});

		expect(ApiClient.updateMember).toHaveBeenCalledWith('member-1', expect.objectContaining({
			capacityProfile: expect.objectContaining({
				exceptions: expect.objectContaining({ '2026-08-18': 300 })
			})
		}));
	});
});
