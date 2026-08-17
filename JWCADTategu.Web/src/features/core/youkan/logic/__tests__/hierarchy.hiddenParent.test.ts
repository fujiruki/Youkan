import { describe, it, expect } from 'vitest';
import { buildHierarchicalList } from '../hierarchy';
import { Item } from '../../types';

const makeItem = (id: string, overrides: Partial<Item> = {}): Item => ({
  id,
  title: `Item ${id}`,
  status: 'inbox',
  focusOrder: 0,
  isEngaged: false,
  statusUpdatedAt: 0,
  interrupt: false,
  weight: 2,
  parentId: null,
  projectId: null,
  createdAt: 0,
  updatedAt: 0,
  memo: '',
  due_date: '',
  flags: {},
  ...overrides,
} as Item);

// R-123: 親タスクが done（hideCompleted時）または isArchived で一覧から除外されると、
// その子タスクが addRecursiveHierarchy から一度も呼ばれず、projectIdは合致しているのに
// 一覧全体から消えてしまうバグの回帰テスト。全体一覧でフローチャートより表示件数が
// 少なく見える症状の根本原因だった。
describe('buildHierarchicalList: 親タスクが除外された子タスクの表示', () => {
  it('親タスクが done（hideCompleted=true）で除外されても、未完了の子タスクはプロジェクト直下に表示される', () => {
    const project: any = { id: 'proj-1', title: '石鎚山', isProject: true, parentId: null, projectId: null };
    const parentTask = makeItem('task-A', { projectId: 'proj-1', status: 'done' });
    const childTask = makeItem('task-B', { projectId: 'proj-1', parentId: 'task-A', status: 'inbox' });

    const result = buildHierarchicalList({
      activeProjectId: 'proj-1',
      allProjects: [project],
      allItems: [parentTask, childTask],
      showGroups: true,
      hideCompleted: true,
      dependencies: [],
    });

    const ids = result.filter(w => w.type === 'item').map(w => (w as any).item.id);
    expect(ids).toContain('task-B');
  });

  it('親タスクが isArchived で除外されても、アーカイブされていない子タスクはプロジェクト直下に表示される', () => {
    const project: any = { id: 'proj-1', title: '石鎚山', isProject: true, parentId: null, projectId: null };
    const parentTask = makeItem('task-A', { projectId: 'proj-1', isArchived: true } as any);
    const childTask = makeItem('task-B', { projectId: 'proj-1', parentId: 'task-A', isArchived: false } as any);

    const result = buildHierarchicalList({
      activeProjectId: 'proj-1',
      allProjects: [project],
      allItems: [parentTask, childTask],
      showGroups: true,
      hideCompleted: false,
      dependencies: [],
    });

    const ids = result.filter(w => w.type === 'item').map(w => (w as any).item.id);
    expect(ids).toContain('task-B');
  });
});
