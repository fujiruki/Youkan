import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYoukanViewModel } from '../useYoukanViewModel';
import { CloudYoukanRepository } from '../../repositories/CloudYoukanRepository';

// R-125: 今日のキャパ集計（capacityUsed）は todo（後日着手）を除外する。
// todo は「今日はやらない」と決めた状態のため、今日の負荷には計上しない。
// 一方で日付別集計（ガント・カレンダー）は含める（別テストで担保、ここでは
// getGdbShelf の todo バケットが getQuantityContext の items に含まれないことを検証する）。

// [NOTE] toISOString()はUTC基準のため、JST深夜帯でローカル日付とズレる。
// calculateVolume/capacityUsedはローカル日付基準のため、テストもローカル日付で組み立てる
const todayLocal = new Date();
const todayStr = `${todayLocal.getFullYear()}-${String(todayLocal.getMonth() + 1).padStart(2, '0')}-${String(todayLocal.getDate()).padStart(2, '0')}`;

vi.mock('../../repositories/YoukanRepository', () => ({
	YoukanRepository: {
		getGdbShelf: vi.fn(),
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
		getGdbShelf: vi.fn(),
		getTodayView: vi.fn().mockResolvedValue({ commits: [], execution: null, candidates: [] }),
		getMemos: vi.fn().mockResolvedValue([]),
		getMembers: vi.fn().mockResolvedValue([]),
		getCapacityConfig: vi.fn().mockResolvedValue(null),
		getProjects: vi.fn().mockResolvedValue([]),
		getJoinedTenants: vi.fn().mockResolvedValue([]),
		getCurrentUser: vi.fn().mockResolvedValue(null),
		updateItem: vi.fn().mockResolvedValue({ success: true }),
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

describe('useYoukanViewModel capacityUsed (R-125)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('shelf.todo（後日着手）は今日のキャパ集計から除外される', async () => {
		vi.mocked(CloudYoukanRepository.getGdbShelf).mockResolvedValue({
			active: [],
			todo: [{
				id: 'todo-1', title: 'Later Task', status: 'todo',
				due_date: todayStr, estimatedMinutes: 480,
				statusUpdatedAt: 0, focusOrder: 0, isEngaged: false,
				interrupt: false, weight: 1, createdAt: 0, updatedAt: 0,
			}],
			preparation: [], intent: [], log: []
		} as any);

		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		expect(result.current.gdbTodo.map(i => i.id)).toEqual(['todo-1']);
		expect(result.current.capacityUsed).toBe(0);
	});

	it('shelf.active（inbox/focus）は今日のキャパ集計に含まれる（対照確認）', async () => {
		vi.mocked(CloudYoukanRepository.getGdbShelf).mockResolvedValue({
			active: [{
				id: 'inbox-1', title: 'Inbox Task', status: 'inbox',
				due_date: todayStr, estimatedMinutes: 480,
				statusUpdatedAt: 0, focusOrder: 0, isEngaged: false,
				interrupt: false, weight: 1, createdAt: 0, updatedAt: 0,
			}],
			todo: [], preparation: [], intent: [], log: []
		} as any);

		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		expect(result.current.capacityUsed).toBe(480);
	});
});
