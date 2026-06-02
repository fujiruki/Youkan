import { Item } from '../types';
import { startOfDay, isBefore, isSameDay } from 'date-fns';

export const STATUS_META = {
    inbox: { label: 'Inbox', icon: 'Inbox', color: 'slate' },
    focus: { label: '集中', icon: 'Target', color: 'indigo' },
    waiting: { label: '待ち（外的要因）', icon: 'Hourglass', color: 'amber' },
    pending: { label: '保留（外的要因待ち）', icon: 'Pause', color: 'amber' },
    someday: { label: 'いつかやる（自分で寝かせる）', icon: 'Cloud', color: 'purple' },
    done: { label: '完了', icon: 'CheckCircle', color: 'green' },
} as const;

/**
 * R-035: 完了アイテムの共通スタイル。
 * 全ビュー（登録と集中 / 状況把握 / 全体一覧 / カレンダー / ガント / フローチャート / 読み上げ）で
 * 完了済（`status=done`）アイテムを「視覚的に控えめだが存在は確認できる」状態に統一する。
 */
export const COMPLETED_ITEM_CLASS = 'text-slate-400 line-through';

/**
 * R-035: アイテムが完了扱いかどうか判定する共通ヘルパー。
 * 内部状態として `done` を正とするが、過去のデータ互換のため `completed` / `log` も完了とみなす。
 */
export function isItemDone(item: Pick<Item, 'status'> | { status?: string | null }): boolean {
    const s = (item?.status ?? '') as string;
    return s === 'done' || s === 'completed' || s === 'log';
}

/**
 * Determines if an item is a candidate for "Today's Work".
 * @param item - The item to check
 * @param nowUnix - Current time in Unix seconds (optional, defaults to now)
 */
export function isTodayCandidate(item: Item, nowUnix?: number): boolean {
    // 1. Must be 'focus' status.
    if (item.status !== 'focus') return false;

    // 2. Flags override checks.
    // If it is already committed to today (manually), it shows up.
    if (item.flags?.is_today_commit) return true;

    // 3. Date Checks.
    const now = nowUnix ? new Date(nowUnix * 1000) : new Date();
    const todayStart = startOfDay(now);

    // If prep_date exists...
    if (item.prep_date) {
        const prepDate = new Date(item.prep_date * 1000);
        // If prep_date matches today or is in the past, it's a candidate.
        if (isBefore(prepDate, todayStart) || isSameDay(prepDate, todayStart)) {
            return true;
        }
    }

    return false;
}

/**
 * Determines if an item is considered overdue.
 * Note: 'Overdue' is an external warning, not a status.
 */
export function isOverdue(item: Item, nowString?: string): boolean {
    if (item.status === 'done') return false;
    if (!item.due_date) return false;

    // Default to strict today comparison
    // But since inputs are string "YYYY-MM-DD", simple string compare works for ISO format
    const today = nowString || new Date().toISOString().split('T')[0];

    return item.due_date < today;
}

/**
 * Helper to determine if an item needs decision.
 */
export function needsDecision(item: Item): boolean {
    return !!item.flags?.needs_decision;
}
