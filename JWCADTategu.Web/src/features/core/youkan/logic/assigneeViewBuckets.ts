import { addDays, endOfWeek, isSameDay, startOfDay } from 'date-fns';
import { CapacityProfile, Item } from '../types';
import { safeFormat, safeParseDate } from './dateUtils';
import { isItemDone, isOverdue } from './statusUtils';

export interface AssigneeViewBuckets {
    today: Item[];
    tomorrow: Item[];
    thisWeek: Item[];
}

/**
 * due_date を基準に「今日／明日／今週」の3バケットへ分類する（03_画面設計.md §13.5）。
 * due_date が無いアイテム・完了済み（status=done）アイテムはどのバケットにも含めない。
 */
export function classifyDueDateBuckets(items: Item[], now: Date = new Date()): AssigneeViewBuckets {
    const today = startOfDay(now);
    const tomorrow = addDays(today, 1);
    const weekEnd = startOfDay(endOfWeek(today, { weekStartsOn: 0 }));

    const buckets: AssigneeViewBuckets = { today: [], tomorrow: [], thisWeek: [] };

    for (const item of items) {
        if (isItemDone(item)) continue;

        const due = safeParseDate(item.due_date);
        if (!due) continue;
        const dueDay = startOfDay(due);

        if (isSameDay(dueDay, today)) {
            buckets.today.push(item);
        } else if (isSameDay(dueDay, tomorrow)) {
            buckets.tomorrow.push(item);
        } else if (dueDay > tomorrow && dueDay <= weekEnd) {
            buckets.thisWeek.push(item);
        }
    }

    return buckets;
}

/**
 * アイテム群の estimatedMinutes 合計（今日バケットの所要時間合計に使用、§13.6）。
 */
export function sumEstimatedMinutes(items: Item[]): number {
    return items.reduce((sum, item) => sum + (item.estimatedMinutes || 0), 0);
}

export interface AssigneeViewStatusSummary {
    incomplete: number;
    stuck: number;
    waiting: number;
}

/**
 * 未完了／詰まり／待ちの件数集計（03_画面設計.md §13.7）。
 * バケット分類とは無関係に、担当者の全アイテムを対象とする。
 */
export function countStatusSummary(items: Item[], now: Date = new Date()): AssigneeViewStatusSummary {
    const nowString = safeFormat(now, 'yyyy-MM-dd');
    let incomplete = 0;
    let stuck = 0;
    let waiting = 0;

    for (const item of items) {
        if (!isItemDone(item)) {
            incomplete++;
            if (isOverdue(item, nowString)) {
                stuck++;
            }
        }
        if (item.status === 'waiting') {
            waiting++;
        }
    }

    return { incomplete, stuck, waiting };
}

interface CapacityMember {
    dailyCapacityMinutes?: number;
    capacityProfile?: CapacityProfile;
}

/**
 * メンバーの当日キャパシティ（分）を解決する（03_画面設計.md §13.6）。
 * capacityProfile.standardWeeklyPattern に当日分の値があればそれを優先し、無ければ dailyCapacityMinutes を使う。
 */
export function resolveDailyCapacityMinutes(member: CapacityMember | null | undefined, now: Date = new Date()): number {
    if (!member) return 0;

    const dayIndex = now.getDay();
    const patternValue = member.capacityProfile?.standardWeeklyPattern?.[dayIndex];
    if (typeof patternValue === 'number') {
        return patternValue;
    }

    return member.dailyCapacityMinutes ?? 0;
}
