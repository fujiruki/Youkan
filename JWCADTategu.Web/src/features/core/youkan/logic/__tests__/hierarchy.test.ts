import { describe, it, expect } from 'vitest';
import { sortItemsHierarchically, getHierarchicalProjects, buildHierarchicalList } from '../hierarchy';
import { Item, Dependency } from '../../types';

const makeItem = (id: string, parentId?: string | null, projectId?: string | null): Item => ({
  id,
  title: `Item ${id}`,
  status: 'inbox',
  focusOrder: 0,
  isEngaged: false,
  statusUpdatedAt: 0,
  interrupt: false,
  weight: 2,
  parentId: parentId ?? null,
  projectId: projectId ?? null,
  createdAt: 0,
  updatedAt: 0,
  memo: '',
  due_date: '',
  flags: {},
});

const makeProject = (overrides: Partial<{ id: number; title: string; parentId: string; tenantId: string; isArchived: boolean }> = {}) => ({
  id: overrides.id ?? 1,
  title: overrides.title ?? 'Project',
  isArchived: overrides.isArchived ?? false,
  grossProfitTarget: 0,
  createdAt: 0,
  updatedAt: 0,
  parentId: overrides.parentId,
  tenantId: overrides.tenantId,
});

describe('sortItemsHierarchically（BucketColumn用）', () => {
  it('通常の親子関係を正しくフラット化する', () => {
    const items = [
      makeItem('A'),
      makeItem('B', 'A'),
      makeItem('C', 'A'),
    ];
    const result = sortItemsHierarchically(items);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ item: items[0], depth: 0 });
    expect(result[1]).toEqual({ item: items[1], depth: 1 });
    expect(result[2]).toEqual({ item: items[2], depth: 1 });
  });

  it('循環参照（A→B→A）で無限再帰にならない', () => {
    const items = [
      makeItem('A', 'B'),
      makeItem('B', 'A'),
    ];
    // 無限再帰でスタックオーバーフローしないことを確認
    const result = sortItemsHierarchically(items);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('自己参照（A→A）で無限再帰にならない', () => {
    const items = [
      makeItem('A', 'A'),
    ];
    const result = sortItemsHierarchically(items);
    expect(result).toHaveLength(1);
  });

  it('長い循環チェーン（A→B→C→A）で無限再帰にならない', () => {
    const items = [
      makeItem('A', 'C'),
      makeItem('B', 'A'),
      makeItem('C', 'B'),
    ];
    const result = sortItemsHierarchically(items);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

describe('getHierarchicalProjects（ProjectRegistry用）', () => {
  it('通常の親子関係を正しくフラット化する', () => {
    const projects = [
      makeProject({ id: 1, title: '親' }),
      makeProject({ id: 2, title: '子', parentId: '1' }),
    ];
    const result = getHierarchicalProjects(projects);
    expect(result).toHaveLength(2);
    expect(result[0].depth).toBe(0);
    expect(result[1].depth).toBe(1);
  });

  it('循環参照（A→B→A）で無限再帰にならない', () => {
    const projects = [
      makeProject({ id: 1, title: 'A', parentId: '2' }),
      makeProject({ id: 2, title: 'B', parentId: '1' }),
    ];
    const result = getHierarchicalProjects(projects);
    expect(result.length).toBeLessThanOrEqual(2);
  });

  it('自己参照で無限再帰にならない', () => {
    const projects = [
      makeProject({ id: 1, title: 'Self', parentId: '1' }),
    ];
    const result = getHierarchicalProjects(projects);
    expect(result).toHaveLength(1);
  });

  it('長い循環チェーン（A→B→C→A）で無限再帰にならない', () => {
    const projects = [
      makeProject({ id: 1, title: 'A', parentId: '3' }),
      makeProject({ id: 2, title: 'B', parentId: '1' }),
      makeProject({ id: 3, title: 'C', parentId: '2' }),
    ];
    const result = getHierarchicalProjects(projects);
    expect(result.length).toBeLessThanOrEqual(3);
  });
});

describe('buildHierarchicalList（ガントチャート用）', () => {
  const makeProjectItem = (id: string, title: string): Item => ({
    id,
    title,
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
    isProject: true,
    type: 'project',
  });

  it('showGroups=trueでプロジェクトヘッダーが含まれる', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    const task = makeItem('task-1', null, 'proj-1');
    const result = buildHierarchicalList({
      allItems: [task],
      allProjects: [project] as any,
      showGroups: true,
    });
    const headers = result.filter(w => w.type === 'header');
    const items = result.filter(w => w.type === 'item');
    expect(headers.length).toBe(1);
    expect(items.length).toBe(1);
    expect(items[0].depth).toBe(1);
  });

  it('showGroups=falseでプロジェクトヘッダーが含まれない（一覧モード）', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    const task = makeItem('task-1', null, 'proj-1');
    const result = buildHierarchicalList({
      allItems: [task],
      allProjects: [project] as any,
      showGroups: false,
    });
    const headers = result.filter(w => w.type === 'header');
    const items = result.filter(w => w.type === 'item');
    expect(headers.length).toBe(0);
    expect(items.length).toBe(1);
    expect(items[0].depth).toBe(0);
  });

  it('showGroups=falseで親子タスクも全てdepth=0（フラットリスト）', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    const parentTask = makeItem('task-parent', null, 'proj-1');
    const childTask = makeItem('task-child', 'task-parent', 'proj-1');
    const result = buildHierarchicalList({
      allItems: [parentTask, childTask],
      allProjects: [project] as any,
      showGroups: false,
    });
    const headers = result.filter(w => w.type === 'header');
    const items = result.filter(w => w.type === 'item');
    expect(headers.length).toBe(0);
    expect(items.length).toBe(2);
    items.forEach(item => {
      expect(item.depth).toBe(0);
    });
  });

  it('showGroups=falseで深いネスト（孫タスク）も全てdepth=0', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    const parent = makeItem('task-1', null, 'proj-1');
    const child = makeItem('task-2', 'task-1', 'proj-1');
    const grandchild = makeItem('task-3', 'task-2', 'proj-1');
    const result = buildHierarchicalList({
      allItems: [parent, child, grandchild],
      allProjects: [project] as any,
      showGroups: false,
    });
    const items = result.filter(w => w.type === 'item');
    expect(items.length).toBe(3);
    items.forEach(item => {
      expect(item.depth).toBe(0);
    });
  });

  it('showGroups=falseでは期限なしアイテムが先頭、期限ありは日付昇順', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    const noDates = { ...makeItem('task-no-date', null, 'proj-1'), title: '期限なし' };
    const earlyDue = { ...makeItem('task-early', null, 'proj-1'), title: '早い納期', due_date: '2026-01-05' };
    const latePrep = { ...makeItem('task-late', null, 'proj-1'), title: '遅い期限', prep_date: Math.floor(new Date('2026-01-15').getTime() / 1000) };

    const result = buildHierarchicalList({
      allItems: [earlyDue, noDates, latePrep],
      allProjects: [project] as any,
      showGroups: false,
    });

    const items = result.filter(w => w.type === 'item');
    expect(items).toHaveLength(3);
    expect(items[0].item.title).toBe('期限なし');
    expect(items[1].item.title).toBe('早い納期');
    expect(items[2].item.title).toBe('遅い期限');
  });

  it('showGroups切替でアイテム数は変わらない（ヘッダーのみ変化）', () => {
    const project = makeProjectItem('proj-1', 'プロジェクトA');
    const tasks = [
      makeItem('task-1', null, 'proj-1'),
      makeItem('task-2', null, 'proj-1'),
      makeItem('task-3'),
    ];
    const grouped = buildHierarchicalList({
      allItems: tasks,
      allProjects: [project] as any,
      showGroups: true,
    });
    const flat = buildHierarchicalList({
      allItems: tasks,
      allProjects: [project] as any,
      showGroups: false,
    });
    const groupedItems = grouped.filter(w => w.type === 'item');
    const flatItems = flat.filter(w => w.type === 'item');
    expect(groupedItems.length).toBe(flatItems.length);
    expect(grouped.filter(w => w.type === 'header').length).toBeGreaterThan(0);
    expect(flat.filter(w => w.type === 'header').length).toBe(0);
  });

  it('showGroups=false でも is_project=true のアイテムは結果に含まれない', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    const task = makeItem('task-1', null, 'proj-1');
    // allItemsにis_project=trueのプロジェクト自体が混入した場合
    const result = buildHierarchicalList({
      allItems: [project, task],
      allProjects: [project] as any,
      showGroups: false,
    });
    const items = result.filter(w => w.type === 'item');
    expect(items.length).toBe(1);
    expect(items[0].item.id).toBe('task-1');
    // プロジェクト自体が一覧に含まれていないこと
    expect(items.find(w => w.item.id === 'proj-1')).toBeUndefined();
  });

  it('showGroups=false で wrapper.project は null（projectTitleのみ使用）', () => {
    const project = makeProjectItem('proj-1', '総会');
    const task = { ...makeItem('task-1', null, 'proj-1'), projectTitle: '佐礼谷プロジェクト' };
    const result = buildHierarchicalList({
      allItems: [task],
      allProjects: [project] as any,
      showGroups: false,
    });
    const items = result.filter(w => w.type === 'item');
    expect(items.length).toBe(1);
    // showGroups=false ではwrapper.projectはnull（フロントはitem.projectTitleのみ使用すべき）
    expect(items[0].project).toBeNull();
  });
});

