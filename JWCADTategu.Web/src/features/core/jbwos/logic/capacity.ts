
import { CapacityConfig, WeekDay } from '../types';
import { isSameDay, getDay, format } from 'date-fns';

/**
 * Check if a given date is a holiday based on the configuration.
 */
export const isHoliday = (date: Date, config: CapacityConfig): boolean => {
    const dateStr = format(date, 'yyyy-MM-dd');

    // 1. Specific Exceptions (Manual overrides)
    if (config.exceptions && config.exceptions[dateStr] === 0) {
        return true; // Explicitly 0 minutes = Holiday
    }

    // 2. Weekly Holidays
    const dayIndex = getDay(date) as WeekDay;
    const isWeekly = config.holidays.some(h => h.type === 'weekly' && h.value === dayIndex.toString());

    if (isWeekly) {
        // Check if there is a manual OVERRIDE to work on this holiday
        if (config.exceptions && config.exceptions[dateStr] > 0) {
            return false; // Working on a holiday!
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
    const dateStr = format(date, 'yyyy-MM-dd');

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
