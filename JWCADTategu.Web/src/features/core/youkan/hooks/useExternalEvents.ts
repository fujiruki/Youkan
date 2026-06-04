import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClient } from '../../../../api/client';
import { ExternalEvent } from '../types/externalEvent';

/**
 * R-034 Phase 2 / R-039 Phase 3 UX / R-042-Y1: Google カレンダーイベント取得用 hook。
 *
 * - エンドポイント: `GET /google/calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD`
 *   フォールバック: `GET /calendar/grid?from=...&to=...` の `external_events`
 * - キャッシュは **月単位 key**（`YYYY-MM`）。TTL は 15 分。
 * - 未連携 / API エラー時は空 Map を返す（タスクの表示を壊さない）
 * - R-039: 設定画面の「表示するビュー」設定で OFF にされたビューでは fetch せず空 Map を返す
 * - R-042-Y1: `loadMore(direction, months)` で前後方向に月単位の追加ロードができる。
 *   既にキャッシュ済の月はスキップし、連続する未取得月は 1 リクエストにまとめる。
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

/** R-042-Y1: 月単位キャッシュエントリ（key は `YYYY-MM`） */
type MonthCacheEntry = {
    fetchedAt: number;
    data: Map<string, ExternalEvent[]>;
};

const monthCache = new Map<string, MonthCacheEntry>();

/** テスト用: キャッシュをリセットする内部関数 */
export const __clearExternalEventsCache = () => {
    monthCache.clear();
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

/** `YYYY-MM-DD` を 2 桁 0 埋めで作る */
const ymd = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

/** `YYYY-MM` を 2 桁 0 埋めで作る */
const monthKey = (year: number, monthIndex0: number): string => {
    const m = String(monthIndex0 + 1).padStart(2, '0');
    return `${year}-${m}`;
};

/** `YYYY-MM-DD` から `YYYY-MM` を抽出 */
const monthKeyFromDate = (dateStr: string): string => {
    if (!dateStr || dateStr.length < 7) return '';
    return dateStr.slice(0, 7);
};

/** `YYYY-MM-DD` を Date オブジェクトに（ローカルタイム） */
const parseYmd = (dateStr: string): Date | null => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
    if (!m) return null;
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};

/** from / to（YYYY-MM-DD）の範囲に含まれる月キー配列を返す（昇順・重複なし） */
const enumerateMonthKeys = (from: string, to: string): string[] => {
    const start = parseYmd(from);
    const end = parseYmd(to);
    if (!start || !end) return [];
    const keys: string[] = [];
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    let safety = 0;
    while (cur.getTime() <= last.getTime() && safety < 240) {
        keys.push(monthKey(cur.getFullYear(), cur.getMonth()));
        cur.setMonth(cur.getMonth() + 1);
        safety++;
    }
    return keys;
};

/** `YYYY-MM` の月初・月末（ローカル）を返す */
const monthRange = (mk: string): { from: string; to: string } | null => {
    const m = /^(\d{4})-(\d{2})$/.exec(mk);
    if (!m) return null;
    const y = Number(m[1]);
    const idx = Number(m[2]) - 1;
    const first = new Date(y, idx, 1);
    const last = new Date(y, idx + 1, 0);
    return { from: ymd(first), to: ymd(last) };
};

/** `YYYY-MM` を offset ヶ月オフセット */
const shiftMonth = (mk: string, offset: number): string => {
    const m = /^(\d{4})-(\d{2})$/.exec(mk);
    if (!m) return mk;
    const d = new Date(Number(m[1]), Number(m[2]) - 1 + offset, 1);
    return monthKey(d.getFullYear(), d.getMonth());
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
            const startMs = ev.startAt * 1000;
            const endMs = Math.max(ev.endAt * 1000, startMs + 1);
            const cursor = new Date(startMs);
            cursor.setHours(0, 0, 0, 0);
            const limit = new Date(endMs - 1);
            limit.setHours(0, 0, 0, 0);
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
    for (const arr of map.values()) {
        arr.sort((a, b) => a.startAt - b.startAt);
    }
    return map;
};

const MOCK_FLAG_KEY = 'YOUKAN_EXTERNAL_EVENTS_MOCK';

