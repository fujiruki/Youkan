import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YoukanRepository } from './YoukanRepository';
import { ApiClient } from '../../../../api/client';


// Mock ApiClient
vi.mock('../../../../api/client', () => ({
    ApiClient: {
        getAllItems: vi.fn(),
        createItem: vi.fn(),
        updateItem: vi.fn(),
        deleteItem: vi.fn(),
    }
}));

// Mock DB (Dexie) - Mocking simple array returns for verification
vi.mock('../../../../db/db', () => ({
    db: {
        doors: {
            where: () => ({
                equals: () => ({
                    toArray: vi.fn().mockResolvedValue([])
                })
            }),
            update: vi.fn(),
            delete: vi.fn()
        },
        projects: {
            get: vi.fn(),
            update: vi.fn()
        }
    }
}));

describe('YoukanRepository', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('getItemsByStatus', () => {
        it('should return items from API when API call succeeds', async () => {
            const mockApiItems = [
                { id: '1', title: 'Task 1', status: 'inbox', statusUpdatedAt: 1000 },
                { id: '2', title: 'Task 2', status: 'inbox', statusUpdatedAt: 2000 }
            ];

            vi.mocked(ApiClient.getAllItems).mockResolvedValue(mockApiItems as any);

            const result = await YoukanRepository.getItemsByStatus('inbox');

            expect(ApiClient.getAllItems).toHaveBeenCalledTimes(1);
            expect(result).toHaveLength(2);
            expect(result[0].id).toBe('2'); // Sorted by updatedAt desc
        });

        it('should handle API errors gracefully (return empty or partial) without throwing', async () => {
            // Simulate 500 Error
            vi.mocked(ApiClient.getAllItems).mockRejectedValue(new Error('500 Internal Server Error'));

            // Console error might be called, spy on it to suppress output during test
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

            // Should not throw
            const result = await YoukanRepository.getItemsByStatus('inbox');

            expect(ApiClient.getAllItems).toHaveBeenCalledTimes(1);
            // Expecting empty array from API part, merged with local (which is mocked empty)
            expect(result).toEqual([]);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });

    describe('addItemToInbox', () => {
        it('should call ApiClient.createItem', async () => {
            vi.mocked(ApiClient.createItem).mockResolvedValue({ id: "new-id", success: true });

            const title = 'New Task';
            const id = await YoukanRepository.addItemToInbox(title);

            expect(ApiClient.createItem).toHaveBeenCalled();
            expect(id).toBeDefined();
        });

        it('should not throw if ApiClient.createItem fails', async () => {
            vi.mocked(ApiClient.createItem).mockRejectedValue(new Error('Network Error'));
            const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { });

            const id = await YoukanRepository.addItemToInbox('Fail Task');

            expect(id).toBeDefined(); // Still returns ID optimistically
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
