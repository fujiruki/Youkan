import { describe, it, expect } from 'vitest';
import { Item, JudgmentStatus } from '../types';
import { isTodayCandidate, isOverdue, STATUS_META, COMPLETED_ITEM_CLASS, isItemDone, isReviewDue, getItemStatusColors, getItemStatusBorderLeftClass } from './statusUtils';

// Mock helper
const createItem = (status: JudgmentStatus, overrides: Partial<Item> = {}): Item => ({
    id: 'test',
    title: 'test',
    status,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    flags: {
        has_deadline: false,
        needs_decision: false,
        is_projectized: false,
        is_today_commit: false,
        is_executing: false,
    },
    ...overrides
});

describe('Status Utils (Haruki Model)', () => {

    describe('isTodayCandidate', () => {
        it('should return true if status is focus and is_today_commit flag is true', () => {
            const item = createItem('focus', {
                flags: {
                    has_deadline: false,
                    needs_decision: false,
                    is_projectized: false,
                    is_today_commit: true,
                    is_executing: false
                }
            });
            expect(isTodayCandidate(item)).toBe(true);
        });

        it('should return true if status is focus and prep_date is today or past', () => {
            const today = Math.floor(Date.now() / 1000); // Approximation
            // We need to inject "current time" or pass it. 
            // For now assuming util uses system time, or we mock it.
            // Let's assume util accepts 'todayTimestamp' optional.

            const item = createItem('focus', { prep_date: today - 86400 }); // Yesterday
            expect(isTodayCandidate(item, today)).toBe(true);
        });

        it('should return false if status is waiting even if prep_date is passed (Logic: Waiting is blocking)', () => {
            const today = Math.floor(Date.now() / 1000);
            const item = createItem('waiting', { prep_date: today - 86400 });
            expect(isTodayCandidate(item, today)).toBe(false);
        });

        it('should return false if status is inbox', () => {
            const item = createItem('inbox', { flags: { is_today_commit: true } as any });
            // Technically UI shouldn't allow inbox+commit, but util should guard.
            expect(isTodayCandidate(item)).toBe(false);
        });
    });

    describe('isOverdue', () => {
        it('should return true if done and deadline passed? No, done is never overdue.', () => {
            const todayString = '2026-01-25';
            const item = createItem('done', { due_date: '2026-01-24' });
            expect(isOverdue(item, todayString)).toBe(false);
        });

        it('should return true if focus and deadline passed', () => {
            const todayString = '2026-01-25';
            const item = createItem('focus', { due_date: '2026-01-24' });
            expect(isOverdue(item, todayString)).toBe(true);
        });
    });
});

describe('STATUS_META (R-028)', () => {
    it('someday メタデータが定義されている', () => {
        expect(STATUS_META.someday).toBeDefined();
        expect(STATUS_META.someday.color).toBe('slate');
        expect(STATUS_META.someday.label).toContain('いつかやる');
    });

    it('pending と someday は異なる色を持つ', () => {
        expect(STATUS_META.pending.color).not.toBe(STATUS_META.someday.color);
        expect(STATUS_META.someday.color).toBe('slate');
        expect(STATUS_META.pending.color).toBe('amber');
    });

    it('pending と someday のラベルが区別されている', () => {
        expect(STATUS_META.pending.label).not.toBe(STATUS_META.someday.label);
        expect(STATUS_META.pending.label).toContain('外的要因');
        expect(STATUS_META.someday.label).toContain('自分で');
    });

    it('全ステータスが網羅されている', () => {
        const statuses: JudgmentStatus[] = ['inbox', 'todo', 'focus', 'waiting', 'pending', 'someday', 'done', 'cancelled'];
        statuses.forEach(s => {
            expect(STATUS_META[s]).toBeDefined();
        });
    });
});

describe('getItemStatusColors (R-159)', () => {
    it('inbox は旧 someday の緑、someday は中立的なグレーを返す', () => {
        expect(getItemStatusColors({ status: 'inbox' }, '2026-08-29')).toEqual({
            bg: 'bg-emerald-50', border: 'border-emerald-300', text: 'text-emerald-800',
        });
        expect(getItemStatusColors({ status: 'someday' }, '2026-08-29')).toEqual({
            bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-600',
        });
    });

    it('期限超過は同一要素のステータス色より淡い赤を優先する', () => {
        expect(getItemStatusColors({ status: 'inbox', due_date: '2026-08-28' }, '2026-08-29')).toEqual({
            bg: 'bg-rose-50', border: 'border-rose-300', text: 'text-rose-800',
        });
    });

    it('focus / pending / waiting / done の既存色は変えない', () => {
        expect(getItemStatusColors({ status: 'focus' }, '2026-08-29').bg).toBe('bg-indigo-100');
        expect(getItemStatusColors({ status: 'pending' }, '2026-08-29').bg).toBe('bg-amber-100');
        expect(getItemStatusColors({ status: 'waiting' }, '2026-08-29').bg).toBe('bg-orange-100');
        expect(getItemStatusColors({ status: 'done' }, '2026-08-29').bg).toBe('bg-gray-100');
    });
});

