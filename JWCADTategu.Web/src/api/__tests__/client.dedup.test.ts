import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from '../client';

/**
 * R-044: 起動時 API 重複発火の統合
 *
 * GET リクエストの in-flight dedup:
 * 同一 URL への GET が同時に飛んだ場合、後発リクエストは
 * 先発の Promise に乗り、HTTP fetch は 1 回に集約される。
 */
describe('ApiClient — in-flight dedup (R-044)', () => {
	let fetchMock: ReturnType<typeof vi.fn>;
	let resolvers: Array<(value: any) => void>;

	const makeResponse = (data: any) =>
		new Response(JSON.stringify(data), {
			status: 200,
			headers: { 'Content-Type': 'application/json' },
		});

	beforeEach(() => {
		resolvers = [];
		fetchMock = vi.fn(() =>
			new Promise<Response>((resolve) => {
				resolvers.push(() => resolve(makeResponse({ ok: true })));
			})
		);
		vi.stubGlobal('fetch', fetchMock);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('同一パスへの並行 GET は HTTP fetch を 1 回に集約する（/auth/me）', async () => {
		const p1 = ApiClient.request('GET', '/auth/me');
		const p2 = ApiClient.request('GET', '/auth/me');
		const p3 = ApiClient.request('GET', '/auth/me');

		expect(fetchMock).toHaveBeenCalledTimes(1);

		resolvers[0]();

		const [r1, r2, r3] = await Promise.all([p1, p2, p3]);
		expect(r1).toEqual({ ok: true });
		expect(r2).toEqual({ ok: true });
		expect(r3).toEqual({ ok: true });
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('同一パスへの並行 GET は HTTP fetch を 1 回に集約する（/items?scope=aggregated）', async () => {
		const p1 = ApiClient.request('GET', '/items?scope=aggregated');
		const p2 = ApiClient.request('GET', '/items?scope=aggregated');

		expect(fetchMock).toHaveBeenCalledTimes(1);

		resolvers[0]();
		await Promise.all([p1, p2]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('同一パスへの並行 GET は HTTP fetch を 1 回に集約する（/health）', async () => {
		const p1 = ApiClient.request('GET', '/health', undefined, true);
		const p2 = ApiClient.request('GET', '/health', undefined, true);

		expect(fetchMock).toHaveBeenCalledTimes(1);

		resolvers[0]();
		await Promise.all([p1, p2]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('クエリ違いの GET は別リクエスト扱い', async () => {
		const p1 = ApiClient.request('GET', '/items?scope=aggregated');
		const p2 = ApiClient.request('GET', '/items?scope=dashboard');

		expect(fetchMock).toHaveBeenCalledTimes(2);

		resolvers[0]();
		resolvers[1]();
		await Promise.all([p1, p2]);
	});

	it('完了後の同一パス GET は再度 fetch する（短いウィンドウのみ dedup）', async () => {
		const p1 = ApiClient.request('GET', '/auth/me');
		expect(fetchMock).toHaveBeenCalledTimes(1);
		resolvers[0]();
		await p1;

		const p2 = ApiClient.request('GET', '/auth/me');
		expect(fetchMock).toHaveBeenCalledTimes(2);
		resolvers[1]();
		await p2;
	});

	it('POST は dedup されない（副作用あり）', async () => {
		const p1 = ApiClient.request('POST', '/auth/login', { email: 'a' });
		const p2 = ApiClient.request('POST', '/auth/login', { email: 'b' });

		expect(fetchMock).toHaveBeenCalledTimes(2);

		resolvers[0]();
		resolvers[1]();
		await Promise.all([p1, p2]);
	});
});
