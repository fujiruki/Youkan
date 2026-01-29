import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDashboardViewModel } from './useDashboardViewModel';
import { ApiClient } from '../../../../api/client';

// Mock ApiClient
vi.mock('../../../../api/client', () => ({
    ApiClient: {
        getTodayView: vi.fn(),
        getManufacturingItem: vi.fn(),
    },
}));

describe('useDashboardViewModel', () => {
    const mockTodayItems = [
        { id: 'item_1', title: 'Task 1' },
        { id: 'item_2', title: 'Task 2' }
    ];

    const mockMfgData = {
        item_1: { fab_minutes: 60, site_minutes: 30 },
        item_2: { fab_minutes: 45, site_minutes: 15 }
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('calculates total fabrication and site times for today items', async () => {
        (ApiClient.getTodayView as any).mockResolvedValue({ items: mockTodayItems });
        (ApiClient.getManufacturingItem as any).mockImplementation((id: string) => {
            return Promise.resolve(mockMfgData[id as keyof typeof mockMfgData] || {});
        });

        const { result } = renderHook(() => useDashboardViewModel());

        expect(result.current.loading).toBe(true);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            // 60 + 45 = 105
            expect(result.current.dailyTotalFabricationTime).toBe(105);
            // 30 + 15 = 45
            expect(result.current.dailyTotalSiteTime).toBe(45);
        });
    });

    it('toggles group by status setting', () => {
        const { result } = renderHook(() => useDashboardViewModel());

        expect(result.current.isStatusGroupingEnabled).toBe(true);

        act(() => {
            result.current.toggleStatusGrouping();
        });

        expect(result.current.isStatusGroupingEnabled).toBe(false);
    });
});