describe('getItemStatusBorderLeftClass (R-159)', () => {
    it('カレンダー行でも inbox / someday / 期限超過の優先順位が一致する', () => {
        expect(getItemStatusBorderLeftClass({ status: 'inbox' }, '2026-08-29')).toBe('border-l-emerald-300');
        expect(getItemStatusBorderLeftClass({ status: 'someday' }, '2026-08-29')).toBe('border-l-slate-300');
        expect(getItemStatusBorderLeftClass({ status: 'inbox', due_date: '2026-08-28' }, '2026-08-29')).toBe('border-l-rose-300');
    });
});

// R-125: 状態todo（後日着手）
describe('STATUS_META.todo (R-125)', () => {
    it('todo メタデータが定義されており、ラベルは「後日着手」', () => {
        expect(STATUS_META.todo).toBeDefined();
        expect(STATUS_META.todo.label).toBe('後日着手');
    });

    it('todo は既存の状態色（inbox/focus/waiting/pending/someday/done/cancelled）と被らない色を持つ', () => {
        const otherColors = [
            STATUS_META.inbox.color,
            STATUS_META.focus.color,
            STATUS_META.waiting.color,
            STATUS_META.pending.color,
            STATUS_META.someday.color,
            STATUS_META.done.color,
            STATUS_META.cancelled.color,
        ];
        expect(otherColors).not.toContain(STATUS_META.todo.color);
    });
});

// R-125: pending の再確認（review_date到来）判定
describe('isReviewDue (R-125)', () => {
    it('status=pending かつ reviewDate が今日以前なら true', () => {
        const item = createItem('pending', { reviewDate: '2026-08-10' } as any);
        expect(isReviewDue(item, '2026-08-18')).toBe(true);
    });

    it('status=pending かつ reviewDate が今日ちょうどなら true', () => {
        const item = createItem('pending', { reviewDate: '2026-08-18' } as any);
        expect(isReviewDue(item, '2026-08-18')).toBe(true);
    });

    it('status=pending かつ reviewDate が未来なら false', () => {
        const item = createItem('pending', { reviewDate: '2026-09-01' } as any);
        expect(isReviewDue(item, '2026-08-18')).toBe(false);
    });

    it('reviewDate が未設定なら false', () => {
        const item = createItem('pending', {} as any);
        expect(isReviewDue(item, '2026-08-18')).toBe(false);
    });

    it('status が pending 以外なら reviewDate が過去でも false', () => {
        const item = createItem('todo', { reviewDate: '2026-08-01' } as any);
        expect(isReviewDue(item, '2026-08-18')).toBe(false);
    });
});

describe('R-035 完了アイテム表示統一', () => {
    it('COMPLETED_ITEM_CLASS は slate-400 + line-through を含む', () => {
        expect(COMPLETED_ITEM_CLASS).toContain('text-slate-400');
        expect(COMPLETED_ITEM_CLASS).toContain('line-through');
    });

    it('isItemDone は status=done で true', () => {
        expect(isItemDone({ status: 'done' })).toBe(true);
    });

    it('isItemDone は status=completed / log（過去互換）でも true', () => {
        expect(isItemDone({ status: 'completed' })).toBe(true);
        expect(isItemDone({ status: 'log' })).toBe(true);
    });

    it('isItemDone は status=focus / inbox / waiting / pending / someday で false', () => {
        expect(isItemDone({ status: 'focus' })).toBe(false);
        expect(isItemDone({ status: 'inbox' })).toBe(false);
        expect(isItemDone({ status: 'waiting' })).toBe(false);
        expect(isItemDone({ status: 'pending' })).toBe(false);
        expect(isItemDone({ status: 'someday' })).toBe(false);
    });

    it('isItemDone は status が空/未定義のとき false', () => {
        expect(isItemDone({ status: '' })).toBe(false);
        expect(isItemDone({})).toBe(false);
    });
});
