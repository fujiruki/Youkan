import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { CalendarToggleButton } from '../CalendarToggleButton';
import { GoogleCalendarApi, type GoogleCalendar } from '../../../../../../api/googleCalendar';

const mockCalendars: GoogleCalendar[] = [
    { id: 1, calendarId: 'primary', summary: 'メイン', colorHex: '#039be5', isEnabled: true, sortOrder: 0 },
    { id: 2, calendarId: 'work@example.com', summary: '仕事', colorHex: '#d50000', isEnabled: false, sortOrder: 1 },
    { id: 3, calendarId: 'family@example.com', summary: '家族', colorHex: '#33b679', isEnabled: true, sortOrder: 2 },
];

describe('CalendarToggleButton', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        // matchMedia の jsdom スタブ（useMediaQuery がデスクトップ判定になるようにする）
        Object.defineProperty(window, 'matchMedia', {
            writable: true,
            configurable: true,
            value: vi.fn().mockImplementation((query: string) => ({
                matches: false,
                media: query,
                onchange: null,
                addEventListener: vi.fn(),
                removeEventListener: vi.fn(),
                addListener: vi.fn(),
                removeListener: vi.fn(),
                dispatchEvent: vi.fn(),
            })),
        });
    });

    it('「N/M」の有効数バッジを表示する', async () => {
        vi.spyOn(GoogleCalendarApi, 'getGoogleCalendars').mockResolvedValueOnce({ calendars: mockCalendars });

        render(<CalendarToggleButton />);

        // 有効 2 / 全 3
        await waitFor(() => {
            expect(screen.getByText(/2\s*\/\s*3/)).toBeInTheDocument();
        });
    });

    it('クリックでポップオーバーが開く', async () => {
        vi.spyOn(GoogleCalendarApi, 'getGoogleCalendars').mockResolvedValueOnce({ calendars: mockCalendars });

        render(<CalendarToggleButton />);
        await waitFor(() => screen.getByText(/2\s*\/\s*3/));

        const btn = screen.getByRole('button', { name: /表示するカレンダー/ });
        fireEvent.click(btn);

        await waitFor(() => {
            expect(screen.getByText('メイン')).toBeInTheDocument();
            expect(screen.getByText('仕事')).toBeInTheDocument();
            expect(screen.getByText('家族')).toBeInTheDocument();
        });
    });

    it('カレンダーが 0 件のときは 0/0 を表示する', async () => {
        vi.spyOn(GoogleCalendarApi, 'getGoogleCalendars').mockResolvedValueOnce({ calendars: [] });

        render(<CalendarToggleButton />);

        await waitFor(() => {
            expect(screen.getByText(/0\s*\/\s*0/)).toBeInTheDocument();
        });
    });
});
