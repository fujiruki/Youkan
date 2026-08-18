import { Item } from '../types';
import { parseISO, startOfDay, differenceInCalendarDays } from 'date-fns';
import { getEffectiveDeadline } from './flowAutoPlace';

const EXCLUDED_STATUSES = new Set(['done', 'cancelled', 'someday']);

const isOverdueTarget = (item: Item, todayTime: number): boolean => {
    if (item.deletedAt) return false;
    if (item.isArchived) return false;
    if (item.isProject) return false;
    if (EXCLUDED_STATUSES.has(item.status)) return false;
    const deadline = getEffectiveDeadline(item);
    return deadline !== null && deadline < todayTime;
};

export interface OverdueItem {
    id: string;
    title: string;
    estimatedMinutes: number;
    deadline: number; // 有効締切（ms）
    deadlineField: 'due_date' | 'prep_date'; // R-147: 有効締切がどちらの日付か（編集欄はこちらを更新する）
    overdueDays: number;
    meta: Record<string, any> | null | undefined;
}

export interface OverdueGroup {
    projectId: string | null; // null = その他
    groupTitle: string;
    items: OverdueItem[];
    totalMinutes: number;
    oldestOverdueDays: number;
    contacted: boolean;
    contactedAt: string | null;
}

const buildGroupTitle = (item: Item): string => {
    if (!item.projectId) return 'その他';
    if (item.clientName) return `${item.clientName}／${item.projectTitle || ''}`;
    return item.projectTitle || 'その他';
};

/**
 * R-136 / F-55: 期限超過分（R-128 weekLoadのneed_minutesに含まれる超過分そのもの）を
 * 案件（project_id）ごとにグループ化する。抽出条件は weekLoad.ts の超過判定と一致させる
 * （有効締切が今日より前）。並びは未連絡ブロックが上・最古超過日順、連絡済みは下。
 */
export function buildOverdueGroups(items: Item[], today: string): OverdueGroup[] {
    const todayDate = startOfDay(parseISO(today));
    const todayTime = todayDate.getTime();

    const targets = items.filter(item => isOverdueTarget(item, todayTime));

    const groupsByKey = new Map<string, { projectId: string | null; groupTitle: string; rawItems: Item[] }>();
    for (const item of targets) {
        const key = item.projectId || '__none__';
        if (!groupsByKey.has(key)) {
            groupsByKey.set(key, {
                projectId: item.projectId || null,
                groupTitle: buildGroupTitle(item),
                rawItems: [],
            });
        }
        groupsByKey.get(key)!.rawItems.push(item);
    }

    const groups: OverdueGroup[] = Array.from(groupsByKey.values()).map(({ projectId, groupTitle, rawItems }) => {
        const overdueItems: OverdueItem[] = rawItems
            .map(item => {
                const deadline = getEffectiveDeadline(item) as number;
                // due_date と prep_date の両方があれば早い方。同日なら due_date（従来どおり納期を編集）
                const dueOnly = getEffectiveDeadline({ ...item, prep_date: undefined });
                return {
                    id: item.id,
                    title: item.title,
                    estimatedMinutes: item.estimatedMinutes ?? 0,
                    deadline,
                    deadlineField: (dueOnly === deadline ? 'due_date' : 'prep_date') as OverdueItem['deadlineField'],
                    overdueDays: differenceInCalendarDays(todayDate, new Date(deadline)),
                    meta: item.meta,
                };
            })
            .sort((a, b) => a.deadline - b.deadline);

        const totalMinutes = overdueItems.reduce((sum, i) => sum + i.estimatedMinutes, 0);
        const oldestOverdueDays = overdueItems.reduce((max, i) => Math.max(max, i.overdueDays), 0);
        const contactedAts = rawItems.map(i => i.meta?.contacted_at).filter((v): v is string => !!v);
        const contacted = contactedAts.length === rawItems.length && rawItems.length > 0;
        const contactedAt = contacted ? contactedAts.sort().slice(-1)[0] : null;

        return {
            projectId,
            groupTitle,
            items: overdueItems,
            totalMinutes,
            oldestOverdueDays,
            contacted,
            contactedAt,
        };
    });

    groups.sort((a, b) => {
        if (a.contacted !== b.contacted) return a.contacted ? 1 : -1;
        return b.oldestOverdueDays - a.oldestOverdueDays;
    });

    return groups;
}
