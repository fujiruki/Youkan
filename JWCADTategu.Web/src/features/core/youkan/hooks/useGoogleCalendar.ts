
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
            // If no dates are provided, Google Calendar defaults to the current date/time.
            // This allows the user to manually set the date and time.
        }

        return `${baseUrl}?${params.toString()}`;
    }, []);

    const openCalendarForInbox = useCallback((item: Item) => {
        const url = generateCalendarUrl({
            title: `[判断再開] ${item.title}`,
            description: `Youkan Item ID: ${item.id}\n${item.memo || ''}`,
            // No time specified -> User picks time/date
        });
        window.open(url, '_blank');
    }, [generateCalendarUrl]);

    const openCalendarForReady = useCallback((item: Item) => {
        const now = new Date();
        // Default to 1 hour block starting now
        const url = generateCalendarUrl({
            title: `[作業] ${item.title}`,
            description: `Youkan Item ID: ${item.id}\n${item.memo || ''}`,
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
