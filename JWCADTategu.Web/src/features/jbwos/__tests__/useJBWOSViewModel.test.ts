import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useJBWOSViewModel } from '../viewmodels/useJBWOSViewModel';
import { JBWOSRepository } from '../repositories/JBWOSRepository';
import { renderHook, act, waitFor } from '@testing-library/react';

// Mock DB interactions
vi.mock('../repositories/JBWOSRepository');

describe('useJBWOSViewModel', () => {
    let mockRepo: any;

    beforeEach(() => {
        vi.clearAllMocks();
        mockRepo = new JBWOSRepository();
        // Setup default mock returns
        mockRepo.getItemsByStatus.mockResolvedValue([]);
        mockRepo.addItemToInbox.mockResolvedValue(undefined);
        mockRepo.updateStatus.mockResolvedValue(undefined);

        // Mock the repository instance used by the hook
        // This part depends on how DI is handled. For simple hooks, we might need a context or factory.
        // For MVP, assume direct instantiation or simple module mock.
    });

    it('should fetch Inbox items sorted by interrupt and statusUpdatedAt', async () => {
        // Mock data
        const items: any[] = [
            { id: '1', title: 'Normal', status: 'inbox', interrupt: false, statusUpdatedAt: 100 },
            { id: '2', title: 'Interrupt', status: 'inbox', interrupt: true, statusUpdatedAt: 200 }
        ];
        mockRepo.getItemsByStatus.mockResolvedValue(items);

        const { result } = renderHook(() => useJBWOSViewModel());

        // Initial fetch is async, wait for it
        await waitFor(() => expect(result.current.inboxItems).toHaveLength(2));

        // Assert sorting logic (handled by Repo usually, but checking VM passthrough)
        expect(result.current.inboxItems).toEqual(items);
    });

    it('should throw items into inbox', async () => {
        const { result } = renderHook(() => useJBWOSViewModel());

        await act(async () => {
            await result.current.throwIn('New Task');
        });

        expect(mockRepo.addItemToInbox).toHaveBeenCalledWith('New Task');
        // Should trigger refetch
        expect(mockRepo.getItemsByStatus).toHaveBeenCalledTimes(2); // Initial + After Add
    });

    it('should allow moving to Ready if count < 2', async () => {
        // Setup empty Ready
        mockRepo.getItemsByStatus.mockImplementation((status: string) => {
            if (status === 'ready') return Promise.resolve([]);
            if (status === 'inbox') return Promise.resolve([{ id: '1', title: 'Task', status: 'inbox' }]);
            return Promise.resolve([]);
        });

        const { result } = renderHook(() => useJBWOSViewModel());
        await waitFor(() => expect(result.current.inboxItems).toHaveLength(1));

        await act(async () => {
            await result.current.moveToReady('1');
        });

        expect(mockRepo.updateStatus).toHaveBeenCalledWith('1', 'ready');
    });

    it('should BLOCK moving to Ready if count >= 2', async () => {
        // Setup full Ready
        mockRepo.getItemsByStatus.mockImplementation((status: string) => {
            if (status === 'ready') return Promise.resolve([
                { id: 'r1', status: 'ready' },
                { id: 'r2', status: 'ready' }
            ]);
            return Promise.resolve([]);
        });

        const { result } = renderHook(() => useJBWOSViewModel());
        await waitFor(() => expect(result.current.readyItems).toHaveLength(2));

        // Act & Assert
        await act(async () => {
            // Should catch error or handle gracefully
            await expect(result.current.moveToReady('new_id')).rejects.toThrow('Ready bucket is full');
        });

        expect(mockRepo.updateStatus).not.toHaveBeenCalled();
    });
});
