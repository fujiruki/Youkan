import { describe, it, expect } from 'vitest';
import { Item, JudgmentStatus } from '../../types';
import { QuantityContext } from '../QuantityEngine';
import { getLatestStart, selectLateStartHighlightIds, formatLatestStartToken, resolveSafetyFactor, DEFAULT_SAFETY_FACTOR } from '../latestStart';

const TODAY = '2026-08-18'; // 火曜日

const baseCtx: QuantityContext = {
    items: [],
    members: [],
    capacityConfig: { defaultDailyMinutes: 480, holidays: [], exceptions: {} },
    currentUser: { id: 'u1', isCompanyAccount: false, joinedTenants: [] },
};

const createItem = (status: JudgmentStatus, overrides: Partial<Item> = {}): Item => ({
    id: 'item',
    title: 'item',
    status,
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
});

describe('getLatestStart (R-129 / F-28)', () => {
    it('waiting は対象外（not-applicable）', () => {
        const item = createItem('waiting', { due_date: '2026-08-25', estimatedMinutes: 480 });
        const result = getLatestStart(item, baseCtx, 1.0, TODAY);
        expect(result).toEqual({ date: null, isLate: false, reason: 'not-applicable' });
    });

    it('pending/someday/done/cancelled は対象外（not-applicable）', () => {
        (['pending', 'someday', 'done', 'cancelled'] as JudgmentStatus[]).forEach(status => {
            const item = createItem(status, { due_date: '2026-08-25', estimatedMinutes: 480 });
            const result = getLatestStart(item, baseCtx, 1.0, TODAY);
            expect(result.reason).toBe('not-applicable');
        });
    });

    it('目安時間未入力は no-estimate（着手日は出さない）', () => {
        const item = createItem('inbox', { due_date: '2026-08-25' });
        const result = getLatestStart(item, baseCtx, 1.0, TODAY);
        expect(result).toEqual({ date: null, isLate: false, reason: 'no-estimate' });
    });

    it('有効締切が今日より前（期限超過）は対象外（not-applicable）', () => {
        const item = createItem('inbox', { due_date: '2026-08-10', estimatedMinutes: 480 });
        const result = getLatestStart(item, baseCtx, 1.0, TODAY);
        expect(result.reason).toBe('not-applicable');
        expect(result.date).toBeNull();
    });

    it('有効締切が今日ちょうどは対象（期限超過ではない）', () => {
        const item = createItem('focus', { due_date: TODAY, estimatedMinutes: 480 });
        const result = getLatestStart(item, baseCtx, 1.0, TODAY);
        expect(result.reason).toBe('ok');
    });

    it('通常ケース: 目安480分・係数1.0・日次キャパ480分なら締切当日が最遅着手日', () => {
        const item = createItem('focus', { due_date: '2026-08-25', estimatedMinutes: 480 });
        const result = getLatestStart(item, baseCtx, 1.0, TODAY);
        expect(result).toEqual({ date: '2026-08-25', isLate: false, reason: 'ok' });
    });

    it('安全係数を上げると最遅着手日が前倒しになる', () => {
        const item = createItem('focus', { due_date: '2026-08-25', estimatedMinutes: 480 });
        const factor1 = getLatestStart(item, baseCtx, 1.0, TODAY);
        const factor2 = getLatestStart(item, baseCtx, 2.0, TODAY);
        expect(factor1.date).toBe('2026-08-25');
        expect(factor2.date).toBe('2026-08-24');
        expect(new Date(factor2.date!).getTime()).toBeLessThan(new Date(factor1.date!).getTime());
    });

    it('今日 > 最遅着手日のとき isLate=true（期限は先だが着手が遅れている）', () => {
        // 締切は明日(期限超過ではない)。目安が大きく、日次キャパ480分×10営業日必要（土日は既定で休業扱い）
        // → 最遅着手日は8/6（今日=8/18より前）
        const item = createItem('todo', { due_date: '2026-08-19', estimatedMinutes: 480 * 10 });
        const result = getLatestStart(item, baseCtx, 1.0, TODAY);
        expect(result.reason).toBe('ok');
        expect(result.date).toBe('2026-08-06');
        expect(result.isLate).toBe(true);
    });

    it('有効締切なしは対象外（not-applicable）', () => {
        const item = createItem('inbox', { estimatedMinutes: 480 });
        const result = getLatestStart(item, baseCtx, 1.0, TODAY);
        expect(result.reason).toBe('not-applicable');
    });
});

describe('resolveSafetyFactor', () => {
    it('未設定時は既定1.5を返す', () => {
        expect(resolveSafetyFactor(undefined)).toBe(DEFAULT_SAFETY_FACTOR);
        expect(resolveSafetyFactor({ defaultDailyMinutes: 480, holidays: [], exceptions: {} })).toBe(1.5);
    });

    it('設定済みの値を返す', () => {
        expect(resolveSafetyFactor({ defaultDailyMinutes: 480, holidays: [], exceptions: {}, safetyFactor: 2.0 })).toBe(2.0);
    });
});

describe('selectLateStartHighlightIds（飽和ガード）', () => {
    it('isLateな項目のうち表示順で先頭10件のみを対象にする', () => {
        const ordered = Array.from({ length: 12 }, (_, i) => ({ id: `late-${i}`, isLate: true }));
        const ids = selectLateStartHighlightIds(ordered);
        expect(ids.size).toBe(10);
        expect(ids.has('late-0')).toBe(true);
        expect(ids.has('late-9')).toBe(true);
        expect(ids.has('late-10')).toBe(false);
        expect(ids.has('late-11')).toBe(false);
    });

    it('isLateでない項目は数に含めない', () => {
        const ordered = [
            { id: 'not-late', isLate: false },
            ...Array.from({ length: 10 }, (_, i) => ({ id: `late-${i}`, isLate: true })),
        ];
        const ids = selectLateStartHighlightIds(ordered);
        expect(ids.has('not-late')).toBe(false);
        expect(ids.size).toBe(10);
    });
});

describe('formatLatestStartToken', () => {
    it('not-applicable は非表示（null）', () => {
        expect(formatLatestStartToken({ date: null, isLate: false, reason: 'not-applicable' })).toBeNull();
    });

    it('no-estimate は「目安？」', () => {
        expect(formatLatestStartToken({ date: null, isLate: false, reason: 'no-estimate' })).toBe('目安？');
    });

    it('ok は「着手 M/d」', () => {
        expect(formatLatestStartToken({ date: '2026-08-25', isLate: false, reason: 'ok' })).toBe('着手 8/25');
    });
});
