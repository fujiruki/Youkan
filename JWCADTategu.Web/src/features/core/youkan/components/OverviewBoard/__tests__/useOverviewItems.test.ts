import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { addDays, format } from 'date-fns';
import { useOverviewItems, OverviewItemWrapper } from '../useOverviewItems';
import { Item, Project, Dependency } from '../../../types';
import { DependencyRepository } from '../../../repositories/DependencyRepository';
import { resolveGroupId } from '../../../logic/hierarchy';

// Mock Data (Projects as Items)
const mockProjects: any[] = [
    { id: 'p1', title: 'Company Project A', tenantId: 't1', isProject: true },
    { id: 'p2', title: 'Personal Project B', tenantId: undefined, isProject: true },
];

const mockItems: Item[] = [
    { id: '1', title: 'Inbox Item 1', status: 'inbox', projectId: null, createdAt: 1000, updatedAt: 1000, statusUpdatedAt: 1000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 },
    { id: '2', title: 'Proj A Item', status: 'pending', projectId: 'p1', createdAt: 2000, updatedAt: 2000, statusUpdatedAt: 2000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 },
    { id: '3', title: 'Proj B Item', status: 'focus', projectId: 'p2', createdAt: 3000, updatedAt: 3000, statusUpdatedAt: 3000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 },
    { id: '4', title: 'Inbox Item 2', status: 'inbox', projectId: null, createdAt: 4000, updatedAt: 4000, statusUpdatedAt: 4000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 },
];

// Mock ViewModel
const mockViewModel = {
    gdbActive: [mockItems[0], mockItems[3]], // Inbox items
    gdbPreparation: [mockItems[1]], // Pending/Prep items
    gdbIntent: [mockItems[2]], // Focus/Intent items
    gdbLog: [{ id: '99', title: 'Done Item', status: 'done', projectId: 'p1', isProject: false } as any],
    allProjects: mockProjects,
    joinedTenants: [{ id: 't1', name: 'Company T', role: 'admin' }]
};

describe('useOverviewItems', () => {
    it('should sort items correctly: No Project -> Company Project -> Personal Project', () => {
        const { result } = renderHook(() => useOverviewItems(mockViewModel as any));

        const items: OverviewItemWrapper[] = result.current;

        // Expectation:
        // 1. Inbox Item 1 (No Project)
        // 2. Inbox Item 2 (No Project)
        // 3. Header: Company Project A
        // 4. Proj A Item
        // 5. Header: Personal Project B
        // 6. Proj B Item

        // Verify "No Project" items come first
        const firstTwo = items.slice(0, 2);
        expect(firstTwo.every(i => i.type !== 'header' && !i.item.projectId)).toBe(true);

        // Verify Company Project comes next
        const compHeaderIndex = items.findIndex(i => i.type === 'header' && i.project?.id === 'p1');
        expect(compHeaderIndex).toBeGreaterThan(1); // After inbox items

        // Verify Items are present for Project A
        // noDeadlineCreatedAsc=true のため期限なし群は createdAt 昇順（古い順）
        // item '99' は createdAt 未指定(=0)、item '2' は createdAt=2000 なので '99' が先
        const projAItems = items.filter(i => i.project?.id === 'p1' && i.type !== 'header');
        expect(projAItems.find(i => i.item.id === '99')).toBeDefined();
        expect(projAItems.find(i => i.item.id === '2')).toBeDefined();
        // '99'(createdAt=0) が '2'(createdAt=2000) より前
        expect(items[compHeaderIndex + 1].item.id).toBe('99');

        // Verify Personal Project comes last
        const persHeaderIndex = items.findIndex(i => i.type === 'header' && i.project?.id === 'p2');
        expect(persHeaderIndex).toBeGreaterThan(compHeaderIndex);

        // Verify Item follows header
        expect(items[persHeaderIndex + 1].item.id).toBe('3'); // Proj B Item
    });

    it('should generate virtual headers for projects with items', () => {
        const { result } = renderHook(() => useOverviewItems(mockViewModel as any));
        const headers = result.current.filter(i => i.type === 'header');
        expect(headers.length).toBe(2);
        expect(headers[0].project?.title).toBe('Company Project A');
        expect(headers[1].project?.title).toBe('Personal Project B');
    });

    // R-157: OverviewItemWrapperはHierarchicalWrapperと同じ形（header: projectId, item: project）を持つため、
    // resolveGroupIdをそのまま流用してドロップ先groupIdを解決できることを確認する
    it('R-157: resolveGroupIdでitem行/header行のgroupIdを一貫して解決できる', () => {
        const { result } = renderHook(() => useOverviewItems(mockViewModel as any));
        const items: OverviewItemWrapper[] = result.current;

        const projAItem = items.find(w => w.type === 'item' && w.item.id === '2')!;
        expect(resolveGroupId(projAItem as any)).toBe('header-p1');

        const projAHeader = items.find(w => w.type === 'header' && w.project?.id === 'p1')!;
        expect(resolveGroupId(projAHeader as any)).toBe('header-p1');

        const noProjectItem = items.find(w => w.type === 'item' && w.item.id === '1')!;
        expect(resolveGroupId(noProjectItem as any)).toBeNull();
    });

    it('focus items in gdbActive are included once even if they also appear in Today lists', () => {
        const focusItem = {
            id: 'focus-1',
            title: 'C サウナ',
            status: 'focus',
            projectId: 'p1',
            createdAt: 5000,
            updatedAt: 5000,
            statusUpdatedAt: 5000,
            focusOrder: 0,
            isEngaged: false,
            interrupt: false,
            weight: 1
        } as Item;
        const viewModel = {
            ...mockViewModel,
            gdbActive: [focusItem],
            gdbPreparation: [],
            gdbIntent: [],
            gdbLog: [],
            todayCandidates: [focusItem],
            todayCommits: [],
            executionItem: null
        };

        const { result } = renderHook(() => useOverviewItems(viewModel as any));
        const matches = result.current.filter(w => w.type === 'item' && w.item.id === 'focus-1');
        expect(matches).toHaveLength(1);
    });

    // R-091: 全体一覧でも依存関係のあるタスクの前後の序列を崩さずに並べる
    it('依存関係のあるタスクは前後の序列を崩さずに並ぶ', async () => {
        const succItem = { id: 'succ', title: 'タスクsucc', status: 'inbox', projectId: null, createdAt: 100, updatedAt: 100, statusUpdatedAt: 100, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 } as Item;
        const predItem = { id: 'pred', title: 'タスクpred', status: 'inbox', projectId: null, createdAt: 200, updatedAt: 200, statusUpdatedAt: 200, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1 } as Item;

        const deps: Dependency[] = [
            { id: 'dep-1', sourceItemId: 'pred', targetItemId: 'succ', createdAt: 0 },
        ];
        const spy = vi.spyOn(DependencyRepository.prototype, 'getDependencies').mockResolvedValue(deps);

        const viewModel = {
            gdbActive: [succItem, predItem], // あえて依存関係と逆順
            gdbPreparation: [],
            gdbIntent: [],
            gdbLog: [],
            allProjects: [],
            todayCandidates: [],
            todayCommits: [],
            executionItem: null
        };

        const { result } = renderHook(() => useOverviewItems(viewModel as any));

        await waitFor(() => {
            const ids = result.current.filter(w => w.type === 'item').map(w => w.item.id);
            expect(ids).toContain('pred');
            expect(ids).toContain('succ');
        });

        const ids = result.current.filter(w => w.type === 'item').map(w => w.item.id);
        expect(ids.indexOf('pred')).toBeLessThan(ids.indexOf('succ'));

        spy.mockRestore();
    });
});

