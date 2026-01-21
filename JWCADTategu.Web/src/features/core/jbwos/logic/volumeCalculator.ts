import { Item } from '../types';
import { isHoliday } from './capacity';

// Default config matched with QuantityCalendar
export const DEFAULT_CAPACITY_CONFIG: any = {
    holidays: [
        { type: 'weekly', value: '0' }, // Sunday
        { type: 'weekly', value: '6' }  // Saturday
    ],
    defaultDailyMinutes: 480, // 8 hours
    exceptions: {}
};

// Helper: Parse Date String YYYY-MM-DD
const parseDateString = (dateStr: string | undefined | null): Date | null => {
    if (!dateStr) return null;
    return new Date(dateStr);
};

/**
 * Calculates daily volume (heat) map based on items.
 * Logic extracted from QuantityCalendar.tsx.
 * 
 * Rules:
 * 1. Due Date: Adds 1.0 volume.
 * 2. Prep Date Span: Adds 1.0 volume for each working day backwards from Prep Date.
 *    - Uses work_days from item, or falls back to estimatedMinutes.
 *    - Skips holidays defined in capacityConfig.
 */
export const calculateDailyVolume = (items: Item[], capacityConfig: any = DEFAULT_CAPACITY_CONFIG): Map<string, number> => {
    const map = new Map<string, number>();

    items.forEach(item => {
        // 1. Due Date: Add moderate heat
        if (item.due_date) {
            const d = parseDateString(item.due_date);
            if (d) {
                const key = d.toDateString();
                map.set(key, (map.get(key) || 0) + 1.0);
            }
        }

        // 2. Prep Date Span: Add heat for work_days range (Working Days Only)
        if (item.prep_date) {
            const prepDate = new Date(item.prep_date * 1000);

            // Fallback: If work_days is 1 (default) or missing, try to use estimatedMinutes to guess days
            // 7h (420m) = 1 day
            const estimatedDays = item.estimatedMinutes ? Math.ceil(item.estimatedMinutes / 420) : 0;
            const workDays = (item.work_days && item.work_days > 1) ? Number(item.work_days) : (estimatedDays || 1);

            let count = 0;
            let current = new Date(prepDate);
            let safety = 0;

            while (count < workDays && safety < 30) {
                safety++;

                // Check holiday
                if (!isHoliday(current, capacityConfig)) {
                    const key = current.toDateString();
                    map.set(key, (map.get(key) || 0) + 1.0);
                    count++;
                }

                // Move backwards
                current.setDate(current.getDate() - 1);
            }
        }
    });

    return map;
};

/**
 * Returns the Tailwind CSS class for the background color based on volume.
 * Logic matches QuantityCalendar visualization (Amber Gradient).
 * 
 * Volume -> Intensity -> Opacity map:
 * QuantityCalendar uses: opacity = Math.min(volume * 15, 60) / 100
 * Logic:
 * vol 1 => 15%
 * vol 2 => 30%
 * vol 3 => 45%
 * vol 4 => 60% (Max)
 */
export const getVolumeColorClass = (volume: number): string => {
    if (!volume || volume <= 0) return "";

    if (volume < 1) return "bg-amber-500/[0.10] dark:bg-amber-400/[0.10]";      // < 1
    if (volume < 2) return "bg-amber-500/[0.25] dark:bg-amber-400/[0.20]";      // 1.x
    if (volume < 3) return "bg-amber-500/[0.40] dark:bg-amber-400/[0.30]";      // 2.x
    if (volume < 4) return "bg-amber-500/[0.50] dark:bg-amber-400/[0.40]";      // 3.x
    return "bg-amber-500/[0.60] dark:bg-amber-400/[0.50]";                      // 4+ (Max)
};
