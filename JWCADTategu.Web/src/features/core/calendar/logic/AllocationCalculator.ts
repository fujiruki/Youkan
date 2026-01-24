
import { Item } from '../../jbwos/types';
import { format, parseISO, subDays } from 'date-fns';

export interface DailyLoad {
    minutes: number;
    items: { item: Item, allocatedMinutes: number }[];
}

export type DailyLoadMap = Record<string, DailyLoad>;

export function calculateAllocations(items: Item[], capacityMinutes: number): DailyLoadMap {
    const dailyLoad: DailyLoadMap = {};
    const MAX_DAYS_LOOKBACK = 365 * 2; // Safety break

    items.forEach(item => {
        if (!item.due_date || !item.estimatedMinutes || item.estimatedMinutes <= 0) return;
        // Check for invalid status (optional, caller responsibility usually, but safe to add)
        if (['done', 'archive', 'decision_rejected'].includes(item.status)) return;

        let remaining = item.estimatedMinutes;
        let currentDate = parseISO(item.due_date);
        let loopCount = 0;

        while (remaining > 0 && loopCount < MAX_DAYS_LOOKBACK) {
            loopCount++;

            // Skip weekends logic could go here
            // const dayOfWeek = getDay(currentDate);
            // if (dayOfWeek === 0 || dayOfWeek === 6) { ... }

            const dateStr = format(currentDate, 'yyyy-MM-dd');

            // Initialize day entry if missing
            if (!dailyLoad[dateStr]) {
                dailyLoad[dateStr] = { minutes: 0, items: [] };
            }

            // Allocation for this task on this day
            // Cap at capacity for this single task (Task shouldn't consume more than 1 day of work per day)
            const alloc = Math.min(remaining, capacityMinutes);

            dailyLoad[dateStr].minutes += alloc;
            dailyLoad[dateStr].items.push({ item, allocatedMinutes: alloc });

            remaining -= alloc;
            currentDate = subDays(currentDate, 1);
        }
    });

    return dailyLoad;
}
