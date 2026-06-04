import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClient } from '../../../../api/client';
import { ExternalEvent } from '../types/externalEvent';

/**
 * R-034 Phase 2 / R-039 Phase 3 UX: Google カレンダーイベント取得用 hook。
 *
 * - エンドポイント: `GET /google/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD`
 *   フォールバック: `GET /calendar/grid?from=...&to=...` の `external_events`
 * - SWR 風キャッシュ（プロセス内 Map）、TTL は 15 分
 * - 未連携 / API エラー時は空 Map を返す（タスクの表示を壊さない）
 * - R-039: 設定画面の「表示するビュー」設定で OFF にされたビューでは fetch せず空 Map を返す
 */

/** R-039 Phase 3 UX: 表示するビューの種類（カレンダーサブビュー） */
export type ExternalEventsViewMode = 'grid' | 'gantt' | 'timeline';

/** R-039 Phase 3 UX: 表示するビュー設定の localStorage キー */
export const EXTERNAL_EVENTS_VIEWS_KEY = 'ykn_external_events_views';

/** R-039 Phase 3 UX: デフォルト有効ビュー（全 ON） */
export const DEFAULT_EXTERNAL_EVENTS_VIEWS: ExternalEventsViewMode[] = ['grid', 'gantt', 'timeline'];

/**
 * R-039 Phase 3 UX: 表示するビュー設定を localStorage から読み出す。
 * 不正な JSON / 配列以外の値はデフォルト（全 ON）にフォールバック。
 */
export const readExternalEventsViews = (): ExternalEventsViewMode[] => {
    try {
        if (typeof window === 'undefined') return [...DEFAULT_EXTERNAL_EVENTS_VIEWS];
        const raw = window.localStorage?.getItem(EXTERNAL_EVENTS_VIEWS_KEY);
        if (!raw) return [...DEFAULT_EXTERNAL_EVENTS_VIEWS];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [...DEFAULT_EXTERNAL_EVENTS_VIEWS];
        const filtered = parsed.filter((v): v is ExternalEventsViewMode =>
            v === 'grid' || v === 'gantt' || v === 'timeline'
        );
        return filtered;
    } catch (_e) {
        return [...DEFAULT_EXTERNAL_EVENTS_VIEWS];
    }
};

const CACHE_TTL_MS = 15 * 60 * 1000;

type CacheEntry = {
    fetchedAt: number;
    data: Map<string, ExternalEvent[]>;
};

const cache = new Map<string, CacheEntry>();

/** テスト用: キャッシュをリセットする内部関数 */
export const __clearExternalEventsCache = () => {
    cache.clear();
};

type RawEvent = {
    id: string;
    calendar_id: string;
    event_id?: string;
    start_at: number;
    end_at: number;
    all_day: boolean | 0 | 1;
    title?: string | null;
    location?: string | null;
    html_link?: string | null;
};

type ApiPayload = {
    external_events?: RawEvent[];
    events?: RawEvent[];
};

