import { FilterMode } from '../types';

/**
 * R-148: 集計値の母集団ラベル（03_画面設計.md §0）。
 * 面積のない箇所（CapacityBar 等）は文字を足さず title にこの語を出す。
 */

/** 分母（キャパ）のスコープ語。filterMode 未指定・all=全体枠、personal=個人枠、company／テナント指定=会社枠 */
export const scopeCapacityWord = (filterMode?: FilterMode | null): '全体枠' | '個人枠' | '会社枠' =>
    !filterMode || filterMode === 'all' ? '全体枠' : filterMode === 'personal' ? '個人枠' : '会社枠';

/** CapacityBar の title。分子（タスクのみ／予定込）／完了込・未完了のみ／分母スコープ */
export const capacityBarLabel = (
    numerator: 'タスクのみ' | '予定込',
    includesCompleted: boolean,
    scope: '全体枠' | '個人枠' | '会社枠'
): string => `${numerator}／${includesCompleted ? '完了込' : '未完了のみ'}／${scope}`;
