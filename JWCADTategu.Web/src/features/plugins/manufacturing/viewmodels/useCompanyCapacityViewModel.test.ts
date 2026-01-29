import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCompanyCapacityViewModel } from './useCompanyCapacityViewModel';
import { ApiClient } from '../../../../api/client';

// Mock ApiClient
vi.mock('../../../../api/client', () => ({
    ApiClient: {
        getCompanyMembers: vi.fn(),
        getAllItems: vi.fn(),
        getManufacturingItem: vi.fn(),
    },
}));

describe('useCompanyCapacityViewModel', () => {
    const mockMembers = [
        { id: 'cm1', daily_capacity_minutes: 480, is_core_member: 1 },
        { id: 'cm2', daily_capacity_minutes: 480, is_core_member: 1 }
    ];

    const mockItems = [
        { id: 'item_1', due_date: '2026-02-10' },
        { id: 'item_2', due_date: '2026-02-10' }
    ];

    const mockMfgData = {
        item_1: { fab_minutes: 120, site_minutes: 60 },
        item_2: { fab_minutes: 180, site_minutes: 0 }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calculates total capacity and daily occupancy', async () => {
        (ApiClient.getCompanyMembers as any).mockResolvedValue(mockMembers);
        (ApiClient.getAllItems as any).mockResolvedValue(mockItems);
        (ApiClient.getManufacturingItem as any).mockImplementation((id: string) => {
            return Promise.resolve(mockMfgData[id as keyof typeof mockMfgData] || {});
        });

        const { result } = renderHook(() => useCompanyCapacityViewModel('2026-02'));

        await waitFor(() => expect(result.current.loading).toBe(false));

        // Total capacity: 480 * 2 = 960
        expect(result.current.totalDailyCapacity).toBe(960);

        // Occupancy for 2026-02-10: (120+60) + (180+0) = 360
        const stats = result.current.getDailyStats('2026-02-10');
        expect(stats.occupancy).toBe(360);
        expect(stats.fullnessPercentage).toBe(Math.round((360 / 960) * 100));
    });
});
