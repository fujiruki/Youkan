// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGlobalBoardViewModel } from '../useGlobalBoardViewModel';
import { JudgableItem } from '../../jbwos-core/types';

// Mock the Adapter class specifically
// We want to verify that the ViewModel uses the Adapter correctly.
// Since the ViewModel instantiates the adapter internally (as a singleton in module scope),
// we need to mock the module path.

// Shared mock implementations
const mockMethods = vi.hoisted(() => ({
    fetchItems: vi.fn(),
    updateItemStatus: vi.fn(),
}));

// Mock the Adapter Module
vi.mock('../../adapters/tategu-jbwos', () => {
    return {
        TateguJBWOSAdapter: class {
            fetchItems = mockMethods.fetchItems;
            updateItemStatus = mockMethods.updateItemStatus;
        }
    };
});

// Mock Data (Generic Items now)
const mockItems: JudgableItem[] = [
    { id: 1, title: 'Item A', status: 'ready', tags: ['Project A'] },
    { id: 2, title: 'Item B', status: 'ready', tags: ['Project A'] },
    { id: 3, title: 'Item C', status: 'inbox', tags: ['Project B'] },
];

describe('useGlobalBoardViewModel (Refactored)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // Mock window.confirm
        global.confirm = vi.fn(() => true);
    });

    it('Should load items via Adapter', async () => {
        mockMethods.fetchItems.mockResolvedValue(mockItems);

        const { result } = renderHook(() => useGlobalBoardViewModel());

        // Wait for effect
        await act(async () => { await new Promise(r => setTimeout(r, 10)); });

        expect(mockMethods.fetchItems).toHaveBeenCalled();
        expect(result.current.readyItems.length).toBe(2);
        expect(result.current.inboxItems.length).toBe(1);
    });

    it('Should block logic via Core Engine', async () => {
        // Core Logic is tested separately ideally, but integration test here confirms wiring.
        mockMethods.fetchItems.mockResolvedValue(mockItems); // 2 ready items

        const { result } = renderHook(() => useGlobalBoardViewModel());
        await act(async () => { await new Promise(r => setTimeout(r, 10)); });

        // Try to add 3rd
        let error;
        try {
            await act(async () => {
                await result.current.moveDoorToStatus(3, 'ready');
            });
        } catch (e: any) {
            error = e;
        }

        expect(error).toBeDefined();
        // Adapter should NOT be called for update
        expect(mockMethods.updateItemStatus).not.toHaveBeenCalled();
    });

    it('Should call Adapter update on valid move', async () => {
        mockMethods.fetchItems.mockResolvedValue(mockItems);
        const { result } = renderHook(() => useGlobalBoardViewModel());
        await act(async () => { await new Promise(r => setTimeout(r, 10)); });

        // Move item 1 from Ready to Done (Valid)
        await act(async () => {
            await result.current.moveDoorToStatus(1, 'done');
        });

        expect(mockMethods.updateItemStatus).toHaveBeenCalledWith(1, 'done');
        expect(result.current.readyItems.length).toBe(1); // Optimistic update check
    });
});
