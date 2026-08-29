import { Item } from '../types';
import { startOfDay, isBefore, isSameDay } from 'date-fns';

export const STATUS_META = {
    inbox: { label: 'Inbox', icon: 'Inbox', color: 'emerald' },
    // R-125: 「やる」と決めたが今日はやらない、自分の順番待ち。既存の状態色と被らないteal系
    todo: { label: '後日着手', icon: 'Clock', color: 'teal' },
    focus: { label: '集中', icon: 'Target', color: 'indigo' },
    waiting: { label: '待ち（外的要因）', icon: 'Hourglass', color: 'amber' },
    pending: { label: '保留（外的要因待ち）', icon: 'Pause', color: 'amber' },
    someday: { label: 'いつかやる（自分で寝かせる）', icon: 'Cloud', color: 'slate' },
    done: { label: '完了', icon: 'CheckCircle', color: 'green' },
    // R-124: 「断る」判断の結果。省スペースな箇所では label、
    // 右クリックメニュー等スペースに余裕がある箇所では labelWide を使う
    // （「キャンセル」だけの婉曲表現を避け、「断った」という判断行為を必ず残す）
    cancelled: { label: '断った', labelWide: 'キャンセル・断った', icon: 'XCircle', color: 'rose' },
} as const;

export type ItemStatusColors = { bg: string; border: string; text: string };
export type ItemStatusHexColors = { bg: string; border: string; text: string };

const ITEM_STATUS_COLORS: Record<string, ItemStatusColors> = {
    inbox: { bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800' },
    todo: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
    someday: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600' },
    focus: { bg: 'bg-indigo-100', border: 'border-indigo-400', text: 'text-indigo-800' },
    pending: { bg: 'bg-amber-100', border: 'border-amber-400', text: 'text-amber-800' },
    waiting: { bg: 'bg-orange-100', border: 'border-orange-400', text: 'text-orange-800' },
    done: { bg: 'bg-gray-100', border: 'border-gray-300', text: 'text-gray-400' },
    cancelled: { bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-400' },
};

const OVERDUE_ITEM_COLORS: ItemStatusColors = {
    bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-800',
};

const ITEM_STATUS_HEX_COLORS: Record<string, ItemStatusHexColors> = {
    inbox: { bg: '#ecfdf5', border: '#6ee7b7', text: '#065f46' },
    todo: { bg: '#f1f5f9', border: '#cbd5e1', text: '#334155' },
    someday: { bg: '#f1f5f9', border: '#cbd5e1', text: '#475569' },
    focus: { bg: '#e0e7ff', border: '#818cf8', text: '#3730a3' },
    pending: { bg: '#fef3c7', border: '#fbbf24', text: '#92400e' },
    waiting: { bg: '#ffedd5', border: '#fb923c', text: '#9a3412' },
    done: { bg: '#f3f4f6', border: '#d1d5db', text: '#9ca3af' },
    cancelled: { bg: '#fff1f2', border: '#fda4af', text: '#fb7185' },
};

const OVERDUE_ITEM_HEX_COLORS: ItemStatusHexColors = {
    bg: '#fff1f2', border: '#fda4af', text: '#9f1239',
};

/** R-159: status と期限超過を同じ要素に描画する画面の共通色決定。期限超過を優先する。 */
export function getItemStatusColors(
    item: Pick<Item, 'status' | 'due_date'> | { status?: string | null; due_date?: string | null },
    today?: string,
): ItemStatusColors {
    if (isOverdue(item as Item, today)) return OVERDUE_ITEM_COLORS;
    return ITEM_STATUS_COLORS[item.status ?? 'inbox'] ?? ITEM_STATUS_COLORS.inbox;
}

/** R-159: SVG/canvas など Tailwind class を使えない描画向けの同一ルール。 */
export function getItemStatusHexColors(
    item: Pick<Item, 'status' | 'due_date'> | { status?: string | null; due_date?: string | null },
    today?: string,
): ItemStatusHexColors {
    if (isOverdue(item as Item, today)) return OVERDUE_ITEM_HEX_COLORS;
    return ITEM_STATUS_HEX_COLORS[item.status ?? 'inbox'] ?? ITEM_STATUS_HEX_COLORS.inbox;
}

/** R-159: 全体一覧など小さなステータスドット向け。期限超過は実行中表示を含む状態色より優先する。 */
export function getItemStatusDotClass(
    item: Pick<Item, 'status' | 'due_date' | 'isEngaged'>,
    today?: string,
): string {
    if (isOverdue(item as Item, today)) return 'bg-rose-300 dark:bg-rose-700';
    if (item.isEngaged) return 'bg-emerald-600';
    switch (item.status) {
        case 'inbox': return 'bg-emerald-300 dark:bg-emerald-700';
        case 'focus': return 'bg-blue-600';
        case 'todo': return 'bg-teal-500';
        case 'waiting': return 'bg-purple-400';
        case 'someday': return 'bg-slate-300 dark:bg-slate-600';
        default: return 'bg-slate-300 dark:bg-slate-600';
    }
}

/** R-159: カレンダー内アイテム行の左端ステータス帯。既存色を保ちつつ対象3色を統一する。 */
export function getItemStatusBorderLeftClass(
    item: Pick<Item, 'status' | 'due_date'>,
    today?: string,
): string {
    if (isOverdue(item as Item, today)) return 'border-l-rose-300';
    switch (item.status) {
        case 'inbox': return 'border-l-emerald-300';
        case 'focus': return 'border-l-orange-400';
        case 'done': return 'border-l-emerald-400';
        case 'waiting': return 'border-l-amber-400';
        case 'someday': return 'border-l-slate-300';
        default: return 'border-l-slate-300';
    }
}

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

/**
 * R-125: pending アイテムの「再確認」判定。
 * status が pending かつ reviewDate（"YYYY-MM-DD"）が今日以前（今日を含む）なら true。
 * 登録と集中のPendingセクション・状況把握のPendingバケットの両方がこの1関数を使う
 * （先頭ソート・「再確認」バッジ表示の判定を1箇所に集約する）。
 */
export function isReviewDue(item: Pick<Item, 'status' | 'reviewDate'>, today: string): boolean {
    if (item.status !== 'pending') return false;
    if (!item.reviewDate) return false;
    return item.reviewDate <= today;
}