// R-129: 最遅着手日トークン（F-28）の全体一覧フィルタ「着手遅れ」・latestStart付与の検証
describe('useOverviewItems（R-129 着手遅れフィルタ・latestStart付与）', () => {
    const capacityViewModel = {
        gdbActive: [] as Item[],
        gdbPreparation: [],
        gdbIntent: [],
        gdbLog: [],
        allProjects: [],
        todayCandidates: [],
        todayCommits: [],
        executionItem: null,
        capacityConfig: { defaultDailyMinutes: 480, holidays: [], exceptions: {} },
        currentUserId: 'u1',
        joinedTenants: [],
        members: [],
    };

    // 締切は明日（期限超過ではない）だが、目安が莫大なため最遅着手日は必ず過去になる
    const tomorrow = format(addDays(new Date(), 1), 'yyyy-MM-dd');
    // 締切は10年後で、目安がわずかなため最遅着手日は必ず未来になる
    const farFuture = format(addDays(new Date(), 3650), 'yyyy-MM-dd');

    const lateItem: Item = {
        id: 'late', title: '着手遅れタスク', status: 'inbox', projectId: null,
        createdAt: 1000, updatedAt: 1000, statusUpdatedAt: 1000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1,
        due_date: tomorrow, estimatedMinutes: 480 * 1000,
    };
    const onTimeItem: Item = {
        id: 'ontime', title: '余裕タスク', status: 'inbox', projectId: null,
        createdAt: 2000, updatedAt: 2000, statusUpdatedAt: 2000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1,
        due_date: farFuture, estimatedMinutes: 60,
    };
    const noDeadlineItem: Item = {
        id: 'no-deadline', title: '締切なしタスク', status: 'inbox', projectId: null,
        createdAt: 3000, updatedAt: 3000, statusUpdatedAt: 3000, focusOrder: 0, isEngaged: false, interrupt: false, weight: 1,
    };

    it('各アイテムに latestStart 結果を付与する', () => {
        const viewModel = { ...capacityViewModel, gdbActive: [lateItem, onTimeItem, noDeadlineItem] };
        const { result } = renderHook(() => useOverviewItems(viewModel as any));
        const wrappers = result.current.filter(w => w.type === 'item') as Extract<OverviewItemWrapper, { type: 'item' }>[];

        expect(wrappers.find(w => w.item.id === 'late')?.latestStart?.isLate).toBe(true);
        expect(wrappers.find(w => w.item.id === 'ontime')?.latestStart?.isLate).toBe(false);
        expect(wrappers.find(w => w.item.id === 'no-deadline')?.latestStart?.reason).toBe('not-applicable');
    });

    it('lateStartOnly=true のとき isLate な項目のみに絞る', () => {
        const viewModel = { ...capacityViewModel, gdbActive: [lateItem, onTimeItem, noDeadlineItem] };
        const { result } = renderHook(() => useOverviewItems(viewModel as any, null, false, false, false, true));
        const ids = result.current.filter(w => w.type === 'item').map(w => (w as any).item.id);

        expect(ids).toEqual(['late']);
    });

    it('capacityConfig/currentUserIdが無いときはlatestStartを計算しない（クラッシュしない）', () => {
        const viewModel = { gdbActive: [lateItem], gdbPreparation: [], gdbIntent: [], gdbLog: [], allProjects: [], todayCandidates: [], todayCommits: [], executionItem: null };
        const { result } = renderHook(() => useOverviewItems(viewModel as any));
        const wrapper = result.current.find(w => w.type === 'item') as Extract<OverviewItemWrapper, { type: 'item' }>;
        expect(wrapper.latestStart).toBeUndefined();
    });
});
