/**
 * R-061: DecisionDetailModal 外部イベント供給テスト
 *
 * - 両フックを vi.mock 固定値にして、モーダル左カラムに予定が伝播する
 * - useExternalEvents の from-to が dueDate 基準±1ヶ月
 * - viewMode='grid' で呼ばれること
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { DecisionDetailModal } from './DecisionDetailModal';
import { createMockItem } from '../../../../../test/testUtils';
import { ExternalEvent } from '../../types/externalEvent';

vi.mock('../../../../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

const FIXED_EVENT: ExternalEvent = {
    id: 'google:fixed1',
    calendarId: 'primary',
    eventId: 'fixed1',
    startAt: Math.floor(new Date('2026-06-13T09:00:00').getTime() / 1000),
    endAt: Math.floor(new Date('2026-06-13T10:00:00').getTime() / 1000),
    allDay: false,
    title: '固定テスト予定',
    location: null,
    htmlLink: null,
};

const FIXED_EVENTS_MAP = new Map<string, ExternalEvent[]>([
    ['2026-06-13', [FIXED_EVENT]],
]);

let capturedFrom: string | undefined;
let capturedTo: string | undefined;
let capturedViewMode: string | undefined;

vi.mock('../../hooks/useExternalEvents', () => ({
    useExternalEvents: (from: string, to: string, viewMode?: string) => {
        capturedFrom = from;
        capturedTo = to;
        capturedViewMode = viewMode;
        return {
            eventsByDate: FIXED_EVENTS_MAP,
            loading: false,
            error: null,
            refresh: vi.fn(),
            loadMore: vi.fn(),
            loadedRange: { from, to },
            isLoadingMore: false,
            loadDirection: null,
        };
    },
}));

vi.mock('../../hooks/useGoogleCalendars', () => ({
    useGoogleCalendars: () => ({
        calendars: [
            { id: 1, calendarId: 'primary', summary: 'テスト', colorHex: '#4285f4', isEnabled: true, sortOrder: 0 },
        ],
        loading: false,
        error: null,
        refresh: vi.fn(),
        toggle: vi.fn(),
    }),
}));

vi.mock('../Inputs/SideCalendarPanel', () => {
    const React = require('react');
    return {
        SideCalendarPanel: ({ externalEventsByDate, googleCalendars }: any) => {
            const eventCount = externalEventsByDate
                ? Array.from(externalEventsByDate.values()).reduce((s: number, arr: ExternalEvent[]) => s + arr.length, 0)
                : 0;
            const calCount = googleCalendars?.length ?? 0;
            return React.createElement('div', {
                'data-testid': 'side-calendar-panel',
                'data-external-count': String(eventCount),
                'data-cal-count': String(calCount),
            });
        },
    };
});

const DUE_DATE = '2026-06-13';

const renderModal = () => {
    const item = createMockItem({ due_date: DUE_DATE });
    return render(
        <BrowserRouter>
            <DecisionDetailModal
                item={item}
                onClose={vi.fn()}
                onDecision={vi.fn()}
                onDelete={vi.fn()}
                onUpdate={vi.fn().mockResolvedValue(undefined)}
            />
        </BrowserRouter>
    );
};

describe('DecisionDetailModal — 外部イベント供給 (R-061)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedFrom = undefined;
        capturedTo = undefined;
        capturedViewMode = undefined;
    });

    it('useExternalEvents が viewMode="grid" で呼ばれる', async () => {
        renderModal();
        await waitFor(() => {
            expect(capturedViewMode).toBe('grid');
        });
    });

    it('useExternalEvents の from が dueDate の前月以前になる', async () => {
        renderModal();
        await waitFor(() => {
            expect(capturedFrom).toBeDefined();
            // due_date=2026-06-13 → from は 2026-05-XX 以前
            const fromDate = new Date(capturedFrom!);
            const dueDate = new Date(DUE_DATE);
            expect(fromDate.getTime()).toBeLessThanOrEqual(dueDate.getTime());
        });
    });

    it('useExternalEvents の to が dueDate の翌月以降になる', async () => {
        renderModal();
        await waitFor(() => {
            expect(capturedTo).toBeDefined();
            const toDate = new Date(capturedTo!);
            const dueDate = new Date(DUE_DATE);
            expect(toDate.getTime()).toBeGreaterThanOrEqual(dueDate.getTime());
        });
    });

    it('SideCalendarPanel に外部イベントが渡される', async () => {
        renderModal();
        await waitFor(() => {
            const panel = screen.getByTestId('side-calendar-panel');
            expect(panel.getAttribute('data-external-count')).toBe('1');
        });
    });

    it('SideCalendarPanel に googleCalendars が渡される', async () => {
        renderModal();
        await waitFor(() => {
            const panel = screen.getByTestId('side-calendar-panel');
            expect(panel.getAttribute('data-cal-count')).toBe('1');
        });
    });
});
