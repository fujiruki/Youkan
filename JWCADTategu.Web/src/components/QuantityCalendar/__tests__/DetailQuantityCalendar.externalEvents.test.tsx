/**
 * R-061: DetailQuantityCalendar 外部イベント渡しテスト
 *
 * externalEventsByDate を渡すとグリッドセルにGoogle予定チップが描画される。
 * undefined でもクラッシュしない。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DetailQuantityCalendar } from '../DetailQuantityCalendar';
import { ExternalEvent } from '../../../features/core/youkan/types/externalEvent';
import { GoogleCalendar } from '../../../api/googleCalendar';

vi.mock('../../../features/core/youkan/components/Calendar/RyokanCalendar', () => {
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

vi.mock('../../../contexts/ToastContext', () => ({
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
    title: `テスト予定 ${id}`,
    location: null,
    htmlLink: null,
});

const makeCalendar = (id: number): GoogleCalendar => ({
    id,
    calendarId: 'primary',
    summary: 'テスト',
    colorHex: '#ff0000',
    isEnabled: true,
    sortOrder: 0,
});

describe('DetailQuantityCalendar — 外部イベント渡し (R-061)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('externalEventsByDate と googleCalendars を渡すと RyokanCalendar へ伝播する', () => {
        const eventsMap = new Map<string, ExternalEvent[]>();
        eventsMap.set(TODAY_KEY, [makeExternalEvent('ev1'), makeExternalEvent('ev2')]);
        const calendars = [makeCalendar(1)];

        render(
            <DetailQuantityCalendar
                item={null}
                globalFilter="all"
                externalEventsByDate={eventsMap}
                googleCalendars={calendars}
            />
        );

        const cal = screen.getByTestId('mock-ryokan-calendar');
        expect(cal.getAttribute('data-external-count')).toBe('2');
        expect(cal.getAttribute('data-cal-count')).toBe('1');
    });

    it('externalEventsByDate が undefined でもクラッシュしない', () => {
        expect(() =>
            render(
                <DetailQuantityCalendar
                    item={null}
                    globalFilter="all"
                />
            )
        ).not.toThrow();

        const cal = screen.getByTestId('mock-ryokan-calendar');
        expect(cal.getAttribute('data-external-count')).toBe('0');
    });

    it('空の Map を渡してもクラッシュしない', () => {
        expect(() =>
            render(
                <DetailQuantityCalendar
                    item={null}
                    globalFilter="all"
                    externalEventsByDate={new Map()}
                    googleCalendars={[]}
                />
            )
        ).not.toThrow();
    });
});
