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
});
