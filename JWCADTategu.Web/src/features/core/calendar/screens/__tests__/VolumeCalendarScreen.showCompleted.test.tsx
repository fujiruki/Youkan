import { describe, it, expect } from 'vitest';
import { applyGanttCompletedFilter } from '../../../youkan/logic/filterUtils';
import type { Item } from '../../../youkan/types';
import type { FilterMode } from '../../../youkan/types';

/**
 * R-036 真因テスト
 *
 * バックエンド `/calendar/items` は `status NOT IN ('done', ...)` で完了を除外しているため、
 * VolumeCalendarScreen の `items` には done が含まれない。
 * 完了アイテムは別エンドポイント `/calendar/completed` で `completedItems` として取得される。
 *
 * 「完了を表示」スイッチを意味あるものにするには、ON のときに
 * items + completedItems を合成してからガントに渡す必要がある。
 *
 * 本テストは VolumeCalendarScreen 内の visibleItems 計算ロジック相当を抽出して検証する。
 */

const filterByMode = (item: Pick<Item, 'tenantId'>, filterMode: FilterMode): boolean => {
    if (filterMode === 'all') return true;
    if (filterMode === 'personal') return !item.tenantId || item.tenantId === '';
    if (filterMode === 'company') return !!item.tenantId;
    return item.tenantId === filterMode;
};

/**
 * VolumeCalendarScreen の visibleItems を再現するピュア関数。
 * 実画面の useMemo 内のロジックと一致させる責務がある。
 */
const computeVisibleGanttItems = (
    rawItems: Item[],
    completedItems: Item[],
    filterMode: FilterMode,
    showCompleted: boolean
): Item[] => {
    const filteredItems = (rawItems || []).filter(i => filterByMode(i, filterMode));
    const filteredCompleted = (completedItems || []).filter(i => filterByMode(i, filterMode));
    const merged = showCompleted ? [...filteredItems, ...filteredCompleted] : filteredItems;
    return applyGanttCompletedFilter(merged, showCompleted);
};

describe('R-036: VolumeCalendarScreen で「完了を表示」ON/OFF 切替', () => {
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

    it('スイッチ ON のとき items + completedItems が全件返る（filterMode=all）', () => {
        const result = computeVisibleGanttItems(rawItems, completedItems, 'all', true);
        const ids = result.map(i => i.id).sort();
        expect(ids).toEqual(['active-1', 'active-2', 'done-1', 'done-2']);
    });

    it('スイッチ OFF のとき completedItems は含まれず、items のみが返る', () => {
        const result = computeVisibleGanttItems(rawItems, completedItems, 'all', false);
        const ids = result.map(i => i.id).sort();
        expect(ids).toEqual(['active-1', 'active-2']);
        expect(result.every(i => i.status !== 'done')).toBe(true);
    });

    it('スイッチ ON/OFF で見える件数が変化する（真因検証）', () => {
        const on = computeVisibleGanttItems(rawItems, completedItems, 'all', true);
        const off = computeVisibleGanttItems(rawItems, completedItems, 'all', false);
        expect(on.length).toBeGreaterThan(off.length);
        expect(on.length - off.length).toBe(completedItems.length);
    });

    it('filterMode=personal のとき completedItems の tenantId 付きアイテムは除外される', () => {
        const personalRaw: Item[] = [makeItem('p-active', 'inbox', '')];
        const personalCompleted: Item[] = [
            makeItem('p-done', 'done', ''),
            makeItem('c-done', 'done', 't_company1'),
        ];
        const result = computeVisibleGanttItems(personalRaw, personalCompleted, 'personal', true);
        const ids = result.map(i => i.id).sort();
        expect(ids).toEqual(['p-active', 'p-done']);
    });

    it('filterMode=テナントID のとき他テナントの completed は除外される', () => {
        const raw: Item[] = [makeItem('t1-active', 'inbox', 't_target')];
        const completed: Item[] = [
            makeItem('t1-done', 'done', 't_target'),
            makeItem('t2-done', 'done', 't_other'),
        ];
        const result = computeVisibleGanttItems(raw, completed, 't_target' as FilterMode, true);
        const ids = result.map(i => i.id).sort();
        expect(ids).toEqual(['t1-active', 't1-done']);
    });

    it('completedItems が空のときもクラッシュせず items だけ返る', () => {
        const result = computeVisibleGanttItems(rawItems, [], 'all', true);
        expect(result.map(i => i.id).sort()).toEqual(['active-1', 'active-2']);
    });
});
