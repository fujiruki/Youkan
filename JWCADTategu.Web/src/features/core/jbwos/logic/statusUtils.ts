import { Item } from '../types';
import { startOfDay, isBefore, isSameDay } from 'date-fns';

/**
 * Determines if an item is a candidate for "Today's Work".
 * @param item - The item to check
 * @param nowUnix - Current time in Unix seconds (optional, defaults to now)
 */
export function isTodayCandidate(item: Item, nowUnix?: number): boolean {
    // 1. Must be 'ready' status.
    if (item.status !== 'ready') return false;

    // 2. Flags override checks.
    // If it is already committed to today (manually), it shows up.
    if (item.flags?.is_today_commit) return true;

    // 3. Date Checks.
    const now = nowUnix ? new Date(nowUnix * 1000) : new Date();
    const todayStart = startOfDay(now);

    // If prep_date exists...
    if (item.prep_date) {
        const prepDate = new Date(item.prep_date * 1000);
        // If prep_date matches today or is in the past, it's a candidate.
        if (isBefore(prepDate, todayStart) || isSameDay(prepDate, todayStart)) {
            return true;
        }
    }

    return false;
}

/**
 * Determines if an item is considered overdue.
 * Note: 'Overdue' is an external warning, not a status.
 */
export function isOverdue(item: Item, nowString?: string): boolean {
    if (item.status === 'done') return false;
    if (!item.due_date) return false;

    // Default to strict today comparison
    // But since inputs are string "YYYY-MM-DD", simple string compare works for ISO format
    const today = nowString || new Date().toISOString().split('T')[0];

    return item.due_date < today;
}

/**
 * Helper to determine if an item needs decision.
 */
export function needsDecision(item: Item): boolean {
    return !!item.flags?.needs_decision;
}
