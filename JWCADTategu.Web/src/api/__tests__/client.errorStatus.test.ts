import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiClient } from '../client';

/**
 * R-077: API エラー時、呼び出し元が HTTP ステータスコードで分岐できるようにする
 *
 * バックエンド（BaseController::sendError）は `{ error: message }` 形式で返すが、
 * 従来の ApiClient は `errorData.message`（存在しないキー）しか見ておらず、
 * 常に汎用文言 `API Error: {status}` にフォールバックしていた。
 * さらに、投げる Error に status を持たせていなかったため、呼び出し元は
 * 特定のステータスコード（例: 409 = 既に存在する）を判別できなかった。
 */
describe('ApiClient — エラーレスポンスのステータス・メッセージ伝達', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('バックエンドの { error: message } を Error.message に反映する', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'Dependency already exists' }), {
				status: 409,
				headers: { 'Content-Type': 'application/json' },
			})
		));

		await expect(ApiClient.request('POST', '/dependencies', {})).rejects.toThrow('Dependency already exists');
	});

	it('投げられる Error に HTTP ステータスコードを status として持たせる', async () => {
		vi.stubGlobal('fetch', vi.fn().mockResolvedValue(
			new Response(JSON.stringify({ error: 'Dependency already exists' }), {
				status: 409,
				headers: { 'Content-Type': 'application/json' },
			})
		));

		let caught: unknown;
		try {
			await ApiClient.request('POST', '/dependencies', {});
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(Error);
		expect((caught as Error & { status?: number }).status).toBe(409);
	});
});
