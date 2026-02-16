import { describe, it, expect } from 'vitest';
import { compareFocusItems, compareInboxItems } from '../sorting';
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
});
