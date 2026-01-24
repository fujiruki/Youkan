
import { Item } from '../../jbwos/types';
import { format, parseISO, subDays } from 'date-fns';

export interface DailyLoad {
    minutes: number;
    items: { item: Item, allocatedMinutes: number }[];
}

export type DailyLoadMap = Record<string, DailyLoad>;

export type CapacityProvider = (date: Date) => number;

export function calculateAllocations(items: Item[], getCapacity: CapacityProvider): DailyLoadMap {
    const dailyLoad: DailyLoadMap = {};
    const MAX_DAYS_LOOKBACK = 365 * 2; // Safety break

    items.forEach(item => {
        if (!item.due_date || !item.estimatedMinutes || item.estimatedMinutes <= 0) return;
        if (['done', 'archive', 'decision_rejected'].includes(item.status)) return;

        let remaining = item.estimatedMinutes;
        let currentDate = parseISO(item.due_date);
        let loopCount = 0;

        while (remaining > 0 && loopCount < MAX_DAYS_LOOKBACK) {
            loopCount++;
            const dateStr = format(currentDate, 'yyyy-MM-dd');

            // Get capacity for this specific day
            const dailyCap = getCapacity(currentDate);

            // If capacity is 0 (Holiday), skip allocation but continue loop (move to previous day)
            // Unless we are at the very start (due date) and it's a holiday?
            // Requirement usually: If due date is holiday, can we work? 
            // Standard logic: No work on holiday. Just move back.

            if (dailyCap > 0) {
                // Initialize day entry if missing
                if (!dailyLoad[dateStr]) {
                    dailyLoad[dateStr] = { minutes: 0, items: [] };
                }

                // Calculate allocation for this item on this day
                // Strategy: Fill up to the task's remaining, limited by daily capacity.
                // NOTE: This simple logic assumes this task is the ONLY one referencing this limit in this loop iteration?
                // Actually, `dailyCap` is the TOTAL/Team capacity. 
                // But `dailyLoad[dateStr].minutes` tracks USED capacity.
                // We should respect the *remaining* available capacity if we want accurate loading?
                // Or does this function just calculate "Requirements" regardless of overload?
                // "Volume Calendar" usually shows overload (heat).
                // So we allow exceeding capacity. "Capacity" here essentially sets the "Unit of work per day".
                // i.e. "How much of this task can be done in one day?" -> The Daily Capacity.

                const alloc = Math.min(remaining, dailyCap);

                dailyLoad[dateStr].minutes += alloc;
                dailyLoad[dateStr].items.push({ item, allocatedMinutes: alloc });

                remaining -= alloc;
            }

            // Move to previous day
            currentDate = subDays(currentDate, 1);
        }
    });

    return dailyLoad;
}