const buildMockEventsForRange = (from: string, to: string): ExternalEvent[] => {
    const [fy, fm, fd] = from.split('-').map(Number);
    const [ty, tm, td] = to.split('-').map(Number);
    if (!fy || !fm || !fd || !ty || !tm || !td) return [];
    const start = new Date(fy, fm - 1, fd);
    const end = new Date(ty, tm - 1, td);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
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
        {
            id: 'mock:6', calendarId: 'primary', eventId: 'mock6',
            startAt: dayStart(anchor, 1), endAt: dayStart(anchor, 1) + 60,
            allDay: true, title: '東京出張', location: '東京', htmlLink: null,
        },
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

/**
 * 指定 from〜to のレンジを 1 リクエストで fetch し、`Map<dateKey, events>` で返す。
 * 失敗時は空 Map（mock 有効時のみサンプル）。月キャッシュへの格納は呼び出し側で行う。
 */
const fetchRangeEvents = async (from: string, to: string): Promise<Map<string, ExternalEvent[]>> => {
    try {
        const path = `/google/calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
        const payload = await ApiClient.request<ApiPayload>('GET', path, undefined, true);
        const raws = payload.external_events ?? payload.events ?? [];
        const normalized = raws.map(normalizeEvent);
        return buildEventsByDate(normalized);
    } catch (_e) {
        if (isMockEnabled()) {
            return buildEventsByDate(buildMockEventsForRange(from, to));
        }
        return new Map();
    }
};

/**
 * 月キャッシュに対し、指定月キーごとにイベントマップを分配して格納する。
 * イベント所属月は dateKey の先頭 7 文字で判定。
 * - `monthKeys` の月は必ず（イベント 0 件でも）「取得済み」として登録する。
 * - dateKey が `monthKeys` 外に出ているイベント（fixture や TZ ずれ等）も、
 *   `monthKeys` の最初の月キーに紐づけて保存する。これによりキャッシュ間で
 *   イベント数が一致し、レンジ単位キャッシュとしての挙動が成立する。
 */
const storeMonthsInCache = (
    monthKeys: string[],
    rangeData: Map<string, ExternalEvent[]>,
    fetchedAt: number,
): void => {
    if (monthKeys.length === 0) return;
    const buckets = new Map<string, Map<string, ExternalEvent[]>>();
    for (const mk of monthKeys) {
        buckets.set(mk, new Map());
    }
    const primaryMk = monthKeys[0];
    for (const [dateKey, events] of rangeData.entries()) {
        const mk = monthKeyFromDate(dateKey);
        const target = buckets.has(mk) ? mk : primaryMk;
        buckets.get(target)!.set(dateKey, events);
    }
    for (const [mk, data] of buckets.entries()) {
        monthCache.set(mk, { fetchedAt, data });
    }
};

/** 月キャッシュをマージして範囲内の `Map<dateKey, events>` を生成 */
const mergeCachedMonths = (monthKeys: string[]): Map<string, ExternalEvent[]> => {
    const merged = new Map<string, ExternalEvent[]>();
    for (const mk of monthKeys) {
        const entry = monthCache.get(mk);
        if (!entry) continue;
        for (const [dateKey, events] of entry.data.entries()) {
            if (!merged.has(dateKey)) merged.set(dateKey, []);
            merged.get(dateKey)!.push(...events);
        }
    }
    for (const arr of merged.values()) {
        arr.sort((a, b) => a.startAt - b.startAt);
    }
    return merged;
};

/** ある月キーがキャッシュにあり、かつ TTL 内か */
const isMonthFresh = (mk: string): boolean => {
    const entry = monthCache.get(mk);
    if (!entry) return false;
    return (Date.now() - entry.fetchedAt) < CACHE_TTL_MS;
};

/** 連続する月キー配列をまとめてグループ化 */
const groupConsecutiveMonths = (monthKeys: string[]): string[][] => {
    const groups: string[][] = [];
    let current: string[] = [];
    for (const mk of monthKeys) {
        if (current.length === 0) {
            current.push(mk);
            continue;
        }
        const prev = current[current.length - 1];
        const prevDate = parseYmd(`${prev}-01`);
        const curDate = parseYmd(`${mk}-01`);
        if (!prevDate || !curDate) {
            groups.push(current);
            current = [mk];
            continue;
        }
        const expected = new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 1);
        if (expected.getTime() === curDate.getTime()) {
            current.push(mk);
        } else {
            groups.push(current);
            current = [mk];
        }
    }
    if (current.length > 0) groups.push(current);
    return groups;
};

/** ロード済み月キー集合の min/max を返す */
const minMaxMonth = (set: Set<string>): { min: string | null; max: string | null } => {
    if (set.size === 0) return { min: null, max: null };
    const sorted = Array.from(set).sort();
    return { min: sorted[0], max: sorted[sorted.length - 1] };
};

export type LoadMoreDirection = 'before' | 'after';

export type UseExternalEventsResult = {
    eventsByDate: Map<string, ExternalEvent[]>;
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    /** R-042-Y1: 前後方向に月単位で追加読み込み（連続未取得月はまとめて 1 リクエスト） */
    loadMore: (direction: LoadMoreDirection, months: number) => Promise<void>;
    /** R-042-Y1: 現在ロード済みの範囲（YYYY-MM-DD） */
    loadedRange: { from: string; to: string };
    /** R-042-Y1: loadMore による追加取得中フラグ */
    isLoadingMore: boolean;
};

export const useExternalEvents = (
    from: string,
    to: string,
    viewMode?: ExternalEventsViewMode
): UseExternalEventsResult => {
    const [eventsByDate, setEventsByDate] = useState<Map<string, ExternalEvent[]>>(new Map());
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<Error | null>(null);
    const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
    const [loadedRange, setLoadedRange] = useState<{ from: string; to: string }>({ from: '', to: '' });
    const reqIdRef = useRef(0);
    const loadedMonthsRef = useRef<Set<string>>(new Set());

    /** R-039: 現在 viewMode が有効か（無効なら fetch をスキップ） */
    const isViewEnabled = useCallback((): boolean => {
        if (!viewMode) return true;
        const enabledViews = readExternalEventsViews();
        return enabledViews.includes(viewMode);
    }, [viewMode]);

    const load = useCallback(async (force: boolean) => {
        if (!from || !to) {
            setEventsByDate(new Map());
            setLoadedRange({ from: '', to: '' });
            loadedMonthsRef.current = new Set();
            setLoading(false);
            return;
        }

        if (!isViewEnabled()) {
            setEventsByDate(new Map());
            setLoadedRange({ from: '', to: '' });
            loadedMonthsRef.current = new Set();
            setLoading(false);
            return;
        }

        const monthKeys = enumerateMonthKeys(from, to);
        if (monthKeys.length === 0) {
            setEventsByDate(new Map());
            setLoadedRange({ from, to });
            setLoading(false);
            return;
        }

        const needFetchMonths = force
            ? monthKeys.slice()
            : monthKeys.filter(mk => !isMonthFresh(mk));

        setLoading(true);
        const myReqId = ++reqIdRef.current;
        try {
            const groups = groupConsecutiveMonths(needFetchMonths);
            const now = Date.now();
            for (const group of groups) {
                const firstRange = monthRange(group[0]);
                const lastRange = monthRange(group[group.length - 1]);
                if (!firstRange || !lastRange) continue;
                const data = await fetchRangeEvents(firstRange.from, lastRange.to);
                if (myReqId !== reqIdRef.current) return;
                storeMonthsInCache(group, data, now);
            }

            for (const mk of monthKeys) {
                loadedMonthsRef.current.add(mk);
            }
            const merged = mergeCachedMonths(monthKeys);
            setEventsByDate(merged);
            setLoadedRange({ from, to });
            setError(null);
        } catch (e) {
            if (myReqId !== reqIdRef.current) return;
            setError(e as Error);
            setEventsByDate(new Map());
        } finally {
            if (myReqId === reqIdRef.current) setLoading(false);
        }
    }, [from, to, isViewEnabled]);

    useEffect(() => {
        load(false);
    }, [load]);

    const refresh = useCallback(async () => {
        await load(true);
    }, [load]);

    /**
     * R-042-Y1: 前後方向に月単位で追加読み込み。
     * - direction='after': ロード済み最大月の翌月以降 months ヶ月を対象
     * - direction='before': ロード済み最小月の前月以前 months ヶ月を対象
     * - 既にキャッシュ済 (TTL 内) の月はスキップ
     * - 連続する未取得月はまとめて 1 リクエストで取得
     * - months=0 / 未連携状態では何もしない
     */
    const loadMore = useCallback(async (direction: LoadMoreDirection, months: number) => {
        if (!months || months <= 0) return;
        if (!isViewEnabled()) return;

        const { min, max } = minMaxMonth(loadedMonthsRef.current);
        if (!min || !max) return;

        const targetMonths: string[] = [];
        if (direction === 'after') {
            for (let i = 1; i <= months; i++) {
                targetMonths.push(shiftMonth(max, i));
            }
        } else {
            for (let i = months; i >= 1; i--) {
                targetMonths.push(shiftMonth(min, -i));
            }
        }

        const needFetchMonths = targetMonths.filter(mk => !isMonthFresh(mk));
        if (needFetchMonths.length === 0) {
            for (const mk of targetMonths) {
                loadedMonthsRef.current.add(mk);
            }
            const allMonths = Array.from(loadedMonthsRef.current).sort();
            const merged = mergeCachedMonths(allMonths);
            setEventsByDate(merged);
            const firstRange = monthRange(allMonths[0]);
            const lastRange = monthRange(allMonths[allMonths.length - 1]);
            if (firstRange && lastRange) {
                setLoadedRange({ from: firstRange.from, to: lastRange.to });
            }
            return;
        }

        setIsLoadingMore(true);
        try {
            const groups = groupConsecutiveMonths(needFetchMonths);
            const now = Date.now();
            for (const group of groups) {
                const firstRange = monthRange(group[0]);
                const lastRange = monthRange(group[group.length - 1]);
                if (!firstRange || !lastRange) continue;
                const data = await fetchRangeEvents(firstRange.from, lastRange.to);
                storeMonthsInCache(group, data, now);
            }
            for (const mk of targetMonths) {
                loadedMonthsRef.current.add(mk);
            }
            const allMonths = Array.from(loadedMonthsRef.current).sort();
            const merged = mergeCachedMonths(allMonths);
            setEventsByDate(merged);
            const firstRange = monthRange(allMonths[0]);
            const lastRange = monthRange(allMonths[allMonths.length - 1]);
            if (firstRange && lastRange) {
                setLoadedRange({ from: firstRange.from, to: lastRange.to });
            }
        } finally {
            setIsLoadingMore(false);
        }
    }, [isViewEnabled]);

    return { eventsByDate, loading, error, refresh, loadMore, loadedRange, isLoadingMore };
};
