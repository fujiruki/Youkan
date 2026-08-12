import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useOverviewItems } from '../useOverviewItems';
import { DependencyRepository } from '../../../repositories/DependencyRepository';

/**
 * R-048: 起動時の /dependencies 多重取得を避けるためOverviewBoardでは取得しない、という制約があった。
 * R-091: 全体一覧でも依存関係順ソートを反映するため、画面表示時に1回だけ取得する方針に変更（R-048を上書き）。
 * ポーリングや items 変化のたびの再取得ではなく、マウント時1回のみであることを保証する。
 */
describe('R-091: useOverviewItems /dependencies マウント時1回取得', () => {
    let spy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        spy = vi.spyOn(DependencyRepository.prototype, 'getDependencies').mockResolvedValue([]);
    });

    afterEach(() => {
        spy.mockRestore();
    });

    it('useOverviewItems マウント時に getDependencies が1回だけ呼ばれる', () => {
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
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('items（gdbActive等）が変化してもマウント後に getDependencies が再度呼ばれない', () => {
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
        const { rerender } = renderHook(
            (vm) => useOverviewItems(vm as any),
            { initialProps: mockViewModel }
        );
        spy.mockClear();

        rerender({
            ...mockViewModel,
            gdbActive: [{ id: 'new-1' } as any],
        });

        expect(spy).not.toHaveBeenCalled();
    });
});
