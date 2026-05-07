import { describe, it, expect } from 'vitest';
import { buildForAiMarkdown } from '../forAiExporter';
import type { Item } from '../../types';

const makeItem = (overrides: Partial<Item>): Item => ({
  id: 'item-1',
  title: 'テストタスク',
  status: 'inbox',
  focusOrder: 0,
  isEngaged: false,
  statusUpdatedAt: 0,
  interrupt: false,
  weight: 1,
  createdAt: 1000,
  updatedAt: 1000,
  meta: null,
  ...overrides,
});

const baseInput = {
  perspectiveLabel: '藤田建具店',
  today: new Date('2026-05-07'),
  groups: [] as { groupTitle: string; items: Item[] }[],
};

describe('buildForAiMarkdown', () => {
  describe('ヘッダー', () => {
    it('日付と立場ラベルを含むヘッダーを生成する', () => {
      const md = buildForAiMarkdown({ ...baseInput, groups: [] });
      expect(md).toContain('# Youkan タスク状況 (2026-05-07)');
      expect(md).toContain('## 立場: 藤田建具店');
    });

    it('todayの日付をYYYY-MM-DD形式でフォーマットする', () => {
      const md = buildForAiMarkdown({ ...baseInput, today: new Date('2026-01-15'), groups: [] });
      expect(md).toContain('2026-01-15');
    });
  });

  describe('グループ出力', () => {
    it('全グループ空の場合はヘッダーのみ出力される', () => {
      const md = buildForAiMarkdown({ ...baseInput, groups: [] });
      expect(md).not.toContain('## 実行中');
      expect(md).not.toContain('## 今日やる');
    });

    it('グループにアイテムがある場合はグループタイトルを出力する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [
          { groupTitle: '実行中', items: [makeItem({ id: 'a', title: 'タスクA' })] },
        ],
      });
      expect(md).toContain('## 実行中');
    });

    it('アイテムがないグループはスキップする', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [
          { groupTitle: '実行中', items: [] },
          { groupTitle: '今日やる（確定）', items: [makeItem({ id: 'b', title: 'タスクB' })] },
        ],
      });
      expect(md).not.toContain('## 実行中');
      expect(md).toContain('## 今日やる（確定）');
    });

    it('複数グループを順序通りに出力する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [
          { groupTitle: 'Inbox', items: [makeItem({ id: 'c', title: 'タスクC' })] },
          { groupTitle: 'Ready', items: [makeItem({ id: 'd', title: 'タスクD' })] },
        ],
      });
      const inboxPos = md.indexOf('## Inbox');
      const readyPos = md.indexOf('## Ready');
      expect(inboxPos).toBeLessThan(readyPos);
    });
  });

  describe('アイテム行フォーマット', () => {
    it('タイトルを含む行を生成する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{ groupTitle: 'Inbox', items: [makeItem({ id: 'a', title: '寸法決め' })] }],
      });
      expect(md).toContain('寸法決め');
      expect(md).toContain('- [ ]');
    });

    it('プロジェクト名（projectTitle）があれば括弧内に表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: '寸法決め', projectTitle: '2F組子製作' })],
        }],
      });
      expect(md).toContain('(2F組子製作)');
    });

    it('projectTitleがなくprojectIdがある場合はprojectIdを表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', projectId: 'proj-abc', projectTitle: undefined })],
        }],
      });
      expect(md).toContain('(proj-abc)');
    });

    it('projectTitleもprojectIdもない場合は「Inbox」を表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', projectId: null, projectTitle: undefined })],
        }],
      });
      expect(md).toContain('(Inbox)');
    });

    it('due_dateがある場合は納期を表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', due_date: '2026-05-10' })],
        }],
      });
      expect(md).toContain('納期: 2026-05-10');
    });

    it('due_dateがない場合は納期を表示しない', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', due_date: null })],
        }],
      });
      expect(md).not.toContain('納期:');
    });

    it('prep_dateがある場合はマイ期限をYYYY-MM-DD形式で表示する', () => {
      // 2026-05-01 00:00:00 UTC = 1746057600 秒
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', prep_date: 1746057600 })],
        }],
      });
      expect(md).toContain('マイ期限:');
    });

    it('prep_dateがない場合はマイ期限を表示しない', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', prep_date: null })],
        }],
      });
      expect(md).not.toContain('マイ期限:');
    });

    it('estimatedMinutes=60の場合は"1h"と表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', estimatedMinutes: 60 })],
        }],
      });
      expect(md).toContain('目安: 1h');
    });

    it('estimatedMinutes=90の場合は"1.5h"と表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', estimatedMinutes: 90 })],
        }],
      });
      expect(md).toContain('目安: 1.5h');
    });

    it('estimatedMinutes=30の場合は"30m"と表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', estimatedMinutes: 30 })],
        }],
      });
      expect(md).toContain('目安: 30m');
    });

    it('estimatedMinutesがない場合は目安を表示しない', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', estimatedMinutes: undefined })],
        }],
      });
      expect(md).not.toContain('目安:');
    });

    it('work_daysがある場合は目安期間を表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', work_days: 1.5 })],
        }],
      });
      expect(md).toContain('目安期間: 1.5日');
    });

    it('memoがある場合は表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', memo: '重要な注意事項' })],
        }],
      });
      expect(md).toContain('メモ: 重要な注意事項');
    });

    it('memoが改行を含む場合もそのまま表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', memo: '1行目\n2行目' })],
        }],
      });
      expect(md).toContain('メモ: 1行目\n2行目');
    });

    it('assigneeNameがある場合は担当者を表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', assigneeName: '田中さん' })],
        }],
      });
      expect(md).toContain('担当: 田中さん');
    });

    it('assigneeNameがなくassignedToがある場合はassignedToを表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', assignedTo: 'user-456', assigneeName: undefined })],
        }],
      });
      expect(md).toContain('担当: user-456');
    });

    it('tenantNameがある場合は所属会社を表示する', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [makeItem({ title: 'タスク', tenantName: '藤田建具店' })],
        }],
      });
      expect(md).toContain('会社: 藤田建具店');
    });

    it('全フィールド欠損の場合はタイトルのみ表示される', () => {
      const item = makeItem({
        title: 'シンプルタスク',
        projectTitle: undefined,
        projectId: null,
        due_date: null,
        prep_date: null,
        estimatedMinutes: undefined,
        work_days: undefined,
        memo: undefined,
        assigneeName: undefined,
        assignedTo: undefined,
        tenantName: undefined,
      });
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{ groupTitle: 'Inbox', items: [item] }],
      });
      expect(md).toContain('シンプルタスク');
      expect(md).not.toContain('納期:');
      expect(md).not.toContain('マイ期限:');
      expect(md).not.toContain('目安:');
      expect(md).not.toContain('メモ:');
      expect(md).not.toContain('担当:');
      expect(md).not.toContain('会社:');
    });
  });

  describe('複数アイテム', () => {
    it('複数アイテムがある場合は全て出力される', () => {
      const md = buildForAiMarkdown({
        ...baseInput,
        groups: [{
          groupTitle: 'Inbox',
          items: [
            makeItem({ id: 'a', title: 'タスクA' }),
            makeItem({ id: 'b', title: 'タスクB' }),
            makeItem({ id: 'c', title: 'タスクC' }),
          ],
        }],
      });
      expect(md).toContain('タスクA');
      expect(md).toContain('タスクB');
      expect(md).toContain('タスクC');
    });
  });
});
