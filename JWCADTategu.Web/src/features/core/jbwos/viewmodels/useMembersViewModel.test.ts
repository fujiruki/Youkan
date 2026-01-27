import { renderHook, act, waitFor } from '@testing-library/react'; // CORRECT IMPORTS
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useMembersViewModel } from './useMembersViewModel';
import { ApiClient } from '../../../../api/client';
import { Member } from '../types';

// Mock ApiClient
vi.mock('../../../../api/client', () => ({
    ApiClient: {
        getMembers: vi.fn(),
        updateMember: vi.fn(),
    },
}));

describe('useMembersViewModel', () => {
    const mockMembers: Member[] = [
        {
            id: 'rel_1',
            userId: 'usr_1',
            display_name: 'User 1',
            role: 'admin',
            isCore: true,
            dailyCapacityMinutes: 480
        },
        {
            id: 'rel_2',
            userId: 'usr_2',
            display_name: 'User 2',
            role: 'member',
            isCore: false,
            dailyCapacityMinutes: 420
        }
    ];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('fetches members on mount', async () => {
        (ApiClient.getMembers as any).mockResolvedValue(mockMembers);

        const { result } = renderHook(() => useMembersViewModel());

        // Initially loading
        expect(result.current.loading).toBe(true);

        // Wait for data
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.members).toEqual(mockMembers);
        });
    });

    it('updates member optimistically and calls API', async () => {
        (ApiClient.getMembers as any).mockResolvedValue(mockMembers);
        (ApiClient.updateMember as any).mockResolvedValue({ success: true });

        const { result } = renderHook(() => useMembersViewModel());

        await waitFor(() => expect(result.current.loading).toBe(false));

        // Update 'isCore' for second member
        act(() => {
            result.current.updateMember('rel_2', { isCore: true });
        });

        // Verify Optimistic Update
        const updatedMember = result.current.members.find(m => m.id === 'rel_2');
        expect(updatedMember?.isCore).toBe(true);

        // Verify API Call
        expect(ApiClient.updateMember).toHaveBeenCalledWith('rel_2', { isCore: true });
    });

    it('reverts optimistic update on API failure', async () => {
        (ApiClient.getMembers as any).mockResolvedValue(mockMembers);
        (ApiClient.updateMember as any).mockRejectedValue(new Error('API Error'));

        const { result } = renderHook(() => useMembersViewModel());

        await waitFor(() => expect(result.current.loading).toBe(false));

        // Update 'dailyCapacityMinutes'
        const originalCapacity = 420;
        act(() => {
            result.current.updateMember('rel_2', { dailyCapacityMinutes: 300 });
        });

        // Should be updated temporarily
        expect(result.current.members.find(m => m.id === 'rel_2')?.dailyCapacityMinutes).toBe(300);

        // Wait for rejection handling (you might need a small delay or way to detect error state)
        // Since it's async, we wait for the hook to re-render or error state to change.
        // Assuming hook catches error.

        await waitFor(() => {
            // Verify Revert
            expect(result.current.members.find(m => m.id === 'rel_2')?.dailyCapacityMinutes).toBe(originalCapacity);
            expect(result.current.error).toBe('Failed to update member');
        });
    });
});
