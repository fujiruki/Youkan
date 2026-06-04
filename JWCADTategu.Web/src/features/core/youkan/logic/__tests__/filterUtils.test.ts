import { describe, it, expect } from 'vitest';
import { isTenantFilter, isCompanyContext, getSelectedTenantId, applyGanttCompletedFilter } from '../filterUtils';

describe('isTenantFilter', () => {
    it('"all" は false を返す', () => {
        expect(isTenantFilter('all')).toBe(false);
    });

    it('"personal" は false を返す', () => {
        expect(isTenantFilter('personal')).toBe(false);
    });

    it('"company" は false を返す', () => {
        expect(isTenantFilter('company')).toBe(false);
    });

    it('テナントID文字列（"t_697a247b03bfc"）は true を返す', () => {
        expect(isTenantFilter('t_697a247b03bfc')).toBe(true);
    });
});

describe('isCompanyContext', () => {
    it('"all" は false を返す', () => {
        expect(isCompanyContext('all')).toBe(false);
    });

    it('"personal" は false を返す', () => {
        expect(isCompanyContext('personal')).toBe(false);
    });

    it('"company" は true を返す', () => {
        expect(isCompanyContext('company')).toBe(true);
    });

    it('テナントID文字列は true を返す', () => {
        expect(isCompanyContext('t_xxxx')).toBe(true);
    });
});

describe('getSelectedTenantId', () => {
    it('"all" は null を返す', () => {
        expect(getSelectedTenantId('all')).toBeNull();
    });

    it('"personal" は null を返す', () => {
        expect(getSelectedTenantId('personal')).toBeNull();
    });

    it('"company" は null を返す', () => {
        expect(getSelectedTenantId('company')).toBeNull();
    });

    it('テナントID文字列はその文字列自身を返す', () => {
        expect(getSelectedTenantId('t_xxxx')).toBe('t_xxxx');
    });
});

describe('applyGanttCompletedFilter (R-036)', () => {
    const items = [
        { id: '1', status: 'inbox' },
        { id: '2', status: 'focus' },
        { id: '3', status: 'done' },
        { id: '4', status: 'waiting' },
        { id: '5', status: 'done' },
    ];

    it('showCompleted=true のときは done を除外しない（全件返す）', () => {
        const result = applyGanttCompletedFilter(items, true);
        expect(result).toHaveLength(5);
        expect(result.map(i => i.id)).toEqual(['1', '2', '3', '4', '5']);
    });

    it('showCompleted=false のときは status=done を除外する', () => {
        const result = applyGanttCompletedFilter(items, false);
        expect(result).toHaveLength(3);
        expect(result.map(i => i.id)).toEqual(['1', '2', '4']);
        expect(result.every(i => i.status !== 'done')).toBe(true);
    });

    it('入力が空配列でも安全に動く', () => {
        expect(applyGanttCompletedFilter([], true)).toEqual([]);
        expect(applyGanttCompletedFilter([], false)).toEqual([]);
    });

    it('status 未設定アイテムは showCompleted の値に関わらず保持される', () => {
        const mixed = [{ id: 'x' } as { id: string; status?: string }];
        expect(applyGanttCompletedFilter(mixed, true)).toEqual(mixed);
        expect(applyGanttCompletedFilter(mixed, false)).toEqual(mixed);
    });

    /**
     * R-036 真因対応: バックエンドが /calendar/items から done を除外して返すため、
     * items には完了アイテムが含まれていない。「完了を表示=ON」を実現するには
     * 呼び出し側で completedItems を合成してから本フィルタに渡す必要がある。
     * このテストはその合成 + フィルタの組み合わせが期待通り動くことを保証する。
     */
    it('items に completedItems をマージしてから filter すると、ON=合算 / OFF=items のみ になる', () => {
        const items = [
            { id: 'a', status: 'inbox' },
            { id: 'b', status: 'focus' },
        ];
        const completedItems = [
            { id: 'c', status: 'done' },
            { id: 'd', status: 'done' },
        ];

        const onMerged = applyGanttCompletedFilter([...items, ...completedItems], true);
        expect(onMerged.map(i => i.id).sort()).toEqual(['a', 'b', 'c', 'd']);

        const offMerged = applyGanttCompletedFilter([...items, ...completedItems], false);
        expect(offMerged.map(i => i.id).sort()).toEqual(['a', 'b']);
    });
});
