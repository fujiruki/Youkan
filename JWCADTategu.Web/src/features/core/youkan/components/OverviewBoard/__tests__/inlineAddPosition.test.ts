import { describe, it, expect } from 'vitest';
import { getInlineAddInsertIndex } from '../inlineAddPosition';
import type { OverviewItemWrapper } from '../useOverviewItems';
import type { Item } from '../../../types';

const makeItem = (id: string, overrides: Partial<Item> = {}): Item => ({
    id,
    title: `Item ${id}`,
    status: 'inbox',
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 2,
    parentId: null,
    projectId: null,
    createdAt: 0,
    updatedAt: 0,
    memo: '',
    due_date: '',
    flags: {},
    ...overrides,
});

const makeProject = (id: string): Item => ({
    ...makeItem(id),
    title: `Project ${id}`,
    isProject: true,
    type: 'project',
});

const header = (projectId: string, depth = 0): OverviewItemWrapper => ({
    id: `header-${projectId}`,
    type: 'header',
    projectId,
    projectTitle: `Project ${projectId}`,
    project: makeProject(projectId),
    depth,
});

const itemWrapper = (id: string, projectId: string, depth = 1, overrides: Partial<Item> = {}): OverviewItemWrapper => ({
    id,
    type: 'item',
    item: makeItem(id, { projectId, ...overrides }),
    project: makeProject(projectId),
    depth,
});

describe('getInlineAddInsertIndex', () => {
    it('期限なし2件＋期限あり1件のとき、期限なし2件目の直後を返す', () => {
        const wrappers: OverviewItemWrapper[] = [
            header('proj-1'),
            itemWrapper('item-1', 'proj-1', 1),
            itemWrapper('item-2', 'proj-1', 1),
            itemWrapper('item-3', 'proj-1', 1, { due_date: '2026-01-01' }),
        ];
        const idx = getInlineAddInsertIndex(wrappers, 'proj-1');
        expect(idx).toBe(3); // header(0), item-1(1), item-2(2) → 2件目直後 = index 3
    });

    it('期限なしアイテムが0件のとき、header直後（index 1）を返す', () => {
        const wrappers: OverviewItemWrapper[] = [
            header('proj-1'),
            itemWrapper('item-1', 'proj-1', 1, { due_date: '2026-01-01' }),
        ];
        const idx = getInlineAddInsertIndex(wrappers, 'proj-1');
        expect(idx).toBe(1); // header直後
    });

    it('全アイテムが期限なしのとき、最後のアイテムの直後を返す', () => {
        const wrappers: OverviewItemWrapper[] = [
            header('proj-1'),
            itemWrapper('item-1', 'proj-1', 1),
            itemWrapper('item-2', 'proj-1', 1),
            itemWrapper('item-3', 'proj-1', 1),
        ];
        const idx = getInlineAddInsertIndex(wrappers, 'proj-1');
        expect(idx).toBe(4);
    });

    it('期限なしアイテムに子孫（depth>1）がいる場合、その子孫サブツリーの末尾直後を返す', () => {
        const wrappers: OverviewItemWrapper[] = [
            header('proj-1'),
            itemWrapper('item-1', 'proj-1', 1),
            itemWrapper('child-1', 'proj-1', 2),
            itemWrapper('child-2', 'proj-1', 2),
            itemWrapper('item-2', 'proj-1', 1, { due_date: '2026-01-01' }),
        ];
        const idx = getInlineAddInsertIndex(wrappers, 'proj-1');
        // item-1(depth=1, 期限なし) → child-1, child-2 (depth=2) → サブツリー末尾は index 3
        // 挿入位置は child-2直後 = index 4
        expect(idx).toBe(4);
    });

    it('サブプロジェクトのheaderで停止する（サブプロジェクトはサブツリーに含めない）', () => {
        const wrappers: OverviewItemWrapper[] = [
            header('proj-1'),
            itemWrapper('item-1', 'proj-1', 1),
            header('sub-proj', 1), // depth=1のサブプロジェクトheader
            itemWrapper('sub-item', 'sub-proj', 2),
            itemWrapper('item-2', 'proj-1', 1, { due_date: '2026-01-01' }),
        ];
        const idx = getInlineAddInsertIndex(wrappers, 'proj-1');
        // item-1が期限なしアイテム → サブツリーはdepth>1のitemのみ追う
        // header('sub-proj')はdepth=1のheaderなのでサブツリー停止
        expect(idx).toBe(2); // item-1直後
    });

    it('done アイテムも期限なし群に含まれる（期限なし判定はcalculateStartLimitベース）', () => {
        const wrappers: OverviewItemWrapper[] = [
            header('proj-1'),
            itemWrapper('done-1', 'proj-1', 1, { status: 'done' }),
            itemWrapper('item-1', 'proj-1', 1),
            itemWrapper('item-2', 'proj-1', 1, { due_date: '2026-01-01' }),
        ];
        const idx = getInlineAddInsertIndex(wrappers, 'proj-1');
        expect(idx).toBe(3); // done-1(0), item-1(1) の2件が期限なし → index 3
    });

    it('headerが存在しないプロジェクトIDを渡すと -1 を返す', () => {
        const wrappers: OverviewItemWrapper[] = [
            header('proj-1'),
            itemWrapper('item-1', 'proj-1', 1),
        ];
        const idx = getInlineAddInsertIndex(wrappers, 'proj-999');
        expect(idx).toBe(-1);
    });

    it('depth > 0 のheader（サブプロジェクト）でも同一ロジックが動作する', () => {
        const wrappers: OverviewItemWrapper[] = [
            header('proj-1'),
            header('sub-proj', 1),
            itemWrapper('item-1', 'sub-proj', 2),
            itemWrapper('item-2', 'sub-proj', 2),
            itemWrapper('item-3', 'sub-proj', 2, { due_date: '2026-01-01' }),
        ];
        const idx = getInlineAddInsertIndex(wrappers, 'sub-proj');
        expect(idx).toBe(4); // header(1), item-1(2), item-2(3) の期限なし2件直後
    });
});
