import { describe, it, expect } from 'vitest';
import { applyGanttCompletedFilter } from '../../../youkan/logic/filterUtils';
import type { Item } from '../../../youkan/types';
import type { FilterMode } from '../../../youkan/types';

/**
 * R-065: VolumeCalendarScreen で右上「完了非表示」ボタン（hideCompleted）に統一
 *
 * FilterContext.hideCompleted（localStorage永続）を使い、
 * showCompletedInGantt ローカル state を廃止。
 * hideCompleted=false → 完了を表示（showCompleted=true 相当）
 * hideCompleted=true  → 完了を非表示（showCompleted=false 相当）
 */

const filterByMode = (item: Pick<Item, 'tenantId'>, filterMode: FilterMode): boolean => {
    if (filterMode === 'all') return true;
    if (filterMode === 'personal') return !item.tenantId || item.tenantId === '';
    if (filterMode === 'company') return !!item.tenantId;
    return item.tenantId === filterMode;
};

/**
 * VolumeCalendarScreen の visibleItems を再現するピュア関数（R-065 版）。
 * hideCompleted=false → 完了表示（showCompleted=true）
 * hideCompleted=true  → 完了非表示（showCompleted=false）
 */
const computeVisibleGanttItems = (
    rawItems: Item[],
    completedItems: Item[],
    filterMode: FilterMode,
    hideCompleted: boolean
): Item[] => {
    const showCompleted = !hideCompleted;
    const filteredItems = (rawItems || []).filter(i => filterByMode(i, filterMode));
    const filteredCompleted = (completedItems || []).filter(i => filterByMode(i, filterMode));
    const merged = showCompleted ? [...filteredItems, ...filteredCompleted] : filteredItems;
    return applyGanttCompletedFilter(merged, showCompleted);
};

describe('R-065: VolumeCalendarScreen で hideCompleted（右上ボタン）に統一', () => {
    const makeItem = (id: string, status: string, tenantId?: string): Item => ({
        id,
        title: id,
        status,
        tenantId: tenantId || '',
    } as Item);

    const rawItems: Item[] = [
        makeItem('active-1', 'inbox'),
        makeItem('active-2', 'focus'),
    ];

    const completedItems: Item[] = [
        makeItem('done-1', 'done'),
        makeItem('done-2', 'done'),
    ];

    it('hideCompleted=false（完了表示）のとき items + completedItems が全件返る', () => {
        const result = computeVisibleGanttItems(rawItems, completedItems, 'all', false);
        const ids = result.map(i => i.id).sort();
        expect(ids).toEqual(['active-1', 'active-2', 'done-1', 'done-2']);
    });

    it('hideCompleted=true（完了非表示）のとき completedItems は含まれず items のみが返る', () => {
        const result = computeVisibleGanttItems(rawItems, completedItems, 'all', true);
        const ids = result.map(i => i.id).sort();
        expect(ids).toEqual(['active-1', 'active-2']);
        expect(result.every(i => i.status !== 'done')).toBe(true);
    });

    it('hideCompleted の切替で件数が変化する（右上ボタン統一の真因検証）', () => {
        const showing = computeVisibleGanttItems(rawItems, completedItems, 'all', false);
        const hiding = computeVisibleGanttItems(rawItems, completedItems, 'all', true);
        expect(showing.length).toBeGreaterThan(hiding.length);
        expect(showing.length - hiding.length).toBe(completedItems.length);
    });

    it('filterMode=personal のとき completedItems の tenantId 付きアイテムは除外される', () => {
        const personalRaw: Item[] = [makeItem('p-active', 'inbox', '')];
        const personalCompleted: Item[] = [
            makeItem('p-done', 'done', ''),
            makeItem('c-done', 'done', 't_company1'),
        ];
        const result = computeVisibleGanttItems(personalRaw, personalCompleted, 'personal', false);
        const ids = result.map(i => i.id).sort();
        expect(ids).toEqual(['p-active', 'p-done']);
    });

    it('filterMode=テナントID のとき他テナントの completed は除外される', () => {
        const raw: Item[] = [makeItem('t1-active', 'inbox', 't_target')];
        const completed: Item[] = [
            makeItem('t1-done', 'done', 't_target'),
            makeItem('t2-done', 'done', 't_other'),
        ];
        const result = computeVisibleGanttItems(raw, completed, 't_target' as FilterMode, false);
        const ids = result.map(i => i.id).sort();
        expect(ids).toEqual(['t1-active', 't1-done']);
    });

    it('completedItems が空のときもクラッシュせず items だけ返る', () => {
        const result = computeVisibleGanttItems(rawItems, [], 'all', false);
        expect(result.map(i => i.id).sort()).toEqual(['active-1', 'active-2']);
    });
});
