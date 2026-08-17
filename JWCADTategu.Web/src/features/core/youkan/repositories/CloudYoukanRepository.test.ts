import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CloudYoukanRepository } from './CloudYoukanRepository';
import { ApiClient } from '../../../../api/client';

vi.mock('../../../../api/client', () => ({
	ApiClient: {
		getAllItems: vi.fn(),
		createItem: vi.fn(),
		updateItem: vi.fn(),
		deleteItem: vi.fn(),
	}
}));

describe('CloudYoukanRepository', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('getGdbShelf', () => {
		const mockItems = [
			{ id: '1', title: 'Task 1', status: 'inbox' },
			{ id: '2', title: 'Task 2', status: 'focus' },
			{ id: '3', title: 'Task 3', status: 'waiting' },
			{ id: '4', title: 'Task 4', status: 'done' },
		];

		it('プロジェクトID未指定時はdashboardスコープで取得する', async () => {
			vi.mocked(ApiClient.getAllItems).mockResolvedValue(mockItems as any);

			await CloudYoukanRepository.getGdbShelf();

			expect(ApiClient.getAllItems).toHaveBeenCalledWith({ scope: 'dashboard' });
		});

		it('プロジェクトID指定時はproject_idをAPIに渡す', async () => {
			vi.mocked(ApiClient.getAllItems).mockResolvedValue(mockItems as any);

			const projectId = 'proj-001';
			await CloudYoukanRepository.getGdbShelf(projectId);

			expect(ApiClient.getAllItems).toHaveBeenCalledWith(
				expect.objectContaining({ project_id: projectId })
			);
		});

		it('プロジェクトID指定時はaggregatedスコープを使用する', async () => {
			vi.mocked(ApiClient.getAllItems).mockResolvedValue(mockItems as any);

			const projectId = 'proj-001';
			await CloudYoukanRepository.getGdbShelf(projectId);

			expect(ApiClient.getAllItems).toHaveBeenCalledWith(
				expect.objectContaining({ scope: 'aggregated' })
			);
		});

		it('アイテムをステータス別に正しく分類する', async () => {
			vi.mocked(ApiClient.getAllItems).mockResolvedValue(mockItems as any);

			const shelf = await CloudYoukanRepository.getGdbShelf();

			expect(shelf.active).toHaveLength(2);
			expect(shelf.preparation).toHaveLength(1);
			expect(shelf.log).toHaveLength(1);
		});

		// R-124: 「断る」判断の結果(cancelled)がどのバケットにも一致せずシェルフから
		// 完全に消えていた（全体一覧から却下アイテムが消える不具合の直接原因）。
		// log（履歴）バケットに分類され続けることを保証する。旧レガシー値
		// decision_rejected（DB書き換えをしていない既存データ）も表示互換として同様に扱う。
		it('status:cancelledのアイテムはlogバケットに分類される（全体一覧から消えない）', async () => {
			const items = [
				{ id: '10', title: 'Cancelled Task', status: 'cancelled' },
			];
			vi.mocked(ApiClient.getAllItems).mockResolvedValue(items as any);

			const shelf = await CloudYoukanRepository.getGdbShelf();

			expect(shelf.log.map(i => i.id)).toContain('10');
		});

		it('レガシーstatus:decision_rejectedのアイテムもlogバケットに分類される（表示互換）', async () => {
			const items = [
				{ id: '11', title: 'Legacy Rejected Task', status: 'decision_rejected' },
			];
			vi.mocked(ApiClient.getAllItems).mockResolvedValue(items as any);

			const shelf = await CloudYoukanRepository.getGdbShelf();

			expect(shelf.log.map(i => i.id)).toContain('11');
		});
	});
});
