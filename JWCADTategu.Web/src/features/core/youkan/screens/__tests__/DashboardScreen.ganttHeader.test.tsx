import { describe, it, expect } from 'vitest';

/**
 * GanttHeaderの表示条件テスト
 * panoramaモード（状況把握）ではGanttHeaderを表示しない。
 * GanttHeaderはcalendarモードでのみ表示する。
 */

// DashboardScreenのGanttHeader表示条件を抽出したヘルパー
const shouldShowGanttHeader = (viewMode: string): boolean => {
    return viewMode === 'calendar';
};

describe('GanttHeader表示条件', () => {
    it('calendarモードではGanttHeaderを表示する', () => {
        expect(shouldShowGanttHeader('calendar')).toBe(true);
    });

    it('panoramaモード（状況把握）ではGanttHeaderを表示しない', () => {
        expect(shouldShowGanttHeader('panorama')).toBe(false);
    });

    it('streamモードではGanttHeaderを表示しない', () => {
        expect(shouldShowGanttHeader('stream')).toBe(false);
    });

    it('newspaperモードではGanttHeaderを表示しない', () => {
        expect(shouldShowGanttHeader('newspaper')).toBe(false);
    });
});
