import { describe, it, expect } from 'vitest';
import { getDailyCapacity, isHoliday } from '../capacity';
import { CapacityConfig } from '../../types';

// R-130 / F-11: 日次キャパの決定規則を一本化する getDailyCapacity/isHoliday のテスト。
// 優先順: 1.日別例外 > 2.曜日パターン(0=定休日) > 3.holidays(weekly) > 4.1〜3で決まらず土日なら0 > 5.defaultDailyMinutes

describe('getDailyCapacity / isHoliday (R-130 / F-11)', () => {
    // 2026-02-09は月曜、2026-02-14は土曜、2026-02-15は日曜
    const monday = new Date('2026-02-09T00:00:00');
    const saturday = new Date('2026-02-14T00:00:00');
    const sunday = new Date('2026-02-15T00:00:00');

    it('規則5: 何も設定がなければ平日はdefaultDailyMinutes', () => {
        const config: CapacityConfig = { defaultDailyMinutes: 480, holidays: [], exceptions: {} };
        expect(getDailyCapacity(monday, config)).toBe(480);
        expect(isHoliday(monday, config)).toBe(false);
    });

    it('規則4: holidaysも曜日パターンも未設定なら土日は0（既定の週休2日）', () => {
        const config: CapacityConfig = { defaultDailyMinutes: 480, holidays: [], exceptions: {} };
        expect(getDailyCapacity(saturday, config)).toBe(0);
        expect(getDailyCapacity(sunday, config)).toBe(0);
        expect(isHoliday(saturday, config)).toBe(true);
        expect(isHoliday(sunday, config)).toBe(true);
    });

    it('規則3: holidays(weekly)に該当すれば0', () => {
        const config: CapacityConfig = {
            defaultDailyMinutes: 480,
            holidays: [{ type: 'weekly', value: '6' }], // 土曜のみ定休日指定
            exceptions: {},
        };
        expect(getDailyCapacity(saturday, config)).toBe(0);
        // 日曜はholidaysに含まれないが、規則4（その曜日が土日なら0）でどのみち0
        expect(getDailyCapacity(sunday, config)).toBe(0);
    });

    it('規則4: 曜日パターンに平日しか保存されていなくても土日は0（既存データの平日のみパターン）', () => {
        const config: CapacityConfig = {
            defaultDailyMinutes: 480,
            holidays: [],
            exceptions: {},
            standardWeeklyPattern: { 1: 480, 2: 480, 3: 480, 4: 480, 5: 480 }, // 土日キーを省略
        };
        expect(getDailyCapacity(saturday, config)).toBe(0);
        expect(getDailyCapacity(sunday, config)).toBe(0);
        expect(isHoliday(saturday, config)).toBe(true);
        expect(isHoliday(sunday, config)).toBe(true);
    });

    it('規則2は規則4より優先される（土曜に明示値があればそれを使う）', () => {
        const config: CapacityConfig = {
            defaultDailyMinutes: 480,
            holidays: [],
            exceptions: {},
            standardWeeklyPattern: { 6: 480 }, // 土曜だけ稼働と明示
        };
        expect(getDailyCapacity(saturday, config)).toBe(480);
        expect(isHoliday(saturday, config)).toBe(false);
    });

    it('規則2: 曜日パターンがあればそれを使う（平日を240分に変更できる）', () => {
        const config: CapacityConfig = {
            defaultDailyMinutes: 480,
            holidays: [],
            exceptions: {},
            standardWeeklyPattern: { 1: 240, 2: 240, 3: 240, 4: 240, 5: 240 },
        };
        expect(getDailyCapacity(monday, config)).toBe(240);
    });

    it('規則2: 曜日パターンで0を指定した曜日は定休日になる（holidays未設定でも）', () => {
        const config: CapacityConfig = {
            defaultDailyMinutes: 480,
            holidays: [],
            exceptions: {},
            standardWeeklyPattern: { 1: 480, 2: 480, 3: 480, 4: 480, 5: 0 }, // 金曜を定休日に
        };
        const friday = new Date('2026-02-13T00:00:00');
        expect(getDailyCapacity(friday, config)).toBe(0);
        expect(isHoliday(friday, config)).toBe(true);
    });

    it('規則2は規則3(holidays)より優先される', () => {
        const config: CapacityConfig = {
            defaultDailyMinutes: 480,
            holidays: [{ type: 'weekly', value: '1' }], // 月曜をholidaysで定休日指定
            exceptions: {},
            standardWeeklyPattern: { 1: 300 }, // だが曜日パターンで300分と明示
        };
        expect(getDailyCapacity(monday, config)).toBe(300);
    });

    it('規則1: 日別例外が最優先（曜日パターンより優先）', () => {
        const config: CapacityConfig = {
            defaultDailyMinutes: 480,
            holidays: [],
            exceptions: { '2026-02-09': 120 },
            standardWeeklyPattern: { 1: 0 }, // 月曜は定休日設定
        };
        expect(getDailyCapacity(monday, config)).toBe(120);
        expect(isHoliday(monday, config)).toBe(false);
    });

    it('規則1: 日別例外0は休みとして扱われる', () => {
        const config: CapacityConfig = {
            defaultDailyMinutes: 480,
            holidays: [],
            exceptions: { '2026-02-09': 0 },
        };
        expect(getDailyCapacity(monday, config)).toBe(0);
        expect(isHoliday(monday, config)).toBe(true);
    });

    it('不正な日付はフェイルセーフで0/falseを返す', () => {
        const config: CapacityConfig = { defaultDailyMinutes: 480, holidays: [], exceptions: {} };
        const invalid = new Date('invalid');
        expect(getDailyCapacity(invalid, config)).toBe(0);
        expect(isHoliday(invalid, config)).toBe(false);
    });
});
