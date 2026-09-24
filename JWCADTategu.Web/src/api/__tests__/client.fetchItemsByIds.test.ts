import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiClient } from '../client';

describe('ApiClient.fetchItemsByIds — R-0167', () => {
	afterEach(() => {
		ApiClient.setErrorHandler(null as any);
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it('ゴミ箱内・アクセス不可の子孫(404)はスキップし、エラートーストを出さない', async () => {
		const handler = vi.fn();
		ApiClient.setErrorHandler(handler);
		vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
			if (String(url).endsWith('/items/trashed')) {
				return Promise.resolve(new Response(JSON.stringify({ error: 'Item not found or access denied' }), { status: 404, headers: { 'Content-Type': 'application/json' } }));
			}
			return Promise.resolve(new Response(JSON.stringify({ id: 'alive', title: 'a' }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
		}));

		const result = await ApiClient.fetchItemsByIds(['alive', 'trashed']);

		expect(result.map(i => i.id)).toEqual(['alive']);
		expect(handler).not.toHaveBeenCalled();
	});
});
