import { describe, it, expect } from 'vitest';
import { addDays, endOfWeek, format, startOfWeek } from 'date-fns';
import { Item } from '../../types';
import {
    classifyDueDateBuckets,
    sumEstimatedMinutes,
    countStatusSummary,
    resolveDailyCapacityMinutes,
} from '../assigneeViewBuckets';

// 週初め（日曜）を基準にすることで「今週」バケットの検証を曜日に依存させない
const now = (() => {
    const base = startOfWeek(new Date(2026, 6, 9, 9, 0, 0), { weekStartsOn: 0 });
    base.setHours(9, 0, 0, 0);
    return base;
})();

function makeItem(overrides: Partial<Item>): Item {
    return {
        id: overrides.id || 'item-1',
        title: overrides.title || 'テスト項目',
        status: overrides.status || 'focus',
        focusOrder: 0,
        isEngaged: false,
        statusUpdatedAt: 0,
        interrupt: false,
        weight: 1,
        createdAt: 0,
        updatedAt: 0,
        ...overrides,
    };
}

describe('classifyDueDateBuckets', () => {
    it('due_date が本日のアイテムを今日バケットに分類する', () => {
        const item = makeItem({ id: 'today-1', due_date: format(now, 'yyyy-MM-dd') });
        const buckets = classifyDueDateBuckets([item], now);
        expect(buckets.today.map(i => i.id)).toEqual(['today-1']);
        expect(buckets.tomorrow).toHaveLength(0);
        expect(buckets.thisWeek).toHaveLength(0);
    });

    it('due_date が翌日のアイテムを明日バケットに分類する', () => {
        const item = makeItem({ id: 'tomorrow-1', due_date: format(addDays(now, 1), 'yyyy-MM-dd') });
        const buckets = classifyDueDateBuckets([item], now);
        expect(buckets.tomorrow.map(i => i.id)).toEqual(['tomorrow-1']);
    });

    it('due_date が明後日〜今週末のアイテムを今週バケットに分類する', () => {
        const item = makeItem({ id: 'week-1', due_date: format(addDays(now, 2), 'yyyy-MM-dd') });
        const weekEndItem = makeItem({ id: 'week-2', due_date: format(endOfWeek(now, { weekStartsOn: 0 }), 'yyyy-MM-dd') });
        const buckets = classifyDueDateBuckets([item, weekEndItem], now);
        expect(buckets.thisWeek.map(i => i.id).sort()).toEqual(['week-1', 'week-2']);
    });

    it('今週の範囲外（来週以降）のアイテムはどのバケットにも含めない', () => {
        const item = makeItem({ id: 'next-week', due_date: format(addDays(now, 9), 'yyyy-MM-dd') });
        const buckets = classifyDueDateBuckets([item], now);
        expect(buckets.today).toHaveLength(0);
        expect(buckets.tomorrow).toHaveLength(0);
        expect(buckets.thisWeek).toHaveLength(0);
    });

    it('due_date が無いアイテムはどのバケットにも含めない', () => {
        const item = makeItem({ id: 'no-due', due_date: null });
        const buckets = classifyDueDateBuckets([item], now);
        expect(buckets.today).toHaveLength(0);
        expect(buckets.tomorrow).toHaveLength(0);
        expect(buckets.thisWeek).toHaveLength(0);
    });

    it('status=done のアイテムは due_date が本日でもバケットに含めない', () => {
        const item = makeItem({ id: 'done-1', status: 'done', due_date: format(now, 'yyyy-MM-dd') });
        const buckets = classifyDueDateBuckets([item], now);
        expect(buckets.today).toHaveLength(0);
    });
});

describe('sumEstimatedMinutes', () => {
    it('estimatedMinutes を合計する', () => {
        const items = [
            makeItem({ id: 'a', estimatedMinutes: 60 }),
            makeItem({ id: 'b', estimatedMinutes: 90 }),
        ];
        expect(sumEstimatedMinutes(items)).toBe(150);
    });

    it('estimatedMinutes が無いアイテムは0として扱う', () => {
        const items = [
            makeItem({ id: 'a', estimatedMinutes: 60 }),
            makeItem({ id: 'b' }),
        ];
        expect(sumEstimatedMinutes(items)).toBe(60);
    });

    it('空配列は0を返す', () => {
        expect(sumEstimatedMinutes([])).toBe(0);
    });
});

describe('countStatusSummary', () => {
    it('未完了・詰まり・待ちを正しく集計する（バケット外のアイテムも含む）', () => {
        const yesterday = format(addDays(now, -1), 'yyyy-MM-dd');
        const farFuture = format(addDays(now, 30), 'yyyy-MM-dd');
        const items = [
            makeItem({ id: 'overdue', status: 'focus', due_date: yesterday }), // 未完了 + 詰まり
            makeItem({ id: 'waiting', status: 'waiting', due_date: farFuture }), // 未完了 + 待ち
            makeItem({ id: 'done', status: 'done', due_date: yesterday }), // 完了（対象外）
            makeItem({ id: 'future', status: 'focus', due_date: farFuture }), // 未完了のみ
        ];
        const summary = countStatusSummary(items, now);
        expect(summary.incomplete).toBe(3);
        expect(summary.stuck).toBe(1);
        expect(summary.waiting).toBe(1);
    });

    it('空配列は全て0を返す', () => {
        expect(countStatusSummary([], now)).toEqual({ incomplete: 0, stuck: 0, waiting: 0 });
    });
});

describe('resolveDailyCapacityMinutes', () => {
    it('capacityProfile.standardWeeklyPattern に当日の値があればそれを優先する', () => {
        const dayIndex = now.getDay();
        const member = {
            dailyCapacityMinutes: 480,
            capacityProfile: { standardWeeklyPattern: { [dayIndex]: 240 }, exceptions: {} },
        };
        expect(resolveDailyCapacityMinutes(member, now)).toBe(240);
    });

    it('capacityProfile に当日の値が無ければ dailyCapacityMinutes を使う', () => {
        const member = { dailyCapacityMinutes: 480, capacityProfile: { standardWeeklyPattern: {}, exceptions: {} } };
        expect(resolveDailyCapacityMinutes(member, now)).toBe(480);
    });

    it('member が無い場合は0を返す', () => {
        expect(resolveDailyCapacityMinutes(null, now)).toBe(0);
        expect(resolveDailyCapacityMinutes(undefined, now)).toBe(0);
    });
});
