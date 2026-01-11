
import { useCallback } from 'react';
import { Item } from '../types';

interface CalendarEventOption {
    title: string;
    description?: string;
    startTime?: Date; // If omitted, creates an all-day event (Phase 1)
    durationHours?: number; // Only for timed events (Phase 2)
}

export const useGoogleCalendar = () => {

    /**
     * Generates a Google Calendar URL for creating an event.
     * 
     * @param options Event details
     * @returns URL string to open in new tab
     */
    const generateCalendarUrl = useCallback((options: CalendarEventOption) => {
        const baseUrl = "https://calendar.google.com/calendar/render";
        const params = new URLSearchParams();
        params.append('action', 'TEMPLATE');
        params.append('text', options.title);

        if (options.description) {
            params.append('details', options.description);
        }

        // Date formatting: YYYYMMDDThhmmssZ
        const formatDate = (date: Date) => {
            return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        };

        if (options.startTime && options.durationHours) {
            // Phase 2: Work Block (Specific Time)
            const start = options.startTime;
            const end = new Date(start.getTime() + options.durationHours * 60 * 60 * 1000);
            params.append('dates', `${formatDate(start)}/${formatDate(end)}`);
        } else {
            // Phase 1: Judgment Hook (All Day / Reminder-like)
            // If no dates provided, GCal defaults to today/current time.
            // For All Day, we typically pass YYYYMMDD/YYYYMMDD+1
            const today = new Date();
            const yyyymmdd = today.toISOString().split('T')[0].replace(/-/g, '');
            // For a single day event, start and end date can be same YYYYMMDD or start/start+1
            // Let's rely on user adjusting it, or default to current day all day.
            // Actually, omitting dates makes it default to current 1 hour slot in some views, 
            // but explicitly passing dates is safer. Let's stick to simple "action=TEMPLATE" for now
            // to let user decide, or create specific logic if requested.
            // 
            // For Phase 1 (Inbox), we want prompt.
            // Let's just set title/details for now as requested "Simple Link".
        }

        return `${baseUrl}?${params.toString()}`;
    }, []);

    const openCalendarForInbox = useCallback((item: Item) => {
        const url = generateCalendarUrl({
            title: `[判断再開] ${item.title}`,
            description: `JBWOS Item ID: ${item.id}\n${item.description || ''}`,
            // No time specified -> User picks time/date
        });
        window.open(url, '_blank');
    }, [generateCalendarUrl]);

    const openCalendarForReady = useCallback((item: Item) => {
        const now = new Date();
        // Default to 1 hour block starting now
        const url = generateCalendarUrl({
            title: `[作業] ${item.title}`,
            description: `JBWOS Item ID: ${item.id}\n${item.description || ''}`,
            startTime: now,
            durationHours: 1
        });
        window.open(url, '_blank');
    }, [generateCalendarUrl]);

    return {
        openCalendarForInbox,
        openCalendarForReady
    };
};
