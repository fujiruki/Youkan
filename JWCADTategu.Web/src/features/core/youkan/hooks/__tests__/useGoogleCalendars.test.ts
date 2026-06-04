import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useGoogleCalendars } from '../useGoogleCalendars';
import { GoogleCalendarApi, type GoogleCalendar } from '../../../../../api/googleCalendar';

const mockCalendars: GoogleCalendar[] = [
    { id: 1, calendarId: 'primary', summary: 'メイン', colorHex: '#039be5', isEnabled: true, sortOrder: 0 },
    { id: 2, calendarId: 'work@example.com', summary: '仕事', colorHex: '#d50000', isEnabled: false, sortOrder: 1 },
    { id: 3, calendarId: 'family@example.com', summary: '家族', colorHex: '#33b679', isEnabled: true, sortOrder: 2 },
];

describe('useGoogleCalendars', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('マウント時に getGoogleCalendars を呼び一覧を保持する', async () => {
        const spy = vi
            .spyOn(GoogleCalendarApi, 'getGoogleCalendars')
            .mockResolvedValueOnce({ calendars: mockCalendars });

        const { result } = renderHook(() => useGoogleCalendars());

        expect(result.current.loading).toBe(true);
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(spy).toHaveBeenCalledTimes(1);
        expect(result.current.calendars).toHaveLength(3);
        expect(result.current.error).toBeNull();
    });

    it('toggle は楽観的に state を更新し、API を呼び出す', async () => {
        vi.spyOn(GoogleCalendarApi, 'getGoogleCalendars').mockResolvedValueOnce({ calendars: mockCalendars });
        const updateSpy = vi
            .spyOn(GoogleCalendarApi, 'updateGoogleCalendar')
            .mockResolvedValueOnce({ ...mockCalendars[1], isEnabled: true });

        const { result } = renderHook(() => useGoogleCalendars());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.toggle(2, true);
        });

        expect(updateSpy).toHaveBeenCalledWith(2, true);
        const target = result.current.calendars.find(c => c.id === 2);
        expect(target?.isEnabled).toBe(true);
    });

    it('toggle 失敗時には state をロールバックする', async () => {
        vi.spyOn(GoogleCalendarApi, 'getGoogleCalendars').mockResolvedValueOnce({ calendars: mockCalendars });
        vi.spyOn(GoogleCalendarApi, 'updateGoogleCalendar').mockRejectedValueOnce(new Error('boom'));

        const { result } = renderHook(() => useGoogleCalendars());
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.toggle(1, false).catch(() => {
                // 失敗は呼び出し側に伝播するが、テストでは握る
            });
        });

        const target = result.current.calendars.find(c => c.id === 1);
        expect(target?.isEnabled).toBe(true); // ロールバック済
    });

    it('refresh で最新の一覧を再取得する', async () => {
        const spy = vi
            .spyOn(GoogleCalendarApi, 'getGoogleCalendars')
            .mockResolvedValueOnce({ calendars: mockCalendars })
            .mockResolvedValueOnce({ calendars: [...mockCalendars, { id: 4, calendarId: 'jp.japanese#holiday@group.v.calendar.google.com', summary: '祝日', colorHex: '#33b679', isEnabled: true, sortOrder: 3 }] });

        const { result } = renderHook(() => useGoogleCalendars());
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.calendars).toHaveLength(3);

        await act(async () => {
            await result.current.refresh();
        });

        expect(spy).toHaveBeenCalledTimes(2);
        expect(result.current.calendars).toHaveLength(4);
    });

    it('fetch 失敗時には error を保持し calendars は空配列', async () => {
        vi.spyOn(GoogleCalendarApi, 'getGoogleCalendars').mockRejectedValueOnce(new Error('network'));

        const { result } = renderHook(() => useGoogleCalendars());

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.error).toBeInstanceOf(Error);
        expect(result.current.calendars).toEqual([]);
    });
});
