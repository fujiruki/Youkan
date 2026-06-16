import { describe, it, expect } from 'vitest';
import { applyGanttCompletedFilter } from '../../logic/filterUtils';

/**
 * R-065 補強テスト: DashboardScreen 側のガント表示
 *
 * showCompletedInGantt ローカル state を廃止し、FilterContext.hideCompleted を使う。
 * hideCompleted=false → 完了表示（showCompleted=true 相当）
 * hideCompleted=true  → 完了非表示（showCompleted=false 相当）
 */

const buildUnifiedAllItems = (params: {
    executionItem?: any;
    todayCommits?: any[];
    todayCandidates?: any[];
    inboxItems?: any[];
    pendingItems?: any[];
    waitingItems?: any[];
    gdbLog?: any[];
}) => {
    const {
        executionItem = null,
        todayCommits = [],
        todayCandidates = [],
        inboxItems = [],
        pendingItems = [],
        waitingItems = [],
        gdbLog = []
    } = params;
    return [
        ...(executionItem ? [executionItem] : []),
        ...todayCommits.filter(i => i.id !== executionItem?.id),
        ...todayCandidates.filter(i => i.id !== executionItem?.id),
        ...inboxItems,
        ...pendingItems,
        ...waitingItems,
        ...gdbLog
    ].filter(item => item != null && item.status !== 'someday');
};

describe('R-065: DashboardScreen のガント完了表示を hideCompleted に統一', () => {
    it('gdbLog に含まれる done アイテムは unifiedAllItems に入る', () => {
        const all = buildUnifiedAllItems({
            inboxItems: [{ id: 'i1', status: 'inbox' }],
            gdbLog: [
                { id: 'd1', status: 'done' },
                { id: 'd2', status: 'done' },
            ]
        });
        expect(all.map(i => i.id).sort()).toEqual(['d1', 'd2', 'i1']);
    });

    it('hideCompleted=false（完了表示）のときガントには done を含む全件が渡る', () => {
        const all = buildUnifiedAllItems({
            inboxItems: [{ id: 'i1', status: 'inbox' }],
            gdbLog: [{ id: 'd1', status: 'done' }]
        });
        const hideCompleted = false;
        const gantt = applyGanttCompletedFilter(all, !hideCompleted);
        expect(gantt.map(i => i.id).sort()).toEqual(['d1', 'i1']);
    });

    it('hideCompleted=true（完了非表示）のとき done は除外される', () => {
        const all = buildUnifiedAllItems({
            inboxItems: [{ id: 'i1', status: 'inbox' }],
            gdbLog: [
                { id: 'd1', status: 'done' },
                { id: 'd2', status: 'done' },
            ]
        });
        const hideCompleted = true;
        const gantt = applyGanttCompletedFilter(all, !hideCompleted);
        expect(gantt.map(i => i.id).sort()).toEqual(['i1']);
    });

    it('hideCompleted の切替で件数が変化する（右上ボタン統一の再発防止）', () => {
        const all = buildUnifiedAllItems({
            inboxItems: [{ id: 'i1', status: 'inbox' }],
            gdbLog: [
                { id: 'd1', status: 'done' },
                { id: 'd2', status: 'done' },
            ]
        });
        const showing = applyGanttCompletedFilter(all, true);
        const hiding = applyGanttCompletedFilter(all, false);
        expect(showing.length - hiding.length).toBe(2);
    });
});
