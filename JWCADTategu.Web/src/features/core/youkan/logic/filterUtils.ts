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
