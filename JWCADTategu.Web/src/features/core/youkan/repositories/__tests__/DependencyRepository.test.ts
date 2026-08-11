import { describe, it, expect, vi, beforeEach } from 'vitest';

// setupTests.ts がテスト全体に DependencyRepository のモックを登録しているため、
// このファイルでは実装本体を検証したいので明示的に unmock する。
vi.unmock('@/features/core/youkan/repositories/DependencyRepository');

const mockRequest = vi.fn();
vi.mock('../../../../../api/client', () => ({
	ApiClient: {
		request: (...args: unknown[]) => mockRequest(...args),
	},
}));

import { DependencyRepository } from '../DependencyRepository';

/**
 * R-077: フローチャートで Enter キーによりノードを作成すると
 * 「ノード追加失敗 Error: API Error: 409」が表示される不具合の根本原因対応。
 *
 * 実機調査の結果、アイテム作成自体は成功しており、依存関係も既にバックエンド側で
 * 作成されていることが確認された（何らかの経路で同一の source/target 依存関係の
 * 作成が重複して試みられていた）。バックエンドは UNIQUE(source_item_id, target_item_id)
 * 制約違反を 409 "Dependency already exists" として返す仕様であり、これは
 * 「望む終状態（依存関係が存在する）が既に達成されている」ことを意味するため、
 * 呼び出し元にとってはエラーではなく成功として扱うべきである。
 *
 * この対応を DependencyRepository（全呼び出し元が経由する共通層）に集約することで、
 * createNodeBelow に限らず handleEdgeInsert・onNodeDragStop の自動接続・Ctrl+L の
 * 手動リンク作成など、依存関係作成を行うすべての経路が自動的に冪等になる。
 */
describe('DependencyRepository.createDependency — 重複作成(409)の冪等化', () => {
	beforeEach(() => {
		mockRequest.mockReset();
	});

	it('409 (Dependency already exists) の場合は例外を投げず、既存の依存関係を取得して返す', async () => {
		const conflictError = new Error('Dependency already exists') as Error & { status?: number };
		conflictError.status = 409;

		const existingDep = { id: 'dep-existing', sourceItemId: 'item-a', targetItemId: 'item-b', createdAt: 123 };

		mockRequest.mockImplementation((method: string, path: string) => {
			if (method === 'POST' && path === '/dependencies') {
				return Promise.reject(conflictError);
			}
			if (method === 'GET' && path === '/dependencies?item_id=item-a') {
				return Promise.resolve({ dependencies: [existingDep] });
			}
			throw new Error(`unexpected call: ${method} ${path}`);
		});

		const repo = new DependencyRepository();
		const result = await repo.createDependency('item-a', 'item-b');

		expect(result).toEqual(existingDep);
	});

	it('409以外のエラーはそのまま呼び出し元に投げる（回帰防止）', async () => {
		const serverError = new Error('API Error: 500') as Error & { status?: number };
		serverError.status = 500;
		mockRequest.mockRejectedValue(serverError);

		const repo = new DependencyRepository();
		await expect(repo.createDependency('item-a', 'item-b')).rejects.toThrow('API Error: 500');
	});

	it('正常時は従来通り作成された依存関係を返す（回帰防止）', async () => {
		const created = { id: 'dep-new', sourceItemId: 'item-a', targetItemId: 'item-b', createdAt: 456 };
		mockRequest.mockResolvedValue({ dependency: created });

		const repo = new DependencyRepository();
		const result = await repo.createDependency('item-a', 'item-b');

		expect(result).toEqual(created);
		expect(mockRequest).toHaveBeenCalledWith('POST', '/dependencies', {
			source_item_id: 'item-a',
			target_item_id: 'item-b',
		}, true);
	});
});
