import { FilterMode } from '../types';

/** filterMode がテナントID（UUID/文字列）かを判定する型ガード */
export const isTenantFilter = (filterMode: FilterMode): filterMode is string =>
    typeof filterMode === 'string' &&
    filterMode !== 'all' &&
    filterMode !== 'personal' &&
    filterMode !== 'company';

/** 会社コンテキスト（company 全体 or 特定テナント）かを判定 */
export const isCompanyContext = (filterMode: FilterMode): boolean =>
    filterMode === 'company' || isTenantFilter(filterMode);

/** テナントID を取り出す。テナントフィルター以外なら null */
export const getSelectedTenantId = (filterMode: FilterMode): string | null =>
    isTenantFilter(filterMode) ? filterMode : null;

/**
 * R-036: ガントビューの「完了を表示」スイッチに対応するフィルタ。
 * showCompleted=true なら何もしない。false なら status='done' を除外する。
 * バックエンドAPI には影響させず、フロント側でのみ適用する。
 */
export const applyGanttCompletedFilter = <T extends { status?: string }>(
    items: T[],
    showCompleted: boolean
): T[] => {
    if (showCompleted) return items;
    return items.filter(item => item.status !== 'done');
};
