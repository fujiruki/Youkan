import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleCalendarApi, type GoogleCalendar } from '../../../../api/googleCalendar';

/**
 * R-041-Y2: 複数 Google カレンダーの ON/OFF 切替フック。
 *
 * - マウント時に `GET /google/calendars` を呼び一覧を取得する
 * - `toggle(id, isEnabled)` で楽観的に state を更新し、`PATCH /google/calendars/{id}` で永続化
 * - API 失敗時は元の状態にロールバックし、エラーを呼び出し側へ throw する
 * - [R-152] モジュールスコープの Promise キャッシュ＋TTL 5分。同一画面での複数マウント
 *   （VolumeCalendarScreen・CalendarToggleButton・DecisionDetailModal）が1リクエストに集約される
 */
export type UseGoogleCalendarsResult = {
    calendars: GoogleCalendar[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    toggle: (id: number, isEnabled: boolean) => Promise<void>;
};

const CACHE_TTL_MS = 5 * 60 * 1000;

type CacheEntry = { promise: Promise<{ calendars: GoogleCalendar[] }>; fetchedAt: number };
let sharedCache: CacheEntry | null = null;

const fetchCalendarsShared = (force: boolean): Promise<{ calendars: GoogleCalendar[] }> => {
    if (!force && sharedCache && Date.now() - sharedCache.fetchedAt < CACHE_TTL_MS) {
        return sharedCache.promise;
    }
    const promise = GoogleCalendarApi.getGoogleCalendars();
    const entry: CacheEntry = { promise, fetchedAt: Date.now() };
    sharedCache = entry;
    // 失敗した Promise をキャッシュし続けない（次のマウントで再試行できるように）
    promise.catch(() => {
        if (sharedCache === entry) sharedCache = null;
    });
    return promise;
};

/** テスト用: モジュールスコープのキャッシュを破棄する */
export const __resetGoogleCalendarsCache = (): void => {
    sharedCache = null;
};

export const useGoogleCalendars = (): UseGoogleCalendarsResult => {
    const [calendars, setCalendars] = useState<GoogleCalendar[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<Error | null>(null);
    const reqIdRef = useRef(0);

    const load = useCallback(async (force: boolean) => {
        const myReqId = ++reqIdRef.current;
        setLoading(true);
        try {
            const res = await fetchCalendarsShared(force);
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
        load(false);
    }, [load]);

    const refresh = useCallback(async () => {
        await load(true);
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
            // 変更を永続化できたので、古い一覧キャッシュは破棄（次のマウントでサーバー値を取得）
            sharedCache = null;
        } catch (e) {
            // ロールバック
            setCalendars(snapshot);
            throw e;
        }
    }, []);

    return { calendars, loading, error, refresh, toggle };
};
