import { describe, it, expect } from 'vitest';
import { QuantityEngine, QuantityContext } from '../QuantityEngine';
import { normalizeDateKey } from '../dateUtils';
import type { Item, CapacityConfig } from '../../types';

// テスト用の最小限アイテムファクトリ
function makeItem(overrides: Partial<Item>): Item {
    return {
        id: 'item-1',
        title: 'テストアイテム',
        status: 'focus',
        focusOrder: 1,
        isEngaged: false,
        interrupt: false,
        weight: 1,
        createdAt: 0,
        updatedAt: 0,
        statusUpdatedAt: 0,
        ...overrides,
    };
}

// 月〜金 480分、土日休みの標準 capacityConfig
const standardConfig: CapacityConfig = {
    defaultDailyMinutes: 480,
    holidays: [
        { type: 'weekly', value: '0' }, // 日曜
        { type: 'weekly', value: '6' }, // 土曜
    ],
    exceptions: {},
    standardWeeklyPattern: { 1: 480, 2: 480, 3: 480, 4: 480, 5: 480 },
};

// 会社例外あり（dailyCompanyExceptions）の capacityConfig
const companyConfig: CapacityConfig = {
    ...standardConfig,
    defaultCompanyWeeklyPattern: {
        1: { 'tenant-a': 240 }, // 月: A社 240分
        2: { 'tenant-a': 240 },
        3: { 'tenant-a': 240 },
        4: { 'tenant-a': 240 },
        5: { 'tenant-a': 240 },
    },
    dailyCompanyExceptions: {
        // 2026-06-15 (月) を A社 0分（祝日扱い）に override
        '2026-06-15': { 'tenant-a': 0 },
    },
};

// 標準コンテキスト（currentUser あり）
function makeContext(items: Item[], config: CapacityConfig = standardConfig, focusedTenantId?: string | null): QuantityContext {
    return {
        items,
        members: [],
        capacityConfig: config,
        focusedTenantId: focusedTenantId ?? null,
        currentUser: {
            id: 'user-1',
            isCompanyAccount: false,
            joinedTenants: [{ id: 'tenant-a', name: 'A社' }],
        },
    };
}

// 日付を生成するヘルパー（YYYY-MM-DD を Date に変換）
function d(dateStr: string): Date {
    return new Date(dateStr + 'T00:00:00');
}

