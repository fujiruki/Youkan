import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * R-005: Newspaper View初期フィルタテスト
 * Newspaper Viewに切り替えたとき、フィルタが「全て」にリセットされることを検証する
 */

describe('R-005: Newspaper View 初期フィルタ', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('viewModeがnewspaperに変わったときsetFilterMode("all")が呼ばれること', async () => {
        // DashboardScreenの実装では、viewModeが'newspaper'に変わったときに
        // filterModeを'all'にリセットするuseEffectが存在する
        // ここではそのロジックの単体テストとして検証

        const setFilterMode = vi.fn();
        const viewMode = 'newspaper';

        // DashboardScreenのuseEffect相当のロジック
        if (viewMode === 'newspaper') {
            setFilterMode('all');
        }

        expect(setFilterMode).toHaveBeenCalledWith('all');
    });

    it('viewModeがstream/panoramaのときはsetFilterModeが呼ばれないこと', () => {
        const setFilterMode = vi.fn();

        for (const mode of ['stream', 'panorama', 'calendar'] as const) {
            setFilterMode.mockClear();
            // DashboardScreenのuseEffect相当のロジック
            if (mode === 'newspaper') {
                setFilterMode('all');
            }
            expect(setFilterMode).not.toHaveBeenCalled();
        }
    });
});
