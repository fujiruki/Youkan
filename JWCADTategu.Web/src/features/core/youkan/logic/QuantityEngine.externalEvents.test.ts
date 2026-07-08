import { describe, it, expect } from 'vitest';
import { QuantityEngine, QuantityContext } from './QuantityEngine';
import { ExternalEvent, DEFAULT_ALL_DAY_WEIGHT_MINUTES } from '../types/externalEvent';

const buildTimedEvent = (
    dateKey: string,
    startHour: number,
    durationMinutes: number,
    extra: Partial<ExternalEvent> = {}
): ExternalEvent => {
    const [y, m, d] = dateKey.split('-').map(Number);
    const start = new Date(y, m - 1, d, startHour, 0, 0, 0);
    return {
        id: `g:${dateKey}:${startHour}`,
        calendarId: 'primary',
        eventId: `${dateKey}-${startHour}`,
        startAt: Math.floor(start.getTime() / 1000),
        endAt: Math.floor(start.getTime() / 1000) + durationMinutes * 60,
        allDay: false,
        title: 'evt',
        location: null,
        htmlLink: null,
        ...extra,
    };
};

const buildAllDayEvent = (dateKey: string, extra: Partial<ExternalEvent> = {}): ExternalEvent => ({
    ...buildTimedEvent(dateKey, 0, 0, extra),
    allDay: true,
    title: 'allday',
});

describe('QuantityEngine.calculateExternalVolume', () => {
    it('externalEvents が undefined / 空 Map のときは空 Map を返す', () => {
        expect(QuantityEngine.calculateExternalVolume(undefined).size).toBe(0);
        expect(QuantityEngine.calculateExternalVolume(new Map()).size).toBe(0);
    });

    it('時間指定イベントは (end - start) を分として加算', () => {
        const map = new Map<string, ExternalEvent[]>();
        map.set('2026-06-03', [
            buildTimedEvent('2026-06-03', 10, 60), // 60 min
            buildTimedEvent('2026-06-03', 14, 30), // 30 min
        ]);
        const result = QuantityEngine.calculateExternalVolume(map);
        expect(result.get('2026-06-03')).toBe(90);
    });

    it('終日イベントは allDayWeightMinutes（デフォルト 240）を加算', () => {
        const map = new Map<string, ExternalEvent[]>();
        map.set('2026-06-03', [buildAllDayEvent('2026-06-03')]);
        const result = QuantityEngine.calculateExternalVolume(map);
        expect(result.get('2026-06-03')).toBe(DEFAULT_ALL_DAY_WEIGHT_MINUTES);
    });

    it('終日イベントの分換算はユーザー設定値で上書きできる', () => {
        const map = new Map<string, ExternalEvent[]>();
        map.set('2026-06-03', [buildAllDayEvent('2026-06-03')]);
        const result = QuantityEngine.calculateExternalVolume(map, 120);
        expect(result.get('2026-06-03')).toBe(120);
    });

    it('時間帯が重複するイベントは二重加算する（事実重視）', () => {
        const map = new Map<string, ExternalEvent[]>();
        map.set('2026-06-03', [
            buildTimedEvent('2026-06-03', 10, 60),
            buildTimedEvent('2026-06-03', 10, 60), // 完全に同時刻に被る
        ]);
        const result = QuantityEngine.calculateExternalVolume(map);
        expect(result.get('2026-06-03')).toBe(120);
    });

    it('複数日付に跨る Map は日付ごとに集計する', () => {
        const map = new Map<string, ExternalEvent[]>();
        map.set('2026-06-03', [buildTimedEvent('2026-06-03', 10, 60)]);
        map.set('2026-06-04', [buildAllDayEvent('2026-06-04')]);
        const result = QuantityEngine.calculateExternalVolume(map);
        expect(result.get('2026-06-03')).toBe(60);
        expect(result.get('2026-06-04')).toBe(DEFAULT_ALL_DAY_WEIGHT_MINUTES);
    });
});

describe('QuantityEngine.calculateMetrics externalEvents integration', () => {
    const context: QuantityContext = {
        items: [],
        members: [],
        capacityConfig: {
            defaultDailyMinutes: 480,
            holidays: [],
            exceptions: {},
        },
        filterMode: 'all',
        currentUser: {
            id: 'user-1',
            isCompanyAccount: false,
            joinedTenants: [],
        },
    };

    it('YYYY-MM-DD key の externalEvents を量感分子と intensity に反映する', () => {
        const map = new Map<string, ExternalEvent[]>();
        map.set('2026-06-03', [buildTimedEvent('2026-06-03', 10, 120)]);

        const day = new Date(2026, 5, 3);
        const metrics = QuantityEngine.calculateMetrics([day], context, map);
        const metric = metrics.get(day.toDateString());

        expect(metric?.volumeMinutes).toBe(120);
        expect(metric?.ratio).toBe(0.25);
        expect(metric?.intensity).toBeGreaterThan(0);
    });
});
