import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useVolumeCalendarViewModel } from './useVolumeCalendarViewModel';
import { ApiClient } from '../../../../api/client';

/**
 * R-151: currentDate 連続変化時の世代キャンセル
 *
 * 仕様（03_画面設計.md §5.1）:
 * currentDate 変更によるデータ取得は AbortController で前世代を中断し、
 * 遅れて届いた前世代の応答は state に反映しない（最後の1世代のみ有効）。
 */

vi.mock('../../youkan/hooks/useCapacityConfig', () => {
	const noop = () => { };
	return {
		useCapacityConfig: () => ({
			capacityConfig: null,
			refreshCapacityConfig: noop,
			toggleHoliday: noop,
			updateCapacityConfig: noop
		})
	};
});

interface CapturedCall {
	path: string;
	signal: AbortSignal | undefined;
	resolve: (value: any) => void;
}

describe('R-151: useVolumeCalendarViewModel 世代キャンセル', () => {
	const calls: CapturedCall[] = [];

	beforeEach(() => {
		calls.length = 0;
		vi.spyOn(ApiClient, 'request').mockImplementation(
			((_method: string, path: string, _body?: any, _silent?: boolean, signal?: AbortSignal) => {
				return new Promise((resolve) => {
					calls.push({ path, signal, resolve });
				});
			}) as any
		);
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('currentDate 変更で前世代のリクエストが abort される', async () => {
		const { result } = renderHook(() => useVolumeCalendarViewModel({}));

		await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(4));
		const gen1 = calls.slice(0, 4);

		// 全リクエストに AbortSignal が渡っていること
		gen1.forEach(c => expect(c.signal).toBeDefined());
		expect(gen1[0].signal!.aborted).toBe(false);

		act(() => {
			result.current.setCurrentDate(new Date(2026, 0, 15));
		});

		await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(8));

		// 前世代は abort 済み、新世代は生きている
		gen1.forEach(c => expect(c.signal!.aborted).toBe(true));
		const gen2 = calls.slice(4, 8);
		gen2.forEach(c => expect(c.signal!.aborted).toBe(false));
	});

	it('遅れて届いた前世代の応答は捨てられる（最後の世代だけが items に反映される）', async () => {
		const { result } = renderHook(() => useVolumeCalendarViewModel({}));

		await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(4));
		const gen1 = calls.slice(0, 4);

		act(() => {
			result.current.setCurrentDate(new Date(2026, 0, 15));
		});
		await waitFor(() => expect(calls.length).toBeGreaterThanOrEqual(8));
		const gen2 = calls.slice(4, 8);

		// 新世代を先に解決（Promise.all の並び: items / completed / members / projects）
		await act(async () => {
			gen2[0].resolve([{ id: 'new-item' }]);
			gen2[1].resolve([]);
			gen2[2].resolve([]);
			gen2[3].resolve([]);
		});
		await waitFor(() => expect((result.current.items[0] as any)?.id).toBe('new-item'));

		// 前世代が遅れて解決しても items は上書きされない
		await act(async () => {
			gen1[0].resolve([{ id: 'stale-item' }]);
			gen1[1].resolve([]);
			gen1[2].resolve([]);
			gen1[3].resolve([]);
		});

		expect((result.current.items[0] as any)?.id).toBe('new-item');
	});
});