describe('buildHierarchicalList: 依存関係によるソート', () => {
  const makeProjectItem = (id: string, title: string): Item => ({
    id,
    title,
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
    isProject: true,
    type: 'project',
  });

  const makeDep = (id: string, sourceItemId: string, targetItemId: string): Dependency => ({
    id,
    sourceItemId,
    targetItemId,
    createdAt: 0,
  });

  it('依存関係A→B→Cがある場合、A, B, Cの順に並ぶ', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    // createdAtを逆順にして、依存関係なしなら違う順序になることを保証
    const taskA = { ...makeItem('A', null, 'proj-1'), title: 'タスクA', createdAt: 100 };
    const taskB = { ...makeItem('B', null, 'proj-1'), title: 'タスクB', createdAt: 200 };
    const taskC = { ...makeItem('C', null, 'proj-1'), title: 'タスクC', createdAt: 300 };

    const deps: Dependency[] = [
      makeDep('dep-1', 'A', 'B'),
      makeDep('dep-2', 'B', 'C'),
    ];

    const result = buildHierarchicalList({
      allItems: [taskC, taskB, taskA],
      allProjects: [project] as any,
      showGroups: true,
      dependencies: deps,
    });

    const items = result.filter(w => w.type === 'item');
    expect(items.map(w => w.item.id)).toEqual(['A', 'B', 'C']);
  });

  it('依存関係がないアイテムは既存の納期順を維持', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    const taskA = { ...makeItem('A', null, 'proj-1'), title: 'タスクA', due_date: '2026-03-01' };
    const taskB = { ...makeItem('B', null, 'proj-1'), title: 'タスクB', due_date: '2026-01-01' };
    const taskC = { ...makeItem('C', null, 'proj-1'), title: 'タスクC', due_date: '2026-02-01' };

    const result = buildHierarchicalList({
      allItems: [taskA, taskB, taskC],
      allProjects: [project] as any,
      showGroups: true,
      dependencies: [],
    });

    const items = result.filter(w => w.type === 'item');
    // 納期順: B(1月) → C(2月) → A(3月)
    expect(items.map(w => w.item.id)).toEqual(['B', 'C', 'A']);
  });

  it('依存関係があるアイテムとないアイテムが混在する場合', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    // 依存関係なし: 納期順で並ぶ
    const taskX = { ...makeItem('X', null, 'proj-1'), title: 'タスクX', due_date: '2026-01-15' };
    // 依存関係あり: A→B の順
    const taskA = { ...makeItem('A', null, 'proj-1'), title: 'タスクA', due_date: '2026-03-01' };
    const taskB = { ...makeItem('B', null, 'proj-1'), title: 'タスクB', due_date: '2026-01-01' };

    const deps: Dependency[] = [
      makeDep('dep-1', 'A', 'B'),
    ];

    const result = buildHierarchicalList({
      allItems: [taskX, taskA, taskB],
      allProjects: [project] as any,
      showGroups: true,
      dependencies: deps,
    });

    const items = result.filter(w => w.type === 'item');
    // 依存チェーンのアンカー（A）の着手限界日で位置決定
    // Aのdue_date=3/1, Bのdue_date=1/1 → チェーンアンカーはAの着手限界日
    // Xのdue_date=1/15
    // 順序: X(1/15), A(依存チェーン先頭), B(Aの後)  or A, B, X
    // 依存チェーンの位置は先頭アイテム（A）の着手限界日で決まる
    // A→Bチェーンは A のソート位置に挿入される
    // ただしAの納期=3/1 > X=1/15 なので X, A, B の順
    expect(items.map(w => w.item.id)).toEqual(['X', 'A', 'B']);
  });

  it('同一プロジェクト内の複数の独立した依存チェーン', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    // チェーン1: A→B
    const taskA = { ...makeItem('A', null, 'proj-1'), title: 'タスクA', due_date: '2026-02-01' };
    const taskB = { ...makeItem('B', null, 'proj-1'), title: 'タスクB', due_date: '2026-01-01' };
    // チェーン2: C→D
    const taskC = { ...makeItem('C', null, 'proj-1'), title: 'タスクC', due_date: '2026-01-15' };
    const taskD = { ...makeItem('D', null, 'proj-1'), title: 'タスクD', due_date: '2026-03-01' };

    const deps: Dependency[] = [
      makeDep('dep-1', 'A', 'B'),
      makeDep('dep-2', 'C', 'D'),
    ];

    const result = buildHierarchicalList({
      allItems: [taskA, taskB, taskC, taskD],
      allProjects: [project] as any,
      showGroups: true,
      dependencies: deps,
    });

    const items = result.filter(w => w.type === 'item');
    const ids = items.map(w => w.item.id);
    // A→BとC→Dの順序は維持される（AはBより前、CはDより前）
    expect(ids.indexOf('A')).toBeLessThan(ids.indexOf('B'));
    expect(ids.indexOf('C')).toBeLessThan(ids.indexOf('D'));
  });

  it('showGroups=falseでも依存関係順が反映される', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    const taskA = { ...makeItem('A', null, 'proj-1'), title: 'タスクA', createdAt: 100 };
    const taskB = { ...makeItem('B', null, 'proj-1'), title: 'タスクB', createdAt: 200 };
    const taskC = { ...makeItem('C', null, 'proj-1'), title: 'タスクC', createdAt: 300 };

    const deps: Dependency[] = [
      makeDep('dep-1', 'A', 'B'),
      makeDep('dep-2', 'B', 'C'),
    ];

    const result = buildHierarchicalList({
      allItems: [taskC, taskB, taskA],
      allProjects: [project] as any,
      showGroups: false,
      dependencies: deps,
    });

    const items = result.filter(w => w.type === 'item');
    expect(items.map(w => w.item.id)).toEqual(['A', 'B', 'C']);
  });

  it('dependenciesを渡さない場合は従来通りのソートが維持される', () => {
    const project = makeProjectItem('proj-1', 'テストプロジェクト');
    const taskA = { ...makeItem('A', null, 'proj-1'), title: 'タスクA', due_date: '2026-03-01' };
    const taskB = { ...makeItem('B', null, 'proj-1'), title: 'タスクB', due_date: '2026-01-01' };

    const result = buildHierarchicalList({
      allItems: [taskA, taskB],
      allProjects: [project] as any,
      showGroups: true,
    });

    const items = result.filter(w => w.type === 'item');
    // 納期順: B(1月) → A(3月)
    expect(items.map(w => w.item.id)).toEqual(['B', 'A']);
  });
});
