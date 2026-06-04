import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleCalendarApi, type GoogleCalendar } from '../../../../api/googleCalendar';

/**
 * R-041-Y2: 複数 Google カレンダーの ON/OFF 切替フック。
 *
 * - マウント時に `GET /google/calendars` を呼び一覧を取得する
 * - `toggle(id, isEnabled)` で楽観的に state を更新し、`PATCH /google/calendars/{id}` で永続化
 * - API 失敗時は元の状態にロールバックし、エラーを呼び出し側へ throw する
 * - キャッシュ TTL は Y3 以降で導入。Y2 は毎回 fetch（呼び出し元は CalendarToggleButton のみ）
 */
export type UseGoogleCalendarsResult = {
    calendars: GoogleCalendar[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    toggle: (id: number, isEnabled: boolean) => Promise<void>;
};

export const useGoogleCalendars = (): UseGoogleCalendarsResult => {
    const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const reqIdRef = useRef(0);

    const load = useCallback(async () => {
        const myReqId = ++reqIdRef.current;
        setLoading(true);
        try {
            const res = await GoogleCalendarApi.getGoogleCalendars();
            if (myReqId !== reqIdRef.current) return;
            setCalendars(res.calendars);
            setError(null);
        } catch (e) {
            if (myReqId !== reqIdRef.current) return;
            setError(e as Error);
            setCalendars([]);
        } finally {
            if (myReqId === reqIdRef.current) setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const refresh = useCallback(async () => {
        await load();
    }, [load]);

    const calendarsRef = useRef<GoogleCalendar[]>([]);
    useEffect(() => {
        calendarsRef.current = calendars;
    }, [calendars]);

    const toggle = useCallback(async (id: number, isEnabled: boolean) => {
        // 楽観的更新: 即座に UI を切り替える
        const snapshot = calendarsRef.current;
        setCalendars(prev => prev.map(c => (c.id === id ? { ...c, isEnabled } : c)));
        try {
            await GoogleCalendarApi.updateGoogleCalendar(id, isEnabled);
        } catch (e) {
            // ロールバック
            setCalendars(snapshot);
            throw e;
        }
    }, []);

    return { calendars, loading, error, refresh, toggle };
};
