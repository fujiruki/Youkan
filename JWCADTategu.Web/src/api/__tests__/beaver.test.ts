import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BeaverApi } from '../beaver';
import { ApiClient } from '../client';

describe('BeaverApi', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	describe('sync', () => {
		it('POST /integrations/beaver/sync を mode/force ボディ・silent 付きで呼ぶ', async () => {
			const requestSpy = vi
				.spyOn(ApiClient, 'request')
				.mockResolvedValueOnce({ synced: 2, created: 1, updated: 1, skipped: false, last_synced_at: 1756100000, error: null });

			const res = await BeaverApi.sync('full', true);

			expect(requestSpy).toHaveBeenCalledWith('POST', '/integrations/beaver/sync', { mode: 'full', force: true }, true);
			expect(res.skipped).toBe(false);
			expect(res.lastSyncedAt).toBe(1756100000);
		});
	});

	describe('getOverview', () => {
		it('GET /integrations/beaver/overview を呼び snake_case を camelCase に変換して返す', async () => {
			const requestSpy = vi.spyOn(ApiClient, 'request').mockResolvedValueOnce({
				links: [{
					external_project_id: 123,
					youkan_project_id: 'p1',
					name: '玄関引戸',
					source_status: '製造中',
					sync_state: 'ok',
					delivery_date: '2026-09-10',
					baseline_minutes: 1200,
					baseline_source: 'estimate',
					feasibility: {
						feasible: false,
						shortage_minutes: 180,
						earliest_completion_date: '2026-09-12',
						deadline: '2026-09-10',
						message: '9/10納期では3h不足（9/12なら入る）'
					}
				}],
				last_synced_at: 1756100000,
				last_error: null
			});

			const res = await BeaverApi.getOverview();

			expect(requestSpy).toHaveBeenCalledWith('GET', '/integrations/beaver/overview', undefined, true);
			expect(res.lastSyncedAt).toBe(1756100000);
			expect(res.lastError).toBeNull();
			expect(res.links[0]).toMatchObject({
				externalProjectId: 123,
				youkanProjectId: 'p1',
				sourceStatus: '製造中',
				syncState: 'ok',
				baselineMinutes: 1200,
			});
			expect(res.links[0].feasibility).toMatchObject({
				feasible: false,
				shortageMinutes: 180,
				earliestCompletionDate: '2026-09-12',
				message: '9/10納期では3h不足（9/12なら入る）'
			});
		});

		it('feasibility が null のリンクも扱える', async () => {
			vi.spyOn(ApiClient, 'request').mockResolvedValueOnce({
				links: [{
					external_project_id: 1,
					youkan_project_id: 'p1',
					name: 'A',
					source_status: 'キャンセル',
					sync_state: 'ok',
					delivery_date: null,
					baseline_minutes: null,
					baseline_source: 'none',
					feasibility: null
				}],
				last_synced_at: null,
				last_error: null
			});

			const res = await BeaverApi.getOverview();
			expect(res.links[0].feasibility).toBeNull();
			expect(res.lastSyncedAt).toBeNull();
		});
	});
});
