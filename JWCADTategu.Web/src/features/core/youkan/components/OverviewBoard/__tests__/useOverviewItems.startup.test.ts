import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOverviewItems } from '../useOverviewItems';
import { DependencyRepository } from '../../../repositories/DependencyRepository';

describe('R-048: useOverviewItems 起動時 /dependencies 抑制', () => {
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        spy = vi.spyOn(DependencyRepository.prototype, 'getDependencies').mockResolvedValue([]);
    });

    afterEach(() => {
        spy.mockRestore();
    });

    it('useOverviewItems マウント時に getDependencies が呼ばれない', () => {
        const mockViewModel = {
            gdbActive: [],
            gdbPreparation: [],
            gdbIntent: [],
            gdbSomeday: [],
            gdbLog: [],
            allProjects: [],
            todayCandidates: [],
            todayCommits: [],
            executionItem: null
        };
        renderHook(() => useOverviewItems(mockViewModel as any));
        expect(spy).not.toHaveBeenCalled();
    });
});
