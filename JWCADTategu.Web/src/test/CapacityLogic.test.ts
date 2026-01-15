
import { describe, it, expect } from 'vitest';
import { isHoliday, getDailyCapacity } from '../features/core/jbwos/logic/capacity';
import { CapacityConfig } from '../features/core/jbwos/types';

describe('Capacity Logic', () => {
    const mockConfig: CapacityConfig = {
        defaultDailyMinutes: 480, // 8 hours
        holidays: [
            { type: 'weekly', value: '0' }, // Sunday
            { type: 'weekly', value: '6' }  // Saturday
        ],
        exceptions: {
            '2026-01-20': 0,    // Specific Holiday (Tuesday)
            '2026-01-25': 240,  // Sunday Work (Half day)
        }
    };

    it('identifies weekly holidays', () => {
        const sunday = new Date('2026-01-18');
        expect(isHoliday(sunday, mockConfig)).toBe(true);
        expect(getDailyCapacity(sunday, mockConfig)).toBe(0);
    });

    it('identifies workdays', () => {
        const monday = new Date('2026-01-19');
        expect(isHoliday(monday, mockConfig)).toBe(false);
        expect(getDailyCapacity(monday, mockConfig)).toBe(480);
    });

    it('respects specific holiday exceptions', () => {
        const specificHoliday = new Date('2026-01-20'); // Tuesday
        expect(isHoliday(specificHoliday, mockConfig)).toBe(true);
        expect(getDailyCapacity(specificHoliday, mockConfig)).toBe(0);
    });

    it('respects manual work override on holiday', () => {
        const workingSunday = new Date('2026-01-25'); // Sunday
        expect(isHoliday(workingSunday, mockConfig)).toBe(false); // Should NOT be a holiday
        expect(getDailyCapacity(workingSunday, mockConfig)).toBe(240); // 4 hours
    });
});
