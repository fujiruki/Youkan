import { describe, it, expect } from 'vitest';
import { Item, JudgmentStatus } from '../../types';
import { buildOverdueGroups } from '../overdueGroups';

// テスト基準日: 2026-08-18（火）
const TODAY = '2026-08-18';

const createItem = (id: string, status: JudgmentStatus, overrides: Partial<Item> = {}): Item => ({
    id,
    title: `タスク${id}`,
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

describe('buildOverdueGroups (R-136 / F-55)', () => {
    it('有効締切が今日より前の未完了アイテムだけを対象にする（R-128 weekLoadの超過判定と同一条件）', () => {
        const items = [
            createItem('a', 'todo', { due_date: '2026-08-17', estimatedMinutes: 60 }), // 前日=超過
            createItem('b', 'todo', { due_date: '2026-08-18', estimatedMinutes: 60 }), // 今日=超過ではない
            createItem('c', 'todo', { due_date: '2026-08-22', estimatedMinutes: 60 }), // 今週内だが未来=対象外
        ];
        const groups = buildOverdueGroups(items, TODAY);
        const ids = groups.flatMap(g => g.items.map(i => i.id));
        expect(ids).toEqual(['a']);
    });

    it('status が done/cancelled/someday のアイテムは対象外', () => {
        const items = [
            createItem('done', 'done', { due_date: '2026-08-10', estimatedMinutes: 60 }),
            createItem('cancelled', 'cancelled', { due_date: '2026-08-10', estimatedMinutes: 60 }),
            createItem('someday', 'someday', { due_date: '2026-08-10', estimatedMinutes: 60 }),
        ];
        expect(buildOverdueGroups(items, TODAY)).toEqual([]);
    });

    it('削除済み・アーカイブ済み・プロジェクトは対象外', () => {
        const items = [
            createItem('del', 'todo', { due_date: '2026-08-10', estimatedMinutes: 60, deletedAt: Date.now() }),
            createItem('arc', 'todo', { due_date: '2026-08-10', estimatedMinutes: 60, isArchived: true }),
            createItem('proj', 'todo', { due_date: '2026-08-10', estimatedMinutes: 60, isProject: true }),
        ];
        expect(buildOverdueGroups(items, TODAY)).toEqual([]);
    });

    it('prep_date のみでも有効締切として超過判定する', () => {
        // prep_date は Unixタイムスタンプ（秒）。2026-08-10 相当
        const items = [
            createItem('a', 'todo', { prep_date: Math.floor(new Date('2026-08-10').getTime() / 1000), estimatedMinutes: 60 }),
        ];
        const groups = buildOverdueGroups(items, TODAY);
        expect(groups[0].items[0].id).toBe('a');
    });

    it('案件（projectId）ごとにグループ化し、得意先名があれば「得意先／案件名」にする', () => {
        const items = [
            createItem('a', 'todo', { due_date: '2026-08-10', estimatedMinutes: 60, projectId: 'p1', projectTitle: '玄関建具', clientName: '田中様' }),
            createItem('b', 'todo', { due_date: '2026-08-11', estimatedMinutes: 60, projectId: 'p1', projectTitle: '玄関建具', clientName: '田中様' }),
        ];
        const groups = buildOverdueGroups(items, TODAY);
        expect(groups).toHaveLength(1);
        expect(groups[0].groupTitle).toBe('田中様／玄関建具');
        expect(groups[0].items).toHaveLength(2);
    });

    it('得意先名がなければ案件名のみ、案件（projectId）がなければ「その他」にする', () => {
        const items = [
            createItem('a', 'todo', { due_date: '2026-08-10', estimatedMinutes: 60, projectId: 'p2', projectTitle: '納戸棚' }),
            createItem('b', 'todo', { due_date: '2026-08-10', estimatedMinutes: 60 }),
        ];
        const groups = buildOverdueGroups(items, TODAY);
        const titles = groups.map(g => g.groupTitle).sort();
        expect(titles).toEqual(['その他', '納戸棚'].sort());
    });

    it('ブロック内の件数・目安合計h・最古超過日数を算出する', () => {
        const items = [
            createItem('a', 'todo', { due_date: '2026-08-10', estimatedMinutes: 120, projectId: 'p1', projectTitle: 'X' }), // 8日超過
            createItem('b', 'todo', { due_date: '2026-08-16', estimatedMinutes: 60, projectId: 'p1', projectTitle: 'X' }),  // 2日超過
        ];
        const groups = buildOverdueGroups(items, TODAY);
        expect(groups[0].items).toHaveLength(2);
        expect(groups[0].totalMinutes).toBe(180);
        expect(groups[0].oldestOverdueDays).toBe(8);
    });

    it('目安未入力（estimatedMinutesなし）は0として合計する', () => {
        const items = [createItem('a', 'todo', { due_date: '2026-08-10' })];
        const groups = buildOverdueGroups(items, TODAY);
        expect(groups[0].totalMinutes).toBe(0);
    });

    it('ブロック内の行は最古超過日の古い順に並ぶ', () => {
        const items = [
            createItem('new', 'todo', { due_date: '2026-08-17', estimatedMinutes: 30, projectId: 'p1' }),
            createItem('old', 'todo', { due_date: '2026-08-01', estimatedMinutes: 30, projectId: 'p1' }),
        ];
        const groups = buildOverdueGroups(items, TODAY);
        expect(groups[0].items.map(i => i.id)).toEqual(['old', 'new']);
    });

    it('未連絡のブロックが上、その中は最古超過日の古い順に並ぶ', () => {
        const items = [
            createItem('a', 'todo', { due_date: '2026-08-16', estimatedMinutes: 30, projectId: 'p-near' }), // 2日超過・未連絡
            createItem('b', 'todo', { due_date: '2026-08-01', estimatedMinutes: 30, projectId: 'p-far' }),  // 17日超過・未連絡
        ];
        const groups = buildOverdueGroups(items, TODAY);
        expect(groups.map(g => g.projectId)).toEqual(['p-far', 'p-near']);
    });

    it('meta.contacted_at があるブロックは連絡済み扱いとなり下へ回る', () => {
        const items = [
            createItem('a', 'todo', { due_date: '2026-08-01', estimatedMinutes: 30, projectId: 'p-old-contacted', meta: { contacted_at: '2026-08-18' } }), // 最古だが連絡済み
            createItem('b', 'todo', { due_date: '2026-08-16', estimatedMinutes: 30, projectId: 'p-recent' }), // 未連絡
        ];
        const groups = buildOverdueGroups(items, TODAY);
        expect(groups.map(g => g.projectId)).toEqual(['p-recent', 'p-old-contacted']);
        expect(groups.find(g => g.projectId === 'p-old-contacted')?.contacted).toBe(true);
        expect(groups.find(g => g.projectId === 'p-old-contacted')?.contactedAt).toBe('2026-08-18');
        expect(groups.find(g => g.projectId === 'p-recent')?.contacted).toBe(false);
    });

    it('既存metaを保持したままcontacted_atだけ持つ（メタ破壊なし）', () => {
        const items = [
            createItem('a', 'todo', { due_date: '2026-08-01', estimatedMinutes: 30, projectId: 'p1', meta: { flow_x: 5, contacted_at: '2026-08-18' } }),
        ];
        const groups = buildOverdueGroups(items, TODAY);
        expect(groups[0].items[0].meta).toEqual({ flow_x: 5, contacted_at: '2026-08-18' });
    });
});
