/**
 * R-061: SideCalendarPanel 外部イベント pass-through テスト
 *
 * externalEventsByDate / googleCalendars が DetailQuantityCalendar（→ RyokanCalendar）まで
 * スルーで伝播することを検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { SideCalendarPanel } from '../SideCalendarPanel';
import { ExternalEvent } from '../../../types/externalEvent';
import { GoogleCalendar } from '../../../../../../api/googleCalendar';

vi.mock('../../../components/Calendar/RyokanCalendar', () => {
    const React = require('react');
    return {
        RyokanCalendar: ({ externalEventsByDate, googleCalendars }: {
            externalEventsByDate?: Map<string, ExternalEvent[]>;
            googleCalendars?: GoogleCalendar[];
        }) => {
            const eventCount = externalEventsByDate
                ? Array.from(externalEventsByDate.values()).reduce((s, arr) => s + arr.length, 0)
                : 0;
            const calCount = googleCalendars?.length ?? 0;
            return React.createElement('div', {
                'data-testid': 'mock-ryokan-calendar',
                'data-external-count': String(eventCount),
                'data-cal-count': String(calCount),
            });
        },
    };
});

vi.mock('../../../../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

const TODAY_KEY = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
})();

const makeExternalEvent = (id: string): ExternalEvent => ({
    id,
    calendarId: 'primary',
    eventId: id,
    startAt: Math.floor(Date.now() / 1000),
    endAt: Math.floor(Date.now() / 1000) + 3600,
    allDay: false,
    title: `予定 ${id}`,
    location: null,
    htmlLink: null,
});

const makeCalendar = (id: number): GoogleCalendar => ({
    id,
    calendarId: 'primary',
    summary: 'メインカレンダー',
    colorHex: '#4285f4',
    isEnabled: true,
    sortOrder: 0,
});

describe('SideCalendarPanel — 外部イベント pass-through (R-061)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('externalEventsByDate と googleCalendars が RyokanCalendar まで伝播する', () => {
        const eventsMap = new Map<string, ExternalEvent[]>();
        eventsMap.set(TODAY_KEY, [makeExternalEvent('e1'), makeExternalEvent('e2'), makeExternalEvent('e3')]);
        const calendars = [makeCalendar(1), makeCalendar(2)];

        render(
            <SideCalendarPanel
                selectedDate={null}
                onSelectDate={vi.fn()}
                externalEventsByDate={eventsMap}
                googleCalendars={calendars}
            />
        );

        const cal = screen.getByTestId('mock-ryokan-calendar');
        expect(cal.getAttribute('data-external-count')).toBe('3');
        expect(cal.getAttribute('data-cal-count')).toBe('2');
    });

    it('外部イベントなしでもクラッシュしない', () => {
        expect(() =>
            render(
                <SideCalendarPanel
                    selectedDate={null}
                    onSelectDate={vi.fn()}
                />
            )
        ).not.toThrow();
    });
});
