import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiClient } from '../client';

/**
 * R-085: 500エラー時のトースト文言改善
 *
 * バックエンド(BaseController::updateEntity)がPDOException発生時に返す
 * `{ error: 'Database Error during update' }` のような技術的な生メッセージが
 * そのままトースト（`API通信エラー PUT /items/{id}: Database Error during update`）に
 * 表示され、利用者には原因が分からず不安を与えていた。
 * 500番台のエラーは原因を問わず、利用者向けの分かりやすい文言に差し替える。
 */
describe('ApiClient — 500エラー時のユーザー向けメッセージ改善', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('500エラーはバックエンドの生メッセージではなく、分かりやすい文言に差し替える', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'Database Error during update' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			})
		));

		await expect(ApiClient.request('PUT', '/items/abc', {})).rejects.toThrow(
			'通信エラーが発生しました。しばらくしてから再度お試しください。'
		);
	});

	it('500エラーでもHTTPステータスコードはstatusに保持される', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'Database Error during update' }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' },
			})
		));

		let caught: unknown;
		try {
			await ApiClient.request('PUT', '/items/abc', {});
		} catch (err) {
			caught = err;
		}

		expect((caught as Error & { status?: number }).status).toBe(500);
	});

	it('4xxエラーは従来通りバックエンドの具体的なメッセージをそのまま伝える(既存挙動を維持)', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'Dependency already exists' }), {
				status: 409,
				headers: { 'Content-Type': 'application/json' },
			})
		));

		await expect(ApiClient.request('POST', '/dependencies', {})).rejects.toThrow('Dependency already exists');
	});
});
