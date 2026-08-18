import { Item } from '../types';
import { parseISO, startOfDay, startOfWeek } from 'date-fns';
import { getEffectiveDeadline } from './flowAutoPlace';
import { isReviewDue } from './statusUtils';

const EXCLUDED_STATUSES = new Set(['done', 'cancelled', 'someday']);

const isReviewTarget = (item: Item, today: string, todayStart: number): boolean => {
    if (item.deletedAt) return false;
    if (item.isArchived) return false;
    if (item.isProject) return false;
    if (EXCLUDED_STATUSES.has(item.status)) return false;

    const deadline = getEffectiveDeadline(item);
    const isOverdue = deadline !== null && deadline < todayStart;
    return isOverdue || isReviewDue(item, today);
};

/**
 * R-127: 要判断キュー（要判断キュー「捌く」）の対象抽出・並び替え。
 * 定義は 02_機能仕様.md F-26 に厳密に従う。ヘッダー件数バッジ・誘導カード・
 * ReviewSweep・全体一覧フィルタはすべてこの1関数の結果を使う（並びの再実装禁止）。
 *
 * 対象: deletedAt なし・isArchived=false・status が done/cancelled/someday 以外・
 * プロジェクト（isProject）は除外、かつ「有効締切が今日より前」または
 * 「status=pending かつ review_date が今日以前」のいずれか。
 *
 * 並び: ①再確認到来 → ②目安時間の短い順（未入力は最後）→ ③有効締切の古い順。
 * 古いアイテムを自動的に除外・処分することはしない。
 */
export function buildReviewQueue(items: Item[], today: string): Item[] {
    const todayStart = startOfDay(parseISO(today)).getTime();

    return items
        .filter(item => isReviewTarget(item, today, todayStart))
        .sort((a, b) => {
            const aReview = isReviewDue(a, today);
            const bReview = isReviewDue(b, today);
            if (aReview !== bReview) return aReview ? -1 : 1;

            const aMinutes = a.estimatedMinutes ?? null;
            const bMinutes = b.estimatedMinutes ?? null;
            if (aMinutes === null && bMinutes !== null) return 1;
            if (aMinutes !== null && bMinutes === null) return -1;
            if (aMinutes !== null && bMinutes !== null && aMinutes !== bMinutes) {
                return aMinutes - bMinutes;
            }

            const aDeadline = getEffectiveDeadline(a);
            const bDeadline = getEffectiveDeadline(b);
            if (aDeadline === null && bDeadline !== null) return 1;
            if (aDeadline !== null && bDeadline === null) return -1;
            if (aDeadline !== null && bDeadline !== null) return aDeadline - bDeadline;
            return 0;
        });
}

/**
 * R-127: 今週（月曜0:00〜、ローカル日付基準）に「断った」（status=cancelled）件数。
 * ReviewSweep完了ビューのKPI表示に使う。褒め・評価語は含めない、数字のみ。
 */
export function countDeclinedThisWeek(items: Item[], today: string): number {
    const weekStart = startOfWeek(parseISO(today), { weekStartsOn: 1 }).getTime();
    return items.filter(item => {
        if (item.status !== 'cancelled') return false;
        if (!item.statusUpdatedAt) return false;
        return item.statusUpdatedAt * 1000 >= weekStart;
    }).length;
}
