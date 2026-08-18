import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYoukanViewModel } from '../useYoukanViewModel';

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
});
