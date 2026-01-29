import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useProjectListViewModel } from './useProjectListViewModel';
import { ApiClient } from '../../../../api/client';

// Mock ApiClient
vi.mock('../../../../api/client', () => ({
    ApiClient: {
        getProjects: vi.fn(),
    },
}));

describe('useProjectListViewModel', () => {
    const mockPersonalProjects = [{ id: 'p1', title: 'Personal Proj 1' }];
    const mockCompanyProjects = [{ id: 'c1', title: 'Company Proj 1', clientName: 'Client A' }];

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('defaults to personal tab and fetches personal projects', async () => {
        (ApiClient.getProjects as any).mockResolvedValue(mockPersonalProjects);

        const { result } = renderHook(() => useProjectListViewModel());

        expect(result.current.activeTab).toBe('personal');
        expect(result.current.loading).toBe(true);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.projects).toEqual(mockPersonalProjects);
            expect(ApiClient.getProjects).toHaveBeenCalledWith({ scope: 'personal' });
        });
    });

    it('switches to company tab and fetches company projects', async () => {
        (ApiClient.getProjects as any)
            .mockResolvedValueOnce(mockPersonalProjects)
            .mockResolvedValueOnce(mockCompanyProjects);

        const { result } = renderHook(() => useProjectListViewModel());

        await waitFor(() => expect(result.current.loading).toBe(false));

        // Switch Tab
        act(() => {
            result.current.setTab('company');
        });

        expect(result.current.activeTab).toBe('company');
        expect(result.current.loading).toBe(true);

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.projects).toEqual(mockCompanyProjects);
            expect(ApiClient.getProjects).toHaveBeenCalledWith({ scope: 'company' });
        });
    });
});
