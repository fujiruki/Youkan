import { CapacityConfig, WeekDay } from '../types';
import { getDay, isValid } from 'date-fns';
import { safeFormat } from './dateUtils';

/**
 * R-130 / F-11: ある日の日次キャパ（分）の決定規則。この関数がフロント側唯一の実装であり、
 * QuantityEngine・週の残量（weekLoad.ts）・最遅着手日（latestStart.ts経由）はすべてこれを呼ぶ。
 * 優先順:
 * 1. 日別例外 exceptions[YYYY-MM-DD]（0＝休み）
 * 2. 曜日パターン standardWeeklyPattern[曜日]（0＝定休日）
 * 3. holidays（weekly指定）に該当すれば0
 * 4. 1〜3のいずれもなく、holidaysも曜日パターンも未設定なら土日は0（既定の週休2日）
 * 5. それ以外は defaultDailyMinutes
 */
export const getDailyCapacity = (date: Date, config: CapacityConfig): number => {
    if (!date || !isValid(date)) return 0; // Fail safe
    const dateStr = safeFormat(date, 'yyyy-MM-dd');
    const dayIndex = getDay(date) as WeekDay;

    // 1. 日別例外（最優先）
    if (config.exceptions && config.exceptions[dateStr] !== undefined) {
        return config.exceptions[dateStr];
    }

    // 2. 曜日パターン
    const weeklyPatternVal = config.standardWeeklyPattern?.[dayIndex];
    if (weeklyPatternVal !== undefined) {
        return weeklyPatternVal;
    }

    // 3. holidays（weekly指定）
    const isWeeklyHoliday = config.holidays.some(h => h.type === 'weekly' && h.value === dayIndex.toString());
    if (isWeeklyHoliday) {
        return 0;
    }

    // 4. holidaysも曜日パターンも未設定なら土日は既定の週休2日
    const hasNoHolidayConfig = config.holidays.length === 0 && config.standardWeeklyPattern === undefined;
    if (hasNoHolidayConfig && (dayIndex === 0 || dayIndex === 6)) {
        return 0;
    }

    // 5. 既定値
    return config.defaultDailyMinutes;
};

/**
 * ある日が休日（キャパ0）かどうか。getDailyCapacity と同じ規則を使う（規則の実装は1箇所）。
 */
export const isHoliday = (date: Date, config: CapacityConfig): boolean => {
    if (!date || !isValid(date)) return false; // Fail safe
    return getDailyCapacity(date, config) === 0;
};
