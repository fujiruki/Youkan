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
	});
});
