import { describe, it, expect } from 'vitest';
import { getCalendarColor, toTint } from '../calendarColor';
import type { GoogleCalendar } from '../../../../../api/googleCalendar';

const cals: GoogleCalendar[] = [
    {
        id: 1,
        calendarId: 'primary',
        summary: 'メイン',
        colorHex: '#4285F4',
        isEnabled: true,
        sortOrder: 0,
    },
    {
        id: 2,
        calendarId: 'work@example.com',
        summary: '仕事',
        colorHex: '#D50000',
        isEnabled: true,
        sortOrder: 1,
    },
];

describe('getCalendarColor', () => {
    it('一致する calendarId のカラー hex を返す', () => {
        expect(getCalendarColor('primary', cals)).toBe('#4285F4');
        expect(getCalendarColor('work@example.com', cals)).toBe('#D50000');
    });

    it('一致しない calendarId は undefined を返す', () => {
        expect(getCalendarColor('unknown', cals)).toBeUndefined();
    });

    it('calendarId が undefined のときは undefined を返す', () => {
        expect(getCalendarColor(undefined, cals)).toBeUndefined();
    });

    it('カレンダー一覧が空のときは undefined を返す', () => {
        expect(getCalendarColor('primary', [])).toBeUndefined();
    });
});

describe('toTint', () => {
    it('カラー hex を 10% 不透明度の rgba に変換する', () => {
        expect(toTint('#4285F4')).toBe('rgba(66, 133, 244, 0.1)');
    });

    it('alpha を引数で指定できる', () => {
        expect(toTint('#FFFFFF', 0.5)).toBe('rgba(255, 255, 255, 0.5)');
    });

    it('# 抜きの hex も受け付ける', () => {
        expect(toTint('000000')).toBe('rgba(0, 0, 0, 0.1)');
    });

    it('undefined は undefined を返す', () => {
        expect(toTint(undefined)).toBeUndefined();
    });
});
