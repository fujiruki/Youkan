import { describe, it, expect } from 'vitest';
import { Item, JudgmentStatus, CapacityConfig } from '../../types';
import { calcWeekLoad, formatWeekLoadHours, formatWeekLoadToastMessage } from '../weekLoad';

// テスト基準日: 2026-08-18（火）。週は月曜始まり: 2026-08-17(月)〜2026-08-23(日)
const TODAY = '2026-08-18';

const createItem = (status: JudgmentStatus, overrides: Partial<Item> = {}): Item => ({
    id: 'item',
    title: 'item',
    status,
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
});

// R-128/R-129 引継ぎ用の共有フィクスチャ（PHP側 QuantityServiceWeekLoadTest.php と同一の数値）。
// 週末（土日）は休日、平日は8h（480分）。今日(火)〜日曜まで: 火水木金=480*4=1920、土日=0。
const CAPACITY_CONFIG: CapacityConfig = {
    defaultDailyMinutes: 480,
    holidays: [{ type: 'weekly', value: '0' }, { type: 'weekly', value: '6' }],
    exceptions: {},
};

describe('calcWeekLoad (R-128 / F-27)', () => {
    it('今日〜今週の日曜の日次キャパを単純合計する（週末休日）', () => {
        const result = calcWeekLoad([], CAPACITY_CONFIG, TODAY);
        // 火水木金(480*4=1920) + 土日(0) = 1920
        expect(result.capacityMinutes).toBe(1920);
        expect(result.weekEnd).toBe('2026-08-23');
    });

    it('有効締切が今週の日曜以前（期限超過分も含む）のアイテムのestimatedMinutesを合計する', () => {
        const items = [
            createItem('todo', { id: 'a', due_date: '2026-08-19', estimatedMinutes: 900 }),
            createItem('inbox', { id: 'b', due_date: '2026-08-22', estimatedMinutes: 900 }),
            createItem('focus', { id: 'c', due_date: '2026-08-10', estimatedMinutes: 600 }), // 期限超過も含む
            createItem('inbox', { id: 'd', due_date: '2026-08-25', estimatedMinutes: 999 }), // 週末より後は対象外
        ];
        const result = calcWeekLoad(items, CAPACITY_CONFIG, TODAY);
        expect(result.needMinutes).toBe(900 + 900 + 600);
    });

    it('目安未入力（estimatedMinutesなし）は0として数える（水増ししない）', () => {
        const items = [createItem('inbox', { id: 'e', due_date: '2026-08-20' })];
        const result = calcWeekLoad(items, CAPACITY_CONFIG, TODAY);
        expect(result.needMinutes).toBe(0);
    });

    it('status が done/cancelled/someday のアイテムは対象外', () => {
        const items = [
            createItem('done', { id: 'done-item', due_date: '2026-08-19', estimatedMinutes: 100 }),
            createItem('cancelled', { id: 'cancelled-item', due_date: '2026-08-19', estimatedMinutes: 100 }),
            createItem('someday', { id: 'someday-item', due_date: '2026-08-19', estimatedMinutes: 100 }),
        ];
        const result = calcWeekLoad(items, CAPACITY_CONFIG, TODAY);
        expect(result.needMinutes).toBe(0);
    });

    it('プロジェクト（isProject=true）・削除済み・アーカイブ済みは対象外', () => {
        const items = [
            createItem('inbox', { id: 'p', due_date: '2026-08-19', estimatedMinutes: 100, isProject: true }),
            createItem('inbox', { id: 'del', due_date: '2026-08-19', estimatedMinutes: 100, deletedAt: Date.now() }),
            createItem('inbox', { id: 'arc', due_date: '2026-08-19', estimatedMinutes: 100, isArchived: true }),
        ];
        const result = calcWeekLoad(items, CAPACITY_CONFIG, TODAY);
        expect(result.needMinutes).toBe(0);
    });

    it('shortfall_minutes は max(0, need - capacity) で不足がなければ0', () => {
        const under = calcWeekLoad(
            [createItem('inbox', { id: 'small', due_date: '2026-08-19', estimatedMinutes: 60 })],
            CAPACITY_CONFIG,
            TODAY
        );
        expect(under.shortfallMinutes).toBe(0);
    });

    it('共有フィクスチャ: need=2400(40h) capacity=1920(32h) → shortfall=480(8h)。PHP版と同数', () => {
        const items = [
            createItem('todo', { id: 'a', title: 'A', due_date: '2026-08-19', estimatedMinutes: 900 }),
            createItem('inbox', { id: 'b', title: 'B', due_date: '2026-08-22', estimatedMinutes: 900 }),
            createItem('focus', { id: 'c', title: 'C', due_date: '2026-08-10', estimatedMinutes: 600 }),
            createItem('inbox', { id: 'e', title: 'E', due_date: '2026-08-20' }), // 目安なし=0
            createItem('inbox', { id: 'd', title: 'D', due_date: '2026-08-25', estimatedMinutes: 999 }), // 対象外
            createItem('done', { id: 'f', title: 'F', due_date: '2026-08-21', estimatedMinutes: 300 }), // 対象外
            createItem('inbox', { id: 'g', title: 'G', due_date: '2026-08-21', estimatedMinutes: 100, isProject: true }), // 対象外
            createItem('inbox', { id: 'h', title: 'H', due_date: '2026-08-21', estimatedMinutes: 50, deletedAt: Date.now() }), // 対象外
        ];
        const result = calcWeekLoad(items, CAPACITY_CONFIG, TODAY);
        expect(result.capacityMinutes).toBe(1920);
        expect(result.needMinutes).toBe(2400);
        expect(result.shortfallMinutes).toBe(480);
        expect(result.weekEnd).toBe('2026-08-23');
    });

    it('over_candidates: need_minutesに含まれるアイテムのうち有効締切が遅い順に最大2件', () => {
        const items = [
            createItem('todo', { id: 'a', title: 'A', due_date: '2026-08-19', estimatedMinutes: 900 }),
            createItem('inbox', { id: 'b', title: 'B', due_date: '2026-08-22', estimatedMinutes: 900 }),
            createItem('focus', { id: 'c', title: 'C', due_date: '2026-08-10', estimatedMinutes: 600 }),
            createItem('inbox', { id: 'e', title: 'E', due_date: '2026-08-20' }),
        ];
        const result = calcWeekLoad(items, CAPACITY_CONFIG, TODAY);
        expect(result.overCandidates).toEqual([
            { id: 'b', title: 'B', deadline: '2026-08-22', estimatedMinutes: 900 },
            { id: 'e', title: 'E', deadline: '2026-08-20', estimatedMinutes: 0 },
        ]);
    });

    it('over_candidates: 直近に作成・更新した本人（excludeItemId）は候補から除く', () => {
        const items = [
            createItem('todo', { id: 'a', title: 'A', due_date: '2026-08-19', estimatedMinutes: 900 }),
            createItem('inbox', { id: 'b', title: 'B', due_date: '2026-08-22', estimatedMinutes: 900 }),
            createItem('focus', { id: 'c', title: 'C', due_date: '2026-08-10', estimatedMinutes: 600 }),
        ];
        const result = calcWeekLoad(items, CAPACITY_CONFIG, TODAY, 'b');
        expect(result.overCandidates.map(c => c.id)).toEqual(['a', 'c']);
        // excludeItemId は over_candidates からのみ除外し、need_minutesの合計には引き続き含まれる
        expect(result.needMinutes).toBe(900 + 900 + 600);
    });

    it('capacityConfigがnull/undefined（未ロード時・テストダブル）でも例外を投げず0扱いにする', () => {
        expect(() => calcWeekLoad([], null as any, TODAY)).not.toThrow();
        expect(calcWeekLoad([], null as any, TODAY).capacityMinutes).toBe(0);
        expect(calcWeekLoad([], undefined as any, TODAY).capacityMinutes).toBe(0);
    });

    it('日別例外（exceptions）があればそちらを優先する', () => {
        const config: CapacityConfig = {
            ...CAPACITY_CONFIG,
            exceptions: { '2026-08-19': 0 }, // 水曜を休みに
        };
        const base = calcWeekLoad([], CAPACITY_CONFIG, TODAY).capacityMinutes;
        const withException = calcWeekLoad([], config, TODAY).capacityMinutes;
        expect(withException).toBe(base - 480);
    });
});

