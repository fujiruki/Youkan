import { format, parseISO, startOfDay } from 'date-fns';
import { CapacityConfig, Item, JudgmentStatus } from '../types';
import { QuantityContext, QuantityEngine } from './QuantityEngine';
import { getEffectiveDeadline } from './flowAutoPlace';

/** R-129 / F-28: 個人設定未設定時の安全係数の既定値 */
export const DEFAULT_SAFETY_FACTOR = 1.5;

export interface LatestStartResult {
    /** 最遅着手日（YYYY-MM-DD）。対象外・目安未入力のときは null */
    date: string | null;
    /** 今日 > 最遅着手日（期限は先なのに今日始めないと間に合わない） */
    isLate: boolean;
    reason: 'ok' | 'no-estimate' | 'not-applicable';
}

const TARGET_STATUSES: ReadonlySet<JudgmentStatus> = new Set(['inbox', 'todo', 'focus']);

const NOT_APPLICABLE: LatestStartResult = { date: null, isLate: false, reason: 'not-applicable' };

/** 個人設定の安全係数（未設定は既定1.5） */
export function resolveSafetyFactor(capacityConfig: CapacityConfig | null | undefined): number {
    return capacityConfig?.safetyFactor ?? DEFAULT_SAFETY_FACTOR;
}

/**
 * R-129 / F-28: 最遅着手日「着手 M/d」の計算。
 * 既存 QuantityEngine.calculateAllocationDetails の逆算結果（最古のstep日）をそのまま使う。
 * QuantityEngine本体は変更しない。
 *
 * 対象: status ∈ {inbox, todo, focus}、目安時間あり、有効締切あり、有効締切 ≥ 今日。
 * それ以外（waiting/pending/someday/done/cancelled、期限超過、締切なし）は not-applicable。
 * 目安未入力のみ no-estimate として区別する。
 */
export function getLatestStart(item: Item, ctx: QuantityContext, safetyFactor: number, today: string): LatestStartResult {
    if (!TARGET_STATUSES.has(item.status)) return NOT_APPLICABLE;

    const effectiveDeadline = getEffectiveDeadline(item);
    if (effectiveDeadline === null) return NOT_APPLICABLE;

    const todayStart = startOfDay(parseISO(today)).getTime();
    if (effectiveDeadline < todayStart) return NOT_APPLICABLE; // 期限超過分には出さない（R-127の領分）

    const estimatedMinutes = item.estimatedMinutes ?? 0;
    if (estimatedMinutes <= 0) return { date: null, isLate: false, reason: 'no-estimate' };

    const adjustedMinutes = Math.round(estimatedMinutes * safetyFactor);
    const steps = QuantityEngine.calculateAllocationDetails(new Date(effectiveDeadline), adjustedMinutes, ctx, item.tenantId);
    if (steps.length === 0) return NOT_APPLICABLE;

    const latestStartDate = steps[0].date; // 昇順ソート済みのため先頭が最古=最遅着手日
    return {
        date: format(latestStartDate, 'yyyy-MM-dd'),
        isLate: todayStart > latestStartDate.getTime(),
        reason: 'ok',
    };
}

/**
 * 飽和ガード: 表示順で isLate な最初の limit 件だけを赤字強調の対象にする。
 * 11件目以降は灰字のまま（全体一覧のフィルタ「着手遅れ」で絞り込む）。
 */
export function selectLateStartHighlightIds(orderedResults: { id: string; isLate: boolean }[], limit = 10): Set<string> {
    const ids = new Set<string>();
    for (const r of orderedResults) {
        if (ids.size >= limit) break;
        if (r.isLate) ids.add(r.id);
    }
    return ids;
}

/** 表示トークン文字列。対象外は null、目安未入力は「目安？」、それ以外は「着手 M/d」 */
export function formatLatestStartToken(result: LatestStartResult): string | null {
    if (result.reason === 'not-applicable') return null;
    if (result.reason === 'no-estimate') return '目安？';
    return `着手 ${format(parseISO(result.date!), 'M/d')}`;
}

/** ツールチップ文字列（事実のみ）。「最遅着手日 8/20（目安×1.5、日次キャパから逆算）」 */
export function formatLatestStartTooltip(result: LatestStartResult, safetyFactor: number): string | undefined {
    if (result.reason !== 'ok' || !result.date) return undefined;
    return `最遅着手日 ${format(parseISO(result.date), 'M/d')}（目安×${safetyFactor}、日次キャパから逆算）`;
}
