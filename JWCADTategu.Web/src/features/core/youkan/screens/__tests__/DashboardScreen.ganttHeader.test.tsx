import { describe, it, expect } from 'vitest';

/**
 * CalendarHeaderの表示条件テスト
 * panoramaモード（状況把握）ではCalendarHeaderを表示しない。
 * CalendarHeaderはcalendarモードでのみ表示する。
 */

// DashboardScreenのCalendarHeader表示条件を抽出したヘルパー
const shouldShowCalendarHeader = (viewMode: string): boolean => {
    return viewMode === 'calendar';
};

describe('CalendarHeader表示条件', () => {
    it('calendarモードではCalendarHeaderを表示する', () => {
        expect(shouldShowCalendarHeader('calendar')).toBe(true);
    });

    it('panoramaモード（状況把握）ではCalendarHeaderを表示しない', () => {
        expect(shouldShowCalendarHeader('panorama')).toBe(false);
    });

    it('streamモードではCalendarHeaderを表示しない', () => {
        expect(shouldShowCalendarHeader('stream')).toBe(false);
    });

    it('newspaperモードではCalendarHeaderを表示しない', () => {
        expect(shouldShowCalendarHeader('newspaper')).toBe(false);
    });
});
