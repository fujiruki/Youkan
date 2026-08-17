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

// R-124: 却下(cancelled)状態のアイテムが全体一覧から消えないようにする回帰テスト。
// hideCompleted=falseの既定表示では、doneと同様にcancelledも一覧に表示され続ける必要がある。
// hideCompleted=true（完了を隠す）時は、doneと同じ「履歴」グループとしてcancelledも隠れる。
describe('buildHierarchicalList: cancelledアイテムの表示', () => {
  it('hideCompleted=falseなら、cancelledのアイテムは一覧に表示される', () => {
    const cancelledTask = makeItem('task-cancelled', { status: 'cancelled' });

    const result = buildHierarchicalList({
      activeProjectId: null,
      allProjects: [],
      allItems: [cancelledTask],
      showGroups: true,
      hideCompleted: false,
      dependencies: [],
    });

    const ids = result.filter(w => w.type === 'item').map(w => (w as any).item.id);
    expect(ids).toContain('task-cancelled');
  });

  it('hideCompleted=trueなら、doneと同様にcancelledのアイテムも一覧から隠れる', () => {
    const cancelledTask = makeItem('task-cancelled', { status: 'cancelled' });

    const result = buildHierarchicalList({
      activeProjectId: null,
      allProjects: [],
      allItems: [cancelledTask],
      showGroups: true,
      hideCompleted: true,
      dependencies: [],
    });

    const ids = result.filter(w => w.type === 'item').map(w => (w as any).item.id);
    expect(ids).not.toContain('task-cancelled');
  });
});
