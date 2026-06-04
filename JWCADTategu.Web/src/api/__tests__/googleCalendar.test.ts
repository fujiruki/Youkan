import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GoogleCalendarApi } from '../googleCalendar';
import { ApiClient } from '../client';

describe('GoogleCalendarApi', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    describe('startOAuth', () => {
        it('POST /google/oauth/start を呼び authUrl を返す', async () => {
            const requestSpy = vi
                .spyOn(ApiClient, 'request')
                .mockResolvedValueOnce({ authUrl: 'https://accounts.google.com/o/oauth2/auth?xxx' });

            const res = await GoogleCalendarApi.startOAuth();

            expect(requestSpy).toHaveBeenCalledWith('POST', '/google/oauth/start');
            expect(res.authUrl).toBe('https://accounts.google.com/o/oauth2/auth?xxx');
        });
    });

    describe('getStatus', () => {
        it('GET /google/oauth/status を呼びステータスを返す（未連携）', async () => {
            const requestSpy = vi
                .spyOn(ApiClient, 'request')
                .mockResolvedValueOnce({ connected: false });

            const res = await GoogleCalendarApi.getStatus();

            expect(requestSpy).toHaveBeenCalledWith('GET', '/google/oauth/status', undefined, true);
            expect(res.connected).toBe(false);
        });

        it('連携済みの場合 email と lastSyncAt を返す', async () => {
            vi.spyOn(ApiClient, 'request').mockResolvedValueOnce({
                connected: true,
                email: 'door.fujita@gmail.com',
                lastSyncAt: 1717286400
            });

            const res = await GoogleCalendarApi.getStatus();

            expect(res.connected).toBe(true);
            expect(res.email).toBe('door.fujita@gmail.com');
            expect(res.lastSyncAt).toBe(1717286400);
        });
    });

    describe('refresh', () => {
        it('POST /google/calendar/refresh を呼び件数を返す', async () => {
            vi.spyOn(ApiClient, 'request').mockResolvedValueOnce({ count: 12 });

            const res = await GoogleCalendarApi.refresh();

            expect(res.count).toBe(12);
        });
    });

    describe('revoke', () => {
        it('DELETE /google/oauth を呼ぶ', async () => {
            const requestSpy = vi
                .spyOn(ApiClient, 'request')
                .mockResolvedValueOnce(undefined);

            await GoogleCalendarApi.revoke();

            expect(requestSpy).toHaveBeenCalledWith('DELETE', '/google/oauth');
        });
    });

    // R-041-Y2: 複数 Google カレンダー対応
    describe('getGoogleCalendars', () => {
        it('GET /google/calendars を呼び、snake_case を camelCase に変換した一覧を返す', async () => {
            const requestSpy = vi
                .spyOn(ApiClient, 'request')
                .mockResolvedValueOnce({
                    calendars: [
                        {
                            id: 1,
                            calendar_id: 'primary',
                            summary: 'メイン',
                            color_hex: '#039be5',
                            is_enabled: true,
                            sort_order: 0,
                        },
                        {
                            id: 2,
                            calendar_id: 'work@example.com',
                            summary: '仕事',
                            color_hex: '#d50000',
                            is_enabled: false,
                            sort_order: 1,
                        },
                    ],
                });

            const res = await GoogleCalendarApi.getGoogleCalendars();

            expect(requestSpy).toHaveBeenCalledWith('GET', '/google/calendars', undefined, true);
            expect(res.calendars).toHaveLength(2);
            expect(res.calendars[0]).toEqual({
                id: 1,
                calendarId: 'primary',
                summary: 'メイン',
                colorHex: '#039be5',
                isEnabled: true,
                sortOrder: 0,
            });
            expect(res.calendars[1].isEnabled).toBe(false);
        });

        it('レスポンスが空でも空配列を返す', async () => {
            vi.spyOn(ApiClient, 'request').mockResolvedValueOnce({ calendars: [] });
            const res = await GoogleCalendarApi.getGoogleCalendars();
            expect(res.calendars).toEqual([]);
        });
    });

    describe('updateGoogleCalendar', () => {
        it('PATCH /google/calendars/{id} を呼び is_enabled を送る', async () => {
            const requestSpy = vi
                .spyOn(ApiClient, 'request')
                .mockResolvedValueOnce({ success: true, id: 7, is_enabled: false });

            const res = await GoogleCalendarApi.updateGoogleCalendar(7, false);

            expect(requestSpy).toHaveBeenCalledWith('PATCH', '/google/calendars/7', { is_enabled: false });
            expect(res.id).toBe(7);
            expect(res.isEnabled).toBe(false);
        });

        it('true への切替も同様にリクエストする', async () => {
            const requestSpy = vi
                .spyOn(ApiClient, 'request')
                .mockResolvedValueOnce({ success: true, id: 3, is_enabled: true });

            const res = await GoogleCalendarApi.updateGoogleCalendar(3, true);

            expect(requestSpy).toHaveBeenCalledWith('PATCH', '/google/calendars/3', { is_enabled: true });
            expect(res.isEnabled).toBe(true);
        });
    });
});
