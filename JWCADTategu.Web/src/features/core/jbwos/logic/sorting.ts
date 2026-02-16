import { Item } from "../types";
import { parseISO, isValid, startOfDay } from "date-fns";

// ----------------------------------------------------------------------
// Helper: Get Effective Deadline (Min of Due & Prep)
// ----------------------------------------------------------------------
const getEffectiveDeadline = (item: Item): number | null => {
    // 1. Check Due Date (string YYYY-MM-DD or similar)
    let dueTime: number | null = null;
    if (item.due_date) {
        let d = parseISO(item.due_date);
        // Fallback for non-ISO formats (e.g. 2026/02/18)
        if (!isValid(d)) {
            d = new Date(item.due_date);
        }

        if (isValid(d)) {
            dueTime = startOfDay(d).getTime();
        } else {
            console.warn(`[Sorting] Invalid Due Date for item "${item.title}":`, item.due_date);
        }
    }

    // 2. Check Prep Date (My Deadline) (number timestamp in seconds or milliseconds?)
    // In types.ts/JBWOS, prep_date is usually unix timestamp (seconds) or null
    // Let's assume seconds based on usage in ViewModel (Math.floor(timestampMs / 1000))
    let prepTime: number | null = null;
    if (item.prep_date) {
        // If it's small (< 1e11), it's seconds. (2026 is ~1.7e9)
        const rawTime = item.prep_date < 100000000000 ? item.prep_date * 1000 : item.prep_date;
        prepTime = startOfDay(new Date(rawTime)).getTime();
        // console.log(`[Sorting] Prep Date for "${item.title}":`, item.prep_date, '->', new Date(prepTime).toISOString());
    }

    // 3. Return Earliest
    const result = (dueTime !== null && prepTime !== null) ? Math.min(dueTime, prepTime) : (dueTime !== null ? dueTime : prepTime);
    // console.log(`[Sorting] Item "${item.title}": Due=${dueTime ? new Date(dueTime).toISOString() : 'null'}, Prep=${prepTime ? new Date(prepTime).toISOString() : 'null'} -> Effective=${result ? new Date(result).toISOString() : 'null'}`);
    return result;
};

// ----------------------------------------------------------------------
// 1. Focus / General List Sorting
// ----------------------------------------------------------------------
// Logic:
// 1. Items with NO Due Date AND NO My Deadline (Prep Date) -> TOP
//    1. Items with NO Estimated Time -> TOP of TOP
//    2. Items with Shorter Estimated Time -> Ascending
// 2. Items with Due Date OR My Deadline -> BOTTOM
//    - Sort by Min(Due, Prep) Ascending (Earliest first)
export const compareFocusItems = (a: Item, b: Item): number => {
    const aDeadline = getEffectiveDeadline(a);
    const bDeadline = getEffectiveDeadline(b);

    // Group 1: No Deadline (Top) vs Group 2: Has Deadline (Bottom)
    if (aDeadline === null && bDeadline !== null) return -1; // a is top
    if (aDeadline !== null && bDeadline === null) return 1;  // b is top

    // Within Group 1 (No Deadlines): Sort by Estimated Time
    if (aDeadline === null && bDeadline === null) {
        const aEst = a.estimatedMinutes || 0;
        const bEst = b.estimatedMinutes || 0;

        // Sub-rule: No Estimate (0) is TOP? Or Bottom?
        // User said: "1. No Est, 2. Short Est".
        // If 0 is "No Est", it should be first.
        // But "Short Est" implies 5min < 10min. 0 is shortest.
        // So simple ascending works: 0, 5, 10...
        // Wait, "No Est" effectively means "Unknown/Undefined".
        // Let's treat 0 as 0. 
        return aEst - bEst;
    }

    // Within Group 2 (Has Deadlines): Sort by Earliest Date
    // We know both are not null here due to first check
    return (aDeadline as number) - (bDeadline as number);
};

// ----------------------------------------------------------------------
// 2. Inbox Sorting
// ----------------------------------------------------------------------
// Logic:
// 1. Items with NO Due Date AND NO My Deadline -> TOP
// 2. Created Date Ascending (Oldest first)
//    - Reason: "Remember if registered"
// Note: If item has deadline, where does it go?
// User spec for Inbox only mentions "1. No Deadline, 2. Created Asc".
// Implicitly: Items *with* deadline should probably be at bottom?
// Or maybe "Inbox" implies "No Deadline" mostly?
// Let's follow the pattern: Group 1 (No Deadline) -> Group 2 (Has Deadline).
// Inside both groups, use Created Asc.
export const compareInboxItems = (a: Item, b: Item): number => {
    const aDeadline = getEffectiveDeadline(a);
    const bDeadline = getEffectiveDeadline(b);

    // Grouping: No Deadline First
    if (aDeadline === null && bDeadline !== null) return -1;
    if (aDeadline !== null && bDeadline === null) return 1;

    // Sort by Created At (Ascending: Old -> New)
    return (a.createdAt || 0) - (b.createdAt || 0);
};
