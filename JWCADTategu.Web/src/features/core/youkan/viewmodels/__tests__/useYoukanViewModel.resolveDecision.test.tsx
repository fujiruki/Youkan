import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useYoukanViewModel } from '../useYoukanViewModel';
import { CloudYoukanRepository } from '../../repositories/CloudYoukanRepository';

// R-124: useYoukanViewModel.resolveDecision の「断る」(no) が status:'done'（完了）に
// なってしまう旧バグの再現防止テスト。状況把握(Panorama)・登録と集中(Dashboard)は
// この resolveDecision を経由するため、ここで正しさを保証すれば両画面に効く。

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
		getGdbShelf: vi.fn().mockResolvedValue({ active: [], preparation: [], intent: [], log: [] }),
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

// joinedTenantsは参照が毎回変わるとuseEffectの依存配列で無限フェッチループを起こすため、
// モジュール直下の固定配列を返して参照を安定させる
const STABLE_JOINED_TENANTS: unknown[] = [];
vi.mock('../../../auth/providers/AuthProvider', () => ({
	useAuth: () => ({ joinedTenants: STABLE_JOINED_TENANTS })
}));

const waitForLoad = async () => {
	await act(async () => {
		await new Promise(r => setTimeout(r, 20));
	});
};

describe('useYoukanViewModel.resolveDecision (R-124)', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(CloudYoukanRepository.updateItem).mockResolvedValue({ success: true } as any);
	});

	it('yesはstatus:focusを書き込む', async () => {
		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		await act(async () => {
			await result.current.resolveDecision('item-1', 'yes');
		});

		const call = vi.mocked(CloudYoukanRepository.updateItem).mock.calls.find(c => c[0] === 'item-1' && (c[1] as any).status);
		expect(call?.[1]).toMatchObject({ status: 'focus' });
	});

	it('holdはstatus:pendingを書き込む（断る扱いにはならない）', async () => {
		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		await act(async () => {
			await result.current.resolveDecision('item-1', 'hold');
		});

		const call = vi.mocked(CloudYoukanRepository.updateItem).mock.calls.find(c => c[0] === 'item-1' && (c[1] as any).status);
		expect(call?.[1]).toMatchObject({ status: 'pending' });
	});

	it('断る(no)はstatus:cancelledを書き込む（旧バグ: status:doneにはならない）', async () => {
		const { result } = renderHook(() => useYoukanViewModel());
		await waitForLoad();

		await act(async () => {
			await result.current.resolveDecision('item-1', 'no', 'history');
		});

		const call = vi.mocked(CloudYoukanRepository.updateItem).mock.calls.find(c => c[0] === 'item-1' && (c[1] as any).status);
		expect(call?.[1]).toMatchObject({ status: 'cancelled' });
		expect((call?.[1] as any).status).not.toBe('done');
	});
});
