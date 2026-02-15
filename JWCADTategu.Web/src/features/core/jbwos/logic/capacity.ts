import { CapacityConfig, WeekDay } from '../types';
import { getDay, isValid } from 'date-fns';
import { safeFormat } from './dateUtils';

/**
 * Check if a given date is a holiday based on the configuration.
 */
export const isHoliday = (date: Date, config: CapacityConfig): boolean => {
    if (!date || !isValid(date)) return false; // Fail safe
    const dateStr = safeFormat(date, 'yyyy-MM-dd');

    // 1. Specific Exceptions (Manual overrides)
    if (config.exceptions && config.exceptions[dateStr] === 0) {
        return true; // Explicitly 0 minutes = Holiday
    }

    // 2. Weekly Holidays
    const dayIndex = getDay(date) as WeekDay;
    const isWeekly = config.holidays.some(h => h.type === 'weekly' && h.value === dayIndex.toString());

    // [FIX] Treat Sat(6)/Sun(0) as default holidays if no holidays defined
    const isDefaultWeekend = (config.holidays.length === 0 && (dayIndex === 0 || dayIndex === 6));

    if (isWeekly || isDefaultWeekend) {
        // Double check for manual WORK override
        if (config.exceptions && config.exceptions[dateStr] > 0) {
            return false;
        }
        return true;
    }

    // 3. Pattern / Specific Date (Future implementation)
    // ...

    return false;
};

/**
 * Get available capacity (in minutes) for a given date.
 */
export const getDailyCapacity = (date: Date, config: CapacityConfig): number => {
    if (!date || !isValid(date)) return 0; // Fail safe
    const dateStr = safeFormat(date, 'yyyy-MM-dd');

    // 1. Explicit Override
    if (config.exceptions && config.exceptions[dateStr] !== undefined) {
        return config.exceptions[dateStr];
    }

    // 2. Holiday Check
    if (isHoliday(date, config)) {
        return 0;
    }

    // 3. Default Capacity
    return config.defaultDailyMinutes;
};
