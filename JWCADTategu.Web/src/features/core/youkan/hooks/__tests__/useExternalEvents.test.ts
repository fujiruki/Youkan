import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useExternalEvents, __clearExternalEventsCache } from '../useExternalEvents';
import { ApiClient } from '../../../../../api/client';

const FROM = '2026-06-01';
const TO = '2026-06-30';

const mockApiPayload = {
    external_events: [
        {
            id: 'google:abc123',
            calendar_id: 'primary',
            event_id: 'abc123',
            start_at: 1717286400, // 2024-06-02 00:00 UTC（テスト目的で日付計算は date-fns 任せ）
            end_at: 1717290000,
            all_day: false,
            title: '会議',
            location: 'Zoom',
            html_link: 'https://calendar.google.com/event?eid=abc123',
        },
        {
            id: 'google:def456',
            calendar_id: 'primary',
            event_id: 'def456',
            // 終日イベント。end は exclusive で start と同日内に収める（テスト目的）
            start_at: 1717286400,
            end_at: 1717286400 + 60,
            all_day: true,
            title: '出張',
            location: null,
            html_link: null,
        },
    ],
};

describe('useExternalEvents', () => {
    beforeEach(() => {
        __clearExternalEventsCache();
        vi.clearAllMocks();
        try {
            window.localStorage.removeItem('YOUKAN_EXTERNAL_EVENTS_MOCK');
        } catch (_e) { /* noop */ }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('未連携時（API が 401 or 404 等で失敗）でも空 Map とエラーなしで返る', async () => {
        const spy = vi.spyOn(ApiClient, 'request').mockRejectedValue(new Error('not linked'));

        const { result } = renderHook(() => useExternalEvents(FROM, TO));

        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(result.current.eventsByDate.size).toBe(0);
        expect(result.current.error).toBeNull();
        expect(spy).toHaveBeenCalledTimes(1);
    });

    it('API レスポンスを date キーの Map に整形して返す', async () => {
        vi.spyOn(ApiClient, 'request').mockResolvedValue(mockApiPayload as any);

        const { result } = renderHook(() => useExternalEvents(FROM, TO));

        await waitFor(() => expect(result.current.loading).toBe(false));

        const allEvents = Array.from(result.current.eventsByDate.values()).flat();
        expect(allEvents.length).toBe(2);

        const timed = allEvents.find(e => e.eventId === 'abc123');
        expect(timed).toBeDefined();
        expect(timed!.title).toBe('会議');
        expect(timed!.allDay).toBe(false);
        expect(timed!.htmlLink).toBe('https://calendar.google.com/event?eid=abc123');

        const allDay = allEvents.find(e => e.eventId === 'def456');
        expect(allDay).toBeDefined();
        expect(allDay!.allDay).toBe(true);
        expect(allDay!.location).toBeNull();
    });

    it('15 分以内の同一レンジ再取得はキャッシュを返す（API は 1 回しか叩かない）', async () => {
        const spy = vi.spyOn(ApiClient, 'request').mockResolvedValue(mockApiPayload as any);

        const { result, unmount } = renderHook(() => useExternalEvents(FROM, TO));
        await waitFor(() => expect(result.current.loading).toBe(false));
        unmount();

        const { result: result2 } = renderHook(() => useExternalEvents(FROM, TO));
        await waitFor(() => expect(result2.current.loading).toBe(false));

        expect(spy).toHaveBeenCalledTimes(1);
        expect(Array.from(result2.current.eventsByDate.values()).flat().length).toBe(2);
    });

    it('refresh() を呼ぶとキャッシュを無視して再フェッチする', async () => {
        const spy = vi.spyOn(ApiClient, 'request').mockResolvedValue(mockApiPayload as any);

        const { result } = renderHook(() => useExternalEvents(FROM, TO));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(spy).toHaveBeenCalledTimes(1);

        await act(async () => {
            await result.current.refresh();
        });

        expect(spy).toHaveBeenCalledTimes(2);
    });

    it('from / to が空文字なら API を叩かず空 Map を返す', async () => {
        const spy = vi.spyOn(ApiClient, 'request');
        const { result } = renderHook(() => useExternalEvents('', ''));
        await waitFor(() => expect(result.current.loading).toBe(false));
        expect(spy).not.toHaveBeenCalled();
        expect(result.current.eventsByDate.size).toBe(0);
    });
});
