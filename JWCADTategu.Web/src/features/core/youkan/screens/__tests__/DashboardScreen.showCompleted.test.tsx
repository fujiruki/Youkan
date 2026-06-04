import { describe, it, expect } from 'vitest';
import { applyGanttCompletedFilter } from '../../logic/filterUtils';

/**
 * R-036 補強テスト: DashboardScreen 側のガント表示
 *
 * DashboardScreen は useYoukanViewModel 経由で gdbLog（status='done'を含む）を取得しており、
 * unifiedAllItems に done が含まれる。よって applyGanttCompletedFilter で OFF にすれば
 * done が除外され、ON では含まれる挙動になる。
 *
 * VolumeCalendarScreen と異なり、追加マージは不要であることを保証する。
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

describe('R-036: DashboardScreen のガント完了表示トグル', () => {
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

    it('showCompleted=true のときガントには done を含む全件が渡る', () => {
        const all = buildUnifiedAllItems({
            inboxItems: [{ id: 'i1', status: 'inbox' }],
            gdbLog: [{ id: 'd1', status: 'done' }]
        });
        const gantt = applyGanttCompletedFilter(all, true);
        expect(gantt.map(i => i.id).sort()).toEqual(['d1', 'i1']);
    });

    it('showCompleted=false のとき done は除外される（仕様 §5.4）', () => {
        const all = buildUnifiedAllItems({
            inboxItems: [{ id: 'i1', status: 'inbox' }],
            gdbLog: [
                { id: 'd1', status: 'done' },
                { id: 'd2', status: 'done' },
            ]
        });
        const gantt = applyGanttCompletedFilter(all, false);
        expect(gantt.map(i => i.id).sort()).toEqual(['i1']);
    });

    it('ON/OFF で件数が変化する（真因再発防止）', () => {
        const all = buildUnifiedAllItems({
            inboxItems: [{ id: 'i1', status: 'inbox' }],
            gdbLog: [
                { id: 'd1', status: 'done' },
                { id: 'd2', status: 'done' },
            ]
        });
        const on = applyGanttCompletedFilter(all, true);
        const off = applyGanttCompletedFilter(all, false);
        expect(on.length - off.length).toBe(2);
    });
});
