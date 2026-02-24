/**
 * Safely parses any date-like value (string, number, or Date) into a valid Date object.
 * If the value is invalid or null/undefined, returns null.
 */
export function safeParseDate(value: string | number | Date | null | undefined): Date | null {
    if (value === null || value === undefined) return null;

    let date: Date;

    if (value instanceof Date) {
        date = value;
    } else if (typeof value === 'number') {
        // Assume Unix timestamp (seconds or milliseconds)
        // Heuristic: if > 10^12, assume milliseconds; otherwise assume seconds
        date = new Date(value > 10000000000 ? value : value * 1000);
    } else if (typeof value === 'string') {
        // Handle common formats
        date = new Date(value);
    } else {
        return null;
    }

    if (isNaN(date.getTime())) {
        return null;
    }

    return date;
}

/**
 * Normalizes a date to 12:00:00 for consistent map key matching.
 */
export function normalizeDateKey(date: Date): string {
    const d = new Date(date);
    d.setHours(12, 0, 0, 0);
    return d.toDateString();
}

/**
 * Safely formats a date value. Returns fallback string if invalid.
 */
import { format, isValid } from 'date-fns';

export function safeFormat(
    value: string | number | Date | null | undefined,
    formatStr: string,
    fallback: string = '-'
): string {
    const date = safeParseDate(value);
    if (!date || !isValid(date)) {
        // [NEW] Warn if value is present but invalid (not just empty/null)
        if (value !== null && value !== undefined && value !== '') {
            console.warn(`[safeFormat] Invalid date encountered. Value: ${JSON.stringify(value)}, Type: ${typeof value}`);
        }
        return fallback;
    }
    try {
        return format(date, formatStr);
    } catch (e) {
        console.error(`[safeFormat] format() failed for value: ${value}`, e);
        return fallback;
    }
}
