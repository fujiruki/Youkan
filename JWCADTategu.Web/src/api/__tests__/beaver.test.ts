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
					source_name: '玄関引戸',
					source_status: '製造中',
					sync_state: 'ok',
					source_delivery_date: '2026-09-10',
					baseline_minutes: 1200,
					baseline_source: 'estimate',
					check: {
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
				name: '玄関引戸',
				sourceStatus: '製造中',
				syncState: 'ok',
				deliveryDate: '2026-09-10',
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
					source_name: 'A',
					source_status: 'キャンセル',
					sync_state: 'ok',
					source_delivery_date: null,
					baseline_minutes: null,
					baseline_source: 'none',
					check: null
				}],
				last_synced_at: null,
				last_error: null
			});

			const res = await BeaverApi.getOverview();
			expect(res.links[0].feasibility).toBeNull();
			expect(res.lastSyncedAt).toBeNull();
		});

		it('バックエンド実応答（source_name/source_delivery_date/check）を正しくマッピングする', async () => {
			// BeaverCapacityService::buildOverview() の実応答形（backend/services/BeaverCapacityService.php 100〜113行目）
			vi.spyOn(ApiClient, 'request').mockResolvedValueOnce({
				links: [{
					external_project_id: 123,
					youkan_project_id: 'p1',
					source_name: '玄関引戸',
					source_code: 'P00123',
					source_customer_name: '顧客A',
					source_status: '製造中',
					source_delivery_date: '2026-09-10',
					baseline_minutes: 1200,
					baseline_source: 'estimate',
					sync_state: 'ok',
					load: { baseline: 1200, decomposed: 900, effective_total: 1200, completed: 0, remaining: 1200, placed: 300, unplaced: 900 },
					check: {
						external_project_id: 123,
						feasible: false,
						deadline: '2026-09-10',
						required_minutes: 1200,
						placed_minutes: 300,
						unplaced_minutes: 900,
						shortage_minutes: 180,
						earliest_completion_date: '2026-09-12',
						saturated_through: '2026-09-05',
						message: '9/10納期では3h不足（9/12なら入る）',
					},
				}],
				last_synced_at: 1756100000,
				last_error: null
			});

			const res = await BeaverApi.getOverview();

			expect(res.links[0].name).toBe('玄関引戸');
			expect(res.links[0].deliveryDate).toBe('2026-09-10');
			expect(res.links[0].feasibility).toMatchObject({
				feasible: false,
				shortageMinutes: 180,
				earliestCompletionDate: '2026-09-12',
				deadline: '2026-09-10',
				message: '9/10納期では3h不足（9/12なら入る）',
			});
		});
	});
});
