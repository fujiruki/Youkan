import { describe, it, expect } from 'vitest';
import { Item, JudgmentStatus } from '../types';
import { isTodayCandidate, isOverdue } from './statusUtils';

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
