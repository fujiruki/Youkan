import { describe, it, expect } from 'vitest';
import { buildProjectSummaries } from '../FlowProjectSelector';
import type { Item } from '../../../types';

const makeItem = (overrides: Partial<Item>): Item => ({
  id: 'item-1',
  title: 'テスト',
  status: 'inbox',
  focusOrder: 0,
  isEngaged: false,
  statusUpdatedAt: 0,
  interrupt: false,
  weight: 1,
  createdAt: 0,
  updatedAt: 0,
  ...overrides,
});

describe('buildProjectSummaries', () => {
  it('プロジェクトごとにタスク数・完了率を集計する', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: 'p1', projectTitle: 'プロジェクトA', status: 'done' }),
      makeItem({ id: 'b', projectId: 'p1', projectTitle: 'プロジェクトA', status: 'focus' }),
      makeItem({ id: 'c', projectId: 'p2', projectTitle: 'プロジェクトB', status: 'inbox' }),
    ];

    const result = buildProjectSummaries(items);

    expect(result).toHaveLength(2);
    const p1 = result.find(s => s.projectId === 'p1')!;
    expect(p1.taskCount).toBe(2);
    expect(p1.doneCount).toBe(1);
    expect(p1.completionRate).toBe(50);
  });

  it('projectIdがないアイテムは無視する', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: null }),
      makeItem({ id: 'b', projectId: undefined }),
      makeItem({ id: 'c', projectId: 'p1', projectTitle: 'P1' }),
    ];

    const result = buildProjectSummaries(items);
    expect(result).toHaveLength(1);
    expect(result[0].projectId).toBe('p1');
  });

  it('直近期限が正しく取得される', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: 'p1', projectTitle: 'P1', due_date: '2026-04-15' }),
      makeItem({ id: 'b', projectId: 'p1', projectTitle: 'P1', due_date: '2026-04-10' }),
      makeItem({ id: 'c', projectId: 'p1', projectTitle: 'P1', due_date: '2026-04-20' }),
    ];

    const result = buildProjectSummaries(items);
    expect(result[0].nearestDueDate).toBe('2026-04-10');
  });

  it('タスク数の降順でソートされる', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: 'p1', projectTitle: 'P1' }),
      makeItem({ id: 'b', projectId: 'p2', projectTitle: 'P2' }),
      makeItem({ id: 'c', projectId: 'p2', projectTitle: 'P2' }),
      makeItem({ id: 'd', projectId: 'p2', projectTitle: 'P2' }),
    ];

    const result = buildProjectSummaries(items);
    expect(result[0].projectId).toBe('p2');
    expect(result[1].projectId).toBe('p1');
  });

  it('空配列 → 空結果', () => {
    expect(buildProjectSummaries([])).toEqual([]);
  });
});