describe('formatWeekLoadHours (R-128 / §16)', () => {
    it('60分単位はそのまま整数のhで表示する', () => {
        expect(formatWeekLoadHours(480)).toBe('8h');
    });

    it('小数1桁までで表示する（30分刻み）', () => {
        expect(formatWeekLoadHours(510)).toBe('8.5h');
    });

    it('0分は0hを返す', () => {
        expect(formatWeekLoadHours(0)).toBe('0h');
    });
});

describe('formatWeekLoadToastMessage (R-128 / §16)', () => {
    it('§16の文言どおり「今週 Zh足りない。外す候補: A(8/22, 3h)／B(8/23, 4h)」を組み立てる', () => {
        const message = formatWeekLoadToastMessage({
            capacityMinutes: 1920,
            needMinutes: 2400,
            shortfallMinutes: 480,
            weekEnd: '2026-08-23',
            overCandidates: [
                { id: 'a', title: 'A', deadline: '2026-08-22', estimatedMinutes: 180 },
                { id: 'b', title: 'B', deadline: '2026-08-23', estimatedMinutes: 240 },
            ],
        });
        expect(message).toBe('今週 8h足りない。外す候補: A(8/22, 3h)／B(8/23, 4h)');
    });

    it('候補が0件のときは「外す候補」部分を省く', () => {
        const message = formatWeekLoadToastMessage({
            capacityMinutes: 1920,
            needMinutes: 2400,
            shortfallMinutes: 480,
            weekEnd: '2026-08-23',
            overCandidates: [],
        });
        expect(message).toBe('今週 8h足りない。');
    });
});
