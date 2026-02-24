import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSubtasks } from '../useSubtasks';
import { ApiClient } from '../../../../../api/client';

describe('useSubtasks', () => {
    const parentId = 'parent-123';

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should create subtask with initial due date', async () => {
        // Spy on static methods directly
        const getAllItemsSpy = vi.spyOn(ApiClient, 'getAllItems');
        const createItemSpy = vi.spyOn(ApiClient, 'createItem');

        const initialDueDate = 1735689600; // 2025-01-01
        const title = 'Test Subtask';
        const expectedItem = {
            id: 'new-id',
            title,
            due_date: initialDueDate,
            parentId,
            createdAt: 1000
        };

        // First call returns empty (initial load), second call returns the new item
        // Use mockResolvedValue (or mockImplementation)
        getAllItemsSpy
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([expectedItem])
            .mockResolvedValue([expectedItem]); // fallback

        createItemSpy.mockResolvedValue({ id: 'new-id', success: true });

        const { result } = renderHook(() => useSubtasks(parentId));

        await act(async () => {
            // @ts-ignore
            await result.current.addSubtask(title, { due_date: initialDueDate });
        });

        // Verify optimistic update (or final state after refresh)
        const addedTask = result.current.subtasks.find(t => t.title === title);

        // Debug
        console.log('Subtasks:', result.current.subtasks);

        expect(addedTask).toBeDefined();
        // @ts-ignore
        expect(addedTask?.due_date).toBe(initialDueDate);

        // Verify API call
        expect(createItemSpy).toHaveBeenCalledWith(expect.objectContaining({
            title: title,
            parentId: parentId,
            due_date: initialDueDate
        }));
    });
});
