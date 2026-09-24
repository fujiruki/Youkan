/**
 * R-164: docs/SPEC/16_改善要望4件バンドル.md §2
 * 2b: 初回同期でcreated/updatedがあれば一覧を1回再取得する
 * 2a: 同一見積行のfactory/site 2件のwork_packageを全体一覧で区別できる表示ラベル
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useBeaverIntegration, workPackageCategoryLabel } from '../useBeaverIntegration';
import { BeaverApi } from '@/api/beaver';

vi.mock('@/api/beaver', async (importOriginal) => {
	const actual = await importOriginal<typeof import('@/api/beaver')>();
	return {
		...actual,
		BeaverApi: {
			sync: vi.fn(),
			getOverview: vi.fn().mockResolvedValue({ links: [], lastSyncedAt: null, lastError: null }),
		},
	};
});

const syncResult = (created: number, updated: number) => ({
	synced: true, created, updated, skipped: false, lastSyncedAt: 1, error: null,
});

describe('useBeaverIntegration 初回同期後の再取得 (R-164 2b)', () => {
	beforeEach(() => {
		vi.mocked(BeaverApi.sync).mockReset();
	});

	it('created>0 のとき onSynced を1回呼ぶ', async () => {
		vi.mocked(BeaverApi.sync).mockResolvedValue(syncResult(3, 0));
		const onSynced = vi.fn();
		const { rerender } = renderHook(() => useBeaverIntegration(onSynced));
		rerender();
		await waitFor(() => expect(onSynced).toHaveBeenCalledTimes(1));
	});

	it('updated>0 のとき onSynced を呼ぶ', async () => {
		vi.mocked(BeaverApi.sync).mockResolvedValue(syncResult(0, 2));
		const onSynced = vi.fn();
		renderHook(() => useBeaverIntegration(onSynced));
		await waitFor(() => expect(onSynced).toHaveBeenCalledTimes(1));
	});

	it('created/updated がともに0なら呼ばない', async () => {
		vi.mocked(BeaverApi.sync).mockResolvedValue(syncResult(0, 0));
		const onSynced = vi.fn();
		renderHook(() => useBeaverIntegration(onSynced));
		await waitFor(() => expect(BeaverApi.getOverview).toHaveBeenCalled());
		expect(onSynced).not.toHaveBeenCalled();
	});

	it('同期失敗時は呼ばない', async () => {
		vi.mocked(BeaverApi.sync).mockRejectedValue(new Error('x'));
		const onSynced = vi.fn();
		renderHook(() => useBeaverIntegration(onSynced));
		await waitFor(() => expect(BeaverApi.getOverview).toHaveBeenCalled());
		expect(onSynced).not.toHaveBeenCalled();
	});
});

describe('workPackageCategoryLabel (R-164 2a)', () => {
	it('factory/site を日本語化し、未知値はそのまま返す', () => {
		expect(workPackageCategoryLabel('factory')).toBe('工場');
		expect(workPackageCategoryLabel('site')).toBe('現場');
		expect(workPackageCategoryLabel('paint')).toBe('paint');
		expect(workPackageCategoryLabel(null)).toBeNull();
	});
});
