import { describe, it, expect } from 'vitest';
import { Item, JudgmentStatus } from '../../types';
import { buildReviewQueue, countDeclinedThisWeek } from '../reviewQueue';

// テスト基準日（月曜）: 2026-08-17
const TODAY = '2026-08-18'; // 火曜日

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

describe('buildReviewQueue (R-127 / F-26)', () => {
    it('有効締切（due_date）が今日より前のアイテムを対象にする', () => {
        const item = createItem('inbox', { id: 'overdue-due', due_date: '2026-08-10' });
        const result = buildReviewQueue([item], TODAY);
        expect(result.map(i => i.id)).toContain('overdue-due');
    });

    it('有効締切（prep_date）が今日より前のアイテムを対象にする', () => {
        const pastPrep = Math.floor(new Date('2026-08-10').getTime() / 1000);
        const item = createItem('todo', { id: 'overdue-prep', prep_date: pastPrep });
        const result = buildReviewQueue([item], TODAY);
        expect(result.map(i => i.id)).toContain('overdue-prep');
    });

    it('status=pending かつ review_date が今日以前のアイテムを対象にする（締切超過でなくても）', () => {
        const item = createItem('pending', { id: 'review-due', reviewDate: '2026-08-18' });
        const result = buildReviewQueue([item], TODAY);
        expect(result.map(i => i.id)).toContain('review-due');
    });

    it('締切が今日または未来のアイテムは対象外', () => {
        const item = createItem('inbox', { id: 'not-yet', due_date: '2026-08-18' });
        const result = buildReviewQueue([item], TODAY);
        expect(result.map(i => i.id)).not.toContain('not-yet');
    });

    it('締切未設定・再確認未到来のアイテムは対象外', () => {
        const item = createItem('inbox', { id: 'no-deadline' });
        const result = buildReviewQueue([item], TODAY);
        expect(result.map(i => i.id)).not.toContain('no-deadline');
    });

    it('status が done/cancelled/someday のアイテムは締切超過でも対象外', () => {
        const items = [
            createItem('done', { id: 'done-item', due_date: '2026-08-01' }),
            createItem('cancelled', { id: 'cancelled-item', due_date: '2026-08-01' }),
            createItem('someday', { id: 'someday-item', due_date: '2026-08-01' }),
        ];
        const result = buildReviewQueue(items, TODAY);
        expect(result.map(i => i.id)).toEqual([]);
    });

    it('プロジェクト（isProject=true）は締切超過でも対象外', () => {
        const item = createItem('inbox', { id: 'project-item', due_date: '2026-08-01', isProject: true });
        const result = buildReviewQueue([item], TODAY);
        expect(result.map(i => i.id)).not.toContain('project-item');
    });

    it('削除済み（deletedAt）・アーカイブ済み（isArchived）は対象外', () => {
        const items = [
            createItem('inbox', { id: 'deleted', due_date: '2026-08-01', deletedAt: Date.now() }),
            createItem('inbox', { id: 'archived', due_date: '2026-08-01', isArchived: true }),
        ];
        const result = buildReviewQueue(items, TODAY);
        expect(result.map(i => i.id)).toEqual([]);
    });

    it('並び: ①再確認到来を最優先（締切超過より先）', () => {
        const overdue = createItem('inbox', { id: 'overdue', due_date: '2026-08-01', estimatedMinutes: 5 });
        const reviewDue = createItem('pending', { id: 'review-due', reviewDate: '2026-08-18', estimatedMinutes: 999 });
        const result = buildReviewQueue([overdue, reviewDue], TODAY);
        expect(result.map(i => i.id)).toEqual(['review-due', 'overdue']);
    });

    it('並び: ②同じ優先度内は目安時間の短い順、未入力は最後', () => {
        const noEstimate = createItem('inbox', { id: 'no-estimate', due_date: '2026-08-01' });
        const short = createItem('inbox', { id: 'short', due_date: '2026-08-01', estimatedMinutes: 15 });
        const long = createItem('inbox', { id: 'long', due_date: '2026-08-01', estimatedMinutes: 120 });
        const result = buildReviewQueue([long, noEstimate, short], TODAY);
        expect(result.map(i => i.id)).toEqual(['short', 'long', 'no-estimate']);
    });

    it('並び: ③目安時間が同じ場合は有効締切の古い順', () => {
        const older = createItem('inbox', { id: 'older', due_date: '2026-08-01', estimatedMinutes: 30 });
        const newer = createItem('inbox', { id: 'newer', due_date: '2026-08-10', estimatedMinutes: 30 });
        const result = buildReviewQueue([newer, older], TODAY);
        expect(result.map(i => i.id)).toEqual(['older', 'newer']);
    });

    it('古いアイテムを自動的に除外・処分しない（そのまま対象に含める）', () => {
        const veryOld = createItem('inbox', { id: 'very-old', due_date: '2020-01-01' });
        const result = buildReviewQueue([veryOld], TODAY);
        expect(result.map(i => i.id)).toContain('very-old');
    });
});

describe('countDeclinedThisWeek (R-127)', () => {
    it('今週（月曜0:00以降）に断ったアイテムをカウントする', () => {
        // 2026-08-17（月）0:00以降
        const mondayThisWeek = Math.floor(new Date('2026-08-17T09:00:00').getTime() / 1000);
        const item = createItem('cancelled', { id: 'declined-this-week', statusUpdatedAt: mondayThisWeek });
        expect(countDeclinedThisWeek([item], TODAY)).toBe(1);
    });

    it('先週分は今週のカウントに含めない', () => {
        const lastWeek = Math.floor(new Date('2026-08-10T09:00:00').getTime() / 1000);
        const item = createItem('cancelled', { id: 'declined-last-week', statusUpdatedAt: lastWeek });
        expect(countDeclinedThisWeek([item], TODAY)).toBe(0);
    });

    it('cancelled 以外のstatusはカウントしない', () => {
        const mondayThisWeek = Math.floor(new Date('2026-08-17T09:00:00').getTime() / 1000);
        const item = createItem('done', { id: 'done-not-declined', statusUpdatedAt: mondayThisWeek });
        expect(countDeclinedThisWeek([item], TODAY)).toBe(0);
    });

    it('複数件を正しく合算する', () => {
        const mondayThisWeek = Math.floor(new Date('2026-08-17T09:00:00').getTime() / 1000);
        const items = [
            createItem('cancelled', { id: 'a', statusUpdatedAt: mondayThisWeek }),
            createItem('cancelled', { id: 'b', statusUpdatedAt: mondayThisWeek }),
        ];
        expect(countDeclinedThisWeek(items, TODAY)).toBe(2);
    });
});
