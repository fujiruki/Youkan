import { describe, it, expect } from 'vitest';
import { Item, JudgmentStatus } from '../types';
import { isTodayCandidate, isOverdue, STATUS_META } from './statusUtils';

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
        expect(STATUS_META.someday.color).toBe('purple');
        expect(STATUS_META.someday.label).toContain('いつかやる');
    });

    it('pending と someday は異なる色を持つ', () => {
        expect(STATUS_META.pending.color).not.toBe(STATUS_META.someday.color);
        expect(STATUS_META.someday.color).toBe('purple');
        expect(STATUS_META.pending.color).toBe('amber');
    });

    it('pending と someday のラベルが区別されている', () => {
        expect(STATUS_META.pending.label).not.toBe(STATUS_META.someday.label);
        expect(STATUS_META.pending.label).toContain('外的要因');
        expect(STATUS_META.someday.label).toContain('自分で');
    });

    it('全ステータスが網羅されている', () => {
        const statuses: JudgmentStatus[] = ['inbox', 'focus', 'waiting', 'pending', 'someday', 'done'];
        statuses.forEach(s => {
            expect(STATUS_META[s]).toBeDefined();
        });
    });
});
