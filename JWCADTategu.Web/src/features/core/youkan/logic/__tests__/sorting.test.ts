import { describe, it, expect } from 'vitest';
import { compareFocusItems, compareInboxItems, calculateStartLimit, compareGeneralList2Items, getProjectUrgencyScore, compareGanttListItems } from '../sorting';
import { Item } from '../../types';

// Helper to create mock items
const mockItem = (overrides: Partial<Item>): Item => ({
    id: 'test',
    title: 'Test',
    status: 'inbox',
    createdAt: 0,
    updatedAt: 0,
    statusUpdatedAt: 0, // [Fix] Missing property
    focusOrder: 0,
    weight: 1,
    isEngaged: false,
    interrupt: false,
    doorId: '',
    category: 'door',
    type: 'start',
    memo: '',
    ...overrides
});

describe('Sorting Logic', () => {
    describe('compareFocusItems (Focus & General List)', () => {
        // Rules:
        // 1. No Deadline (Top) > Has Deadline (Bottom)
        // 2. No Deadline: Short Estimate First
        // 3. Has Deadline: Earliest First

        it('sorts No Deadline before Has Deadline', () => {
            const noDead = mockItem({ title: 'No Dead' });
            const hasDead = mockItem({ title: 'Has Dead', due_date: '2026-01-01' });
            expect(compareFocusItems(noDead, hasDead)).toBeLessThan(0);
            expect(compareFocusItems(hasDead, noDead)).toBeGreaterThan(0);
        });

        it('sorts No Deadline by Estimated Time (Shorter First)', () => {
            const short = mockItem({ title: '5min', estimatedMinutes: 5 });
            const long = mockItem({ title: '60min', estimatedMinutes: 60 });
            const none = mockItem({ title: '0min', estimatedMinutes: 0 }); // 0 considered shortest

            expect(compareFocusItems(short, long)).toBeLessThan(0);
            expect(compareFocusItems(long, short)).toBeGreaterThan(0);
            expect(compareFocusItems(none, short)).toBeLessThan(0); // 0 < 5
        });

        it('sorts Has Deadline by Earliest Effective Date', () => {
            const earlyDesc = mockItem({ title: 'Early', due_date: '2026-01-01' });
            const lateDesc = mockItem({ title: 'Late', due_date: '2026-01-10' });
            const prepEarly = mockItem({ title: 'Prep Early', prep_date: 1767225600 }); // 2026-01-01 (approx)
            const prepLate = mockItem({ title: 'Prep Late', prep_date: 1768003200 }); // 2026-01-10

            expect(compareFocusItems(earlyDesc, lateDesc)).toBeLessThan(0);
            expect(compareFocusItems(prepEarly, prepLate)).toBeLessThan(0);

            // Mixed: Due vs Prep
            const dueIsEarlier = mockItem({ due_date: '2026-01-01', prep_date: 1768003200 }); // Due(1st) < Prep(10th) => 1st
            const prepIsEarlier = mockItem({ due_date: '2026-01-10', prep_date: 1767225600 }); // Prep(1st) < Due(10th) => 1st

            // Compare combined effective dates
            // diff is roughly (1st - 10th) < 0
            expect(compareFocusItems(dueIsEarlier, prepIsEarlier)).toBe(0); // Both effective are ~Jan 1st (same timestamp logic assumed)
            // Wait, timestamps need to be exact for 0.
            // Let's test ordering
            const veryEarly = mockItem({ due_date: '2025-12-31' });
            expect(compareFocusItems(veryEarly, dueIsEarlier)).toBeLessThan(0);
        });

        it('uses Min(Due, Prep) for effective deadline', () => {
            // Item A: Due=10th, Prep=1st (Effective=1st)
            // Item B: Due=5th, Prep=None (Effective=5th)
            // A should be before B
            const itemA = mockItem({ due_date: '2026-01-10', prep_date: 1767225600 }); // 2026-01-01
            const itemB = mockItem({ due_date: '2026-01-05' });

            const itemADate = new Date(1767225600 * 1000).toISOString(); // Check validity if needed

            // We need to ensure logic uses Prep.
            // compareFocusItems(itemA, itemB) -> itemA.effective(1st) - itemB.effective(5th) < 0
            expect(compareFocusItems(itemA, itemB)).toBeLessThan(0);
        });
    });

    describe('compareInboxItems (Inbox)', () => {
        // Rules:
        // 1. No Deadline (Top) > Has Deadline (Bottom)
        // 2. Created Date Ascending (Oldest First)

        it('sorts No Deadline before Has Deadline', () => {
            const noDead = mockItem({ title: 'No Dead' });
            const hasDead = mockItem({ title: 'Has Dead', due_date: '2026-01-01' });
            expect(compareInboxItems(noDead, hasDead)).toBeLessThan(0);
        });

        it('sorts by Created Date Ascending (Old -> New)', () => {
            const oldItem = mockItem({ title: 'Old', createdAt: 1000 });
            const newItem = mockItem({ title: 'New', createdAt: 2000 });

            expect(compareInboxItems(oldItem, newItem)).toBeLessThan(0);
            expect(compareInboxItems(newItem, oldItem)).toBeGreaterThan(0);
        });

        it('respects Grouping then Sorting', () => {
            // A: No Dead, New (Group 1, 2nd)
            // B: No Dead, Old (Group 1, 1st)
            // C: Has Dead, Old (Group 2, 1st)
            const itemA = mockItem({ title: 'A', createdAt: 2000 });
            const itemB = mockItem({ title: 'B', createdAt: 1000 });
            const itemC = mockItem({ title: 'C', createdAt: 1000, due_date: '2026-01-01' });

            expect(compareInboxItems(itemA, itemB)).toBeGreaterThan(0); // B before A
            expect(compareInboxItems(itemB, itemC)).toBeLessThan(0);    // B before C (Group 1 vs 2)
            expect(compareInboxItems(itemA, itemC)).toBeLessThan(0);    // A before C (Group 1 vs 2)
        });
    });

    describe('General List 2 (Newspaper View)', () => {
        // Rules:
        // Item Sorting:
        // 1. No Deadline (Top) -> Newest Created First
        // 2. Deadline -> Earliest Start Limit (Start = Deadline - Est)
        // 3. Deadline Tie -> Oldest Created First

        it('calculates Start Limit correctly', () => {
            // Deadline: 2026-01-01 00:00 (TS: X)
            // Est: 60 mins (3600000 ms)
            // Start: X - 3600000
            const deadlineIso = '2026-01-01';
            const deadlineTime = new Date(deadlineIso).getTime(); // Local start of day due to parsing fallback?
            // Wait, in sorting.ts normalization handles startOfDay(parseISO(...))
            // Let's trust sorting.ts logic.

            const item = mockItem({ due_date: deadlineIso, estimatedMinutes: 60 });
            const limit = calculateStartLimit(item);

            expect(limit).not.toBeNull();
            // We can't predict exact timestamp easily without timezone knowledge in test env,
            // but we can check relative values.

            const itemNoEst = mockItem({ due_date: deadlineIso, estimatedMinutes: 0 });
            const limitNoEst = calculateStartLimit(itemNoEst);

            expect(limit).toBeLessThan(limitNoEst!); // With estimate should be earlier
        });

        it('sorts No Deadline Items by Newest Created First', () => {
            const oldItem = mockItem({ title: 'Old', createdAt: 1000 });
            const newItem = mockItem({ title: 'New', createdAt: 2000 });

            expect(compareGeneralList2Items(oldItem, newItem)).toBeGreaterThan(0); // New(2000) before Old(1000) => New - Old > 0?
            // Wait: (b.createdAt) - (a.createdAt) for Descending
            // (2000) - (1000) = 1000 > 0. Positive result means b comes first?
            // sort(a, b): result > 0 => b comes first.
            // sort(a, b): result < 0 => a comes first.
            // If result is positive, it sorts [b, a]. Yes.
            // So expected result is positive (swap) if passed (old, new).
            // Actually, expect(compare(old, new)).toBeGreaterThan(0) means old comes after new. Check.
        });

        it('sorts Deadline Items by Start Limit', () => {
            // A: Due 10th, Est 5 days. Start = 5th.
            // B: Due 8th, Est 0 days. Start = 8th.
            // A should be earlier (Top).

            // Note: estimatedMinutes is minutes. 5 days = 5*24*60 = 7200 min? Or 8h/day?
            // Logic uses estimatedMinutes directly.
            // Let's use minutes.
            const minPerDay = 24 * 60; // Simple day

            const itemA = mockItem({ due_date: '2026-01-10', estimatedMinutes: 5 * minPerDay }); // Start ~ 5th
            const itemB = mockItem({ due_date: '2026-01-08', estimatedMinutes: 0 }); // Start ~ 8th

            expect(compareGeneralList2Items(itemA, itemB)).toBeLessThan(0); // A before B
        });

        it('sorts No Deadline before Has Deadline', () => {
            const noDead = mockItem({ title: 'No Dead' });
            const hasDead = mockItem({ title: 'Has Dead', due_date: '2026-01-01' });
            expect(compareGeneralList2Items(noDead, hasDead)).toBeLessThan(0);
        });
    });

    describe('compareGanttListItems（ガント一覧モード用ソート）', () => {
        it('納期もマイ期限もないアイテムが先頭に来る', () => {
            const noDead = mockItem({ title: '期限なし' });
            const hasDue = mockItem({ title: '納期あり', due_date: '2026-01-10' });
            const hasPrep = mockItem({ title: 'マイ期限あり', prep_date: 1767225600 });

            expect(compareGanttListItems(noDead, hasDue)).toBeLessThan(0);
            expect(compareGanttListItems(noDead, hasPrep)).toBeLessThan(0);
            expect(compareGanttListItems(hasDue, noDead)).toBeGreaterThan(0);
        });

        it('期限ありアイテムは納期・マイ期限のうち早い方の昇順', () => {
            const earlyDue = mockItem({ title: '早い納期', due_date: '2026-01-05' });
            const lateDue = mockItem({ title: '遅い納期', due_date: '2026-01-15' });
            expect(compareGanttListItems(earlyDue, lateDue)).toBeLessThan(0);
        });

        it('両方設定されている場合は早い方の日付で比較する', () => {
            // マイ期限が1/3、納期が1/10 → 有効日付は1/3
            const itemA = mockItem({ title: 'A', due_date: '2026-01-10', prep_date: Math.floor(new Date('2026-01-03').getTime() / 1000) });
            // 納期のみ1/5
            const itemB = mockItem({ title: 'B', due_date: '2026-01-05' });
            // AのEffective=1/3、BのEffective=1/5 → Aが先
            expect(compareGanttListItems(itemA, itemB)).toBeLessThan(0);
        });

        it('着手限界日ではなく純粋な日付で比較する（見積もり時間を引かない）', () => {
            // 同じ納期でも見積もり時間が違うアイテムは同順になる
            const shortEst = mockItem({ title: '短い見積もり', due_date: '2026-01-10', estimatedMinutes: 60 });
            const longEst = mockItem({ title: '長い見積もり', due_date: '2026-01-10', estimatedMinutes: 4800 });
            expect(compareGanttListItems(shortEst, longEst)).toBe(0);
        });

        it('期限なし同士はcreatedAt降順（新しいものが先）', () => {
            const oldItem = mockItem({ title: '古い', createdAt: 1000 });
            const newItem = mockItem({ title: '新しい', createdAt: 2000 });
            expect(compareGanttListItems(oldItem, newItem)).toBeGreaterThan(0);
        });
    });

    describe('getProjectUrgencyScore', () => {
        it('sorts Project Urgency Score correctly', () => {
            // Project A: Has item starting 1st.
            // Project B: Has item starting 5th.
            // Project C: No deadlines.

            const item1st = mockItem({ due_date: '2026-01-01' });
            const item5th = mockItem({ due_date: '2026-01-05' });
            const itemNoDead = mockItem({});

            const scoreA = getProjectUrgencyScore([itemNoDead, item1st]); // Should be 1st
            const scoreB = getProjectUrgencyScore([item5th]);           // Should be 5th
            const scoreC = getProjectUrgencyScore([itemNoDead]);        // Infinity

            expect(scoreA).toBeLessThan(scoreB);
            expect(scoreB).toBeLessThan(scoreC);
        });
    });
});