const toDateKey = (unixSeconds: number): string => {
    const d = new Date(unixSeconds * 1000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const normalizeEvent = (raw: RawEvent): ExternalEvent => ({
    id: raw.id,
    calendarId: raw.calendar_id,
    eventId: raw.event_id || raw.id.replace(/^google:/, ''),
    startAt: raw.start_at,
    endAt: raw.end_at,
    allDay: raw.all_day === true || raw.all_day === 1,
    title: raw.title ?? null,
    location: raw.location ?? null,
    htmlLink: raw.html_link ?? null,
});

/**
 * 終日イベントの場合は開始日〜終了日全日にエントリを置く。
 * 時刻指定イベントは開始日の date key のみ。
 */
const buildEventsByDate = (events: ExternalEvent[]): Map<string, ExternalEvent[]> => {
    const map = new Map<string, ExternalEvent[]>();
    for (const ev of events) {
        if (ev.allDay) {
            // 終日: start から end-1 までの各日付に登録（end は exclusive を想定）。
            // end が同日なら start 1 日分のみ。
            const startMs = ev.startAt * 1000;
            const endMs = Math.max(ev.endAt * 1000, startMs + 1);
            const cursor = new Date(startMs);
            cursor.setHours(0, 0, 0, 0);
            const limit = new Date(endMs - 1);
            limit.setHours(0, 0, 0, 0);
            // セーフティ: 最大 31 日
            let safety = 0;
            while (cursor.getTime() <= limit.getTime() && safety < 31) {
                const k = toDateKey(Math.floor(cursor.getTime() / 1000));
                if (!map.has(k)) map.set(k, []);
                map.get(k)!.push(ev);
                cursor.setDate(cursor.getDate() + 1);
                safety++;
            }
        } else {
            const k = toDateKey(ev.startAt);
            if (!map.has(k)) map.set(k, []);
            map.get(k)!.push(ev);
        }
    }
    // 各日付内で開始時刻昇順にソート
    for (const arr of map.values()) {
        arr.sort((a, b) => a.startAt - b.startAt);
    }
    return map;
};

const MOCK_FLAG_KEY = 'YOUKAN_EXTERNAL_EVENTS_MOCK';

const buildMockEventsForRange = (from: string, to: string): ExternalEvent[] => {
    // 「from」〜「to」の範囲に、開発検証用のサンプルイベントを散らす。
    // 表示・「他 X 件」展開・終日表示の 3 ケースを検証できるよう、特定の日に 4 件以上、別の日に終日 1 件を入れる。
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    if (!fy || !fm || !fd || !ty || !tm || !td) return [];
    const start = new Date(fy, fm - 1, fd);
    const end = new Date(ty, tm - 1, td);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // 表示対象を「今日」周辺に置く（カレンダー初期スクロール位置と整合）
    const anchor = today >= start && today <= end ? today : start;

    const at = (base: Date, dayOffset: number, h: number, m: number) => {
        const d = new Date(base);
        d.setDate(d.getDate() + dayOffset);
        d.setHours(h, m, 0, 0);
        return Math.floor(d.getTime() / 1000);
    };

    const dayStart = (base: Date, dayOffset: number) => {
        const d = new Date(base);
        d.setDate(d.getDate() + dayOffset);
        d.setHours(0, 0, 0, 0);
        return Math.floor(d.getTime() / 1000);
    };

    const events: ExternalEvent[] = [
        // 今日: 4 件以上（「他 X 件」展開検証）
        {
            id: 'mock:1', calendarId: 'primary', eventId: 'mock1',
            startAt: at(anchor, 0, 9, 0), endAt: at(anchor, 0, 10, 0),
            allDay: false, title: '朝会', location: null, htmlLink: null,
        },
        {
            id: 'mock:2', calendarId: 'primary', eventId: 'mock2',
            startAt: at(anchor, 0, 10, 30), endAt: at(anchor, 0, 11, 30),
            allDay: false, title: '客先打合せ', location: 'Zoom', htmlLink: null,
        },
        {
            id: 'mock:3', calendarId: 'primary', eventId: 'mock3',
            startAt: at(anchor, 0, 13, 0), endAt: at(anchor, 0, 14, 0),
            allDay: false, title: 'ランチMTG', location: null, htmlLink: null,
        },
        {
            id: 'mock:4', calendarId: 'primary', eventId: 'mock4',
            startAt: at(anchor, 0, 15, 0), endAt: at(anchor, 0, 16, 0),
            allDay: false, title: '工場巡回', location: '本社工場', htmlLink: null,
        },
        {
            id: 'mock:5', calendarId: 'primary', eventId: 'mock5',
            startAt: at(anchor, 0, 17, 0), endAt: at(anchor, 0, 18, 0),
            allDay: false, title: '日次レビュー', location: null, htmlLink: null,
        },
        // 翌日: 終日イベント
        {
            id: 'mock:6', calendarId: 'primary', eventId: 'mock6',
            startAt: dayStart(anchor, 1), endAt: dayStart(anchor, 1) + 60,
            allDay: true, title: '東京出張', location: '東京', htmlLink: null,
        },
        // 翌々日: 通常 1 件
        {
            id: 'mock:7', calendarId: 'primary', eventId: 'mock7',
            startAt: at(anchor, 2, 14, 0), endAt: at(anchor, 2, 15, 30),
            allDay: false, title: '見積レビュー', location: null, htmlLink: null,
        },
    ];
    return events;
};

const isMockEnabled = (): boolean => {
    try {
        if (typeof window === 'undefined') return false;
        if (window.localStorage?.getItem(MOCK_FLAG_KEY) === '1') return true;
    } catch (_e) { /* noop */ }
    return false;
};

const fetchExternalEvents = async (from: string, to: string): Promise<Map<string, ExternalEvent[]>> => {
    try {
        const path = `/google/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        const payload = await ApiClient.request<ApiPayload>('GET', path, undefined, true);
        const raws = payload.external_events ?? payload.events ?? [];
        const normalized = raws.map(normalizeEvent);
        return buildEventsByDate(normalized);
    } catch (_e) {
        // 未連携 / 401 / 404 などはエラーにせず空で返す（タスク表示を壊さない方針）
        // 開発検証用 mock フラグが有効なときのみ、フォールバックでサンプルイベントを返す。
        if (isMockEnabled()) {
            return buildEventsByDate(buildMockEventsForRange(from, to));
        }
        return new Map();
    }
};

export type UseExternalEventsResult = {
    eventsByDate: Map<string, ExternalEvent[]>;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
};

export const useExternalEvents = (
    from: string,
    to: string,
    viewMode?: ExternalEventsViewMode
): UseExternalEventsResult => {
    const [eventsByDate, setEventsByDate] = useState<Map<string, ExternalEvent[]>>(new Map());
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const reqIdRef = useRef(0);

    const cacheKey = `${from}__${to}`;

    const load = useCallback(async (force: boolean) => {
        if (!from || !to) {
            setEventsByDate(new Map());
            setLoading(false);
            return;
        }

        // R-039 Phase 3 UX: viewMode が指定されていて、設定でそのビューが OFF の場合は fetch しない
        if (viewMode) {
            const enabledViews = readExternalEventsViews();
            if (!enabledViews.includes(viewMode)) {
                setEventsByDate(new Map());
                setLoading(false);
                return;
            }
        }

        const cached = cache.get(cacheKey);
        const fresh = cached && (Date.now() - cached.fetchedAt) < CACHE_TTL_MS;
        if (fresh && !force) {
            setEventsByDate(cached!.data);
            setLoading(false);
            return;
        }

        setLoading(true);
        const myReqId = ++reqIdRef.current;
        try {
            const data = await fetchExternalEvents(from, to);
            if (myReqId !== reqIdRef.current) return;
            cache.set(cacheKey, { fetchedAt: Date.now(), data });
            setEventsByDate(data);
            setError(null);
        } catch (e) {
            if (myReqId !== reqIdRef.current) return;
            setError(e as Error);
            setEventsByDate(new Map());
        } finally {
            if (myReqId === reqIdRef.current) setLoading(false);
        }
    }, [from, to, cacheKey, viewMode]);

    useEffect(() => {
        load(false);
    }, [load]);

    const refresh = useCallback(async () => {
        await load(true);
    }, [load]);

    return { eventsByDate, loading, error, refresh };
};