describe('QuantityEngine キャッシュ導入後の結果一致テスト', () => {
    describe('calculateMetrics: 単一アイテム・個人', () => {
        it('キャッシュ導入後でも全 QuantityMetric が正常に生成される（基本パターン）', () => {
            const item = makeItem({
                id: 'item-basic',
                due_date: '2026-06-19',
                estimatedMinutes: 960, // 2日分
                tenantId: null,
            });
            const ctx = makeContext([item]);
            const days: Date[] = [];
            for (let i = 0; i < 14; i++) {
                const day = new Date('2026-06-09T00:00:00');
                day.setDate(day.getDate() + i);
                days.push(day);
            }

            const result = QuantityEngine.calculateMetrics(days, ctx);

            // 各メトリクスが正常に生成されていること
            expect(result.size).toBe(14);
            for (const [, metric] of result) {
                expect(metric.volumeMinutes).toBeGreaterThanOrEqual(0);
                expect(metric.capacityMinutes).toBeGreaterThanOrEqual(0);
                expect(typeof metric.ratio).toBe('number');
                expect(typeof metric.isHoliday).toBe('boolean');
            }
        });

        it('allocatedMinutes の合計が estimatedMinutes と等しい（全日就業日が確保できる範囲）', () => {
            const ctx = makeContext([], standardConfig);
            const end = d('2026-06-19'); // 金曜
            const estimated = 960;
            const steps = QuantityEngine.calculateAllocationDetails(end, estimated, ctx, null);
            const totalAllocated = steps.reduce((sum, s) => sum + s.allocatedMinutes, 0);

            expect(totalAllocated).toBe(estimated);
        });
    });

    describe('calculateMetrics: 複数アイテム・複数テナント', () => {
        it('個人アイテムと会社アイテムが混在しても全メトリクスが非負', () => {
            const items: Item[] = [
                makeItem({
                    id: 'item-personal',
                    due_date: '2026-06-20',
                    estimatedMinutes: 480,
                    tenantId: null,
                }),
                makeItem({
                    id: 'item-company-a',
                    due_date: '2026-06-18',
                    estimatedMinutes: 720,
                    tenantId: 'tenant-a',
                }),
                makeItem({
                    id: 'item-company-b',
                    due_date: '2026-06-17',
                    estimatedMinutes: 480,
                    tenantId: 'tenant-b',
                }),
            ];
            const ctx = makeContext(items, standardConfig);
            const days: Date[] = [];
            for (let i = 0; i < 21; i++) {
                const day = new Date('2026-06-01T00:00:00');
                day.setDate(day.getDate() + i);
                days.push(day);
            }

            const result = QuantityEngine.calculateMetrics(days, ctx);

            expect(result.size).toBe(21);
            for (const [, metric] of result) {
                expect(metric.volumeMinutes).toBeGreaterThanOrEqual(0);
                expect(metric.capacityMinutes).toBeGreaterThanOrEqual(0);
            }
        });

        it('focusedTenantId 指定時でも全メトリクスが正常', () => {
            const items: Item[] = [
                makeItem({ id: 'item-a1', due_date: '2026-06-20', estimatedMinutes: 480, tenantId: 'tenant-a' }),
                makeItem({ id: 'item-a2', due_date: '2026-06-25', estimatedMinutes: 240, tenantId: 'tenant-a' }),
            ];
            const ctx = makeContext(items, companyConfig, 'tenant-a');
            const days: Date[] = [];
            for (let i = 0; i < 20; i++) {
                const day = new Date('2026-06-09T00:00:00');
                day.setDate(day.getDate() + i);
                days.push(day);
            }

            const result = QuantityEngine.calculateMetrics(days, ctx);

            expect(result.size).toBe(20);
            for (const [, metric] of result) {
                expect(metric.volumeMinutes).toBeGreaterThanOrEqual(0);
                expect(metric.capacityMinutes).toBeGreaterThanOrEqual(0);
            }
        });
    });

    describe('calculateMetrics: dailyCompanyExceptions（会社例外）', () => {
        it('dailyCompanyExceptions で 0 設定された日の capacity は 0 になる', () => {
            const items: Item[] = [
                makeItem({ id: 'item-exc', due_date: '2026-06-20', estimatedMinutes: 480, tenantId: 'tenant-a' }),
            ];
            const ctx = makeContext(items, companyConfig, 'tenant-a');
            // 2026-06-15 (月) は dailyCompanyExceptions で tenant-a: 0
            const target = d('2026-06-15');
            const days = [target];

            const result = QuantityEngine.calculateMetrics(days, ctx);
            const key = normalizeDateKey(target);
            const metric = result.get(key);

            expect(metric).toBeDefined();
            expect(metric!.capacityMinutes).toBe(0);
        });

        it('defaultCompanyWeeklyPattern で平日は 240分', () => {
            const items: Item[] = [];
            const ctx = makeContext(items, companyConfig, 'tenant-a');
            // 2026-06-16 (火) は例外なし → defaultCompanyWeeklyPattern[2][tenant-a] = 240
            const target = d('2026-06-16');
            const days = [target];

            const result = QuantityEngine.calculateMetrics(days, ctx);
            const key = normalizeDateKey(target);
            const metric = result.get(key);

            expect(metric).toBeDefined();
            expect(metric!.capacityMinutes).toBe(240);
        });
    });

    describe('calculateMetrics: 祝日', () => {
        it('土曜・日曜は isHoliday=true かつ capacityMinutes=0', () => {
            const ctx = makeContext([], standardConfig);
            const sat = d('2026-06-13'); // 土曜
            const sun = d('2026-06-14'); // 日曜
            const days = [sat, sun];

            const result = QuantityEngine.calculateMetrics(days, ctx);

            const satMetric = result.get(normalizeDateKey(sat));
            const sunMetric = result.get(normalizeDateKey(sun));

            expect(satMetric?.isHoliday).toBe(true);
            expect(satMetric?.capacityMinutes).toBe(0);
            expect(sunMetric?.isHoliday).toBe(true);
            expect(sunMetric?.capacityMinutes).toBe(0);
        });

        it('平日は isHoliday=false かつ capacityMinutes > 0', () => {
            const ctx = makeContext([], standardConfig);
            const tue = d('2026-06-09'); // 火曜
            const days = [tue];

            const result = QuantityEngine.calculateMetrics(days, ctx);
            const metric = result.get(normalizeDateKey(tue));

            expect(metric?.isHoliday).toBe(false);
            expect(metric?.capacityMinutes).toBeGreaterThan(0);
        });
    });

    describe('calculateMetrics: done アイテムの completedVolumeMinutes', () => {
        it('done アイテムの分は completedVolumeMinutes に反映される', () => {
            const thu = d('2026-06-11'); // 木曜
            const item = makeItem({
                id: 'item-done',
                status: 'done',
                due_date: '2026-06-11',
                estimatedMinutes: 480,
                tenantId: null,
            });
            const ctx = makeContext([item]);
            const days = [thu];

            const result = QuantityEngine.calculateMetrics(days, ctx);
            const metric = result.get(normalizeDateKey(thu));

            expect(metric).toBeDefined();
            expect(metric!.completedVolumeMinutes).toBeGreaterThan(0);
            expect(metric!.completedVolumeMinutes).toBeLessThanOrEqual(metric!.volumeMinutes);
        });
    });

    describe('calculateAllocationDetails / calculateAllocationDays: キャッシュ後も動作', () => {
        it('calculateAllocationDetails が空でないステップ配列を返す', () => {
            const ctx = makeContext([], standardConfig);
            const end = d('2026-06-19'); // 金曜
            const steps = QuantityEngine.calculateAllocationDetails(end, 960, ctx, null);

            expect(steps.length).toBeGreaterThan(0);
            for (const s of steps) {
                expect(s.allocatedMinutes).toBeGreaterThan(0);
                expect(s.capacityMinutes).toBeGreaterThan(0);
            }
        });

        it('calculateAllocationDays が日付配列を返す（昇順）', () => {
            const ctx = makeContext([], standardConfig);
            const end = d('2026-06-19');
            const dates = QuantityEngine.calculateAllocationDays(end, 960, ctx, null);

            expect(dates.length).toBeGreaterThan(0);
            // 昇順チェック
            for (let i = 1; i < dates.length; i++) {
                expect(dates[i].getTime()).toBeGreaterThan(dates[i - 1].getTime());
            }
        });
    });

    describe('someday アイテムはキャパシティ計算から除外', () => {
        it('someday アイテムの volumeMinutes は 0 のまま', () => {
            const thu = d('2026-06-11');
            const item = makeItem({
                id: 'item-someday',
                status: 'someday',
                due_date: '2026-06-11',
                estimatedMinutes: 480,
            });
            const ctx = makeContext([item]);
            const days = [thu];

            const result = QuantityEngine.calculateMetrics(days, ctx);
            const metric = result.get(normalizeDateKey(thu));

            expect(metric?.volumeMinutes).toBe(0);
        });
    });

    describe('キャッシュスコープ: 同一呼び出し内で結果が一致する', () => {
        it('同じ日付・テナントの capacity を複数アイテムで参照しても結果が同一', () => {
            // 同一期限・同一テナントで複数アイテム → 同じ日に複数回 calculateCapacityForDate が呼ばれる
            const items: Item[] = Array.from({ length: 5 }, (_, i) =>
                makeItem({
                    id: `item-multi-${i}`,
                    due_date: '2026-06-13', // 土曜（休み）→ 前週金曜にフォールバック
                    estimatedMinutes: 60,
                    tenantId: 'tenant-a',
                })
            );
            const ctx = makeContext(items, companyConfig, 'tenant-a');
            const days: Date[] = [];
            for (let i = 0; i < 14; i++) {
                const day = new Date('2026-06-09T00:00:00');
                day.setDate(day.getDate() + i);
                days.push(day);
            }

            // 各メトリクスの volumeMinutes は 5アイテム分積み上がっているはず
            const result = QuantityEngine.calculateMetrics(days, ctx);

            // 金曜日(2026-06-12)が全アイテムの期限日前の最後の平日
            const fri = d('2026-06-12');
            const friKey = normalizeDateKey(fri);
            const friMetric = result.get(friKey);
            expect(friMetric).toBeDefined();
            // 5アイテム × 60分 = 300分が 1 日に集中するはず
            expect(friMetric!.volumeMinutes).toBe(300);
        });
    });
});
