import { describe, it, expect } from 'vitest';
import { buildHierarchicalList } from '../hierarchy';
import type { Item } from '../../types';

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

const makeTask = (id: string, projectId: string | null = null, parentId: string | null = null): Item => ({
  id,
  title: `タスク ${id}`,
  status: 'inbox',
  focusOrder: 0,
  isEngaged: false,
  statusUpdatedAt: 0,
  interrupt: false,
  weight: 2,
  parentId,
  projectId,
  createdAt: 0,
  updatedAt: 0,
  memo: '',
  due_date: '',
  flags: {},
});

describe('R-030ガードテスト: buildHierarchicalList 既存挙動固定', () => {
  describe('プロジェクト1個 + 配下タスク2個', () => {
    const projects = [makeProjectItem('proj-1', 'プロジェクト1')];
    const items = [
      makeTask('task-1', 'proj-1'),
      makeTask('task-2', 'proj-1'),
    ];

    it('結果配列の長さが3（ヘッダー1 + アイテム2）', () => {
      const result = buildHierarchicalList({
        allItems: items,
        allProjects: projects as any,
        showGroups: true,
      });
      expect(result).toHaveLength(3);
    });

    it('0番目が type:header', () => {
      const result = buildHierarchicalList({
        allItems: items,
        allProjects: projects as any,
        showGroups: true,
      });
      expect(result[0].type).toBe('header');
    });

    it('1番目と2番目が type:item', () => {
      const result = buildHierarchicalList({
        allItems: items,
        allProjects: projects as any,
        showGroups: true,
      });
      expect(result[1].type).toBe('item');
      expect(result[2].type).toBe('item');
    });

    it('ヘッダーのdepthが0', () => {
      const result = buildHierarchicalList({
        allItems: items,
        allProjects: projects as any,
        showGroups: true,
      });
      expect(result[0].depth).toBe(0);
    });

    it('アイテムのdepthが1（プロジェクト配下）', () => {
      const result = buildHierarchicalList({
        allItems: items,
        allProjects: projects as any,
        showGroups: true,
      });
      expect(result[1].depth).toBe(1);
      expect(result[2].depth).toBe(1);
    });
  });

  describe('多階層プロジェクト（親 > 子プロジェクト > 孫タスク）', () => {
    const parentProj = makeProjectItem('parent-proj', '親プロジェクト');
    const childProj = { ...makeProjectItem('child-proj', '子プロジェクト'), projectId: 'parent-proj' };
    const grandchild = makeTask('grandchild-task', 'child-proj');

    it('ヘッダーが各プロジェクトごとに出る（2個）', () => {
      const result = buildHierarchicalList({
        allItems: [grandchild],
        allProjects: [parentProj, childProj] as any,
        showGroups: true,
      });
      const headers = result.filter(w => w.type === 'header');
      expect(headers.length).toBe(2);
    });

    it('親プロジェクトのヘッダーdepthが0', () => {
      const result = buildHierarchicalList({
        allItems: [grandchild],
        allProjects: [parentProj, childProj] as any,
        showGroups: true,
      });
      const headers = result.filter(w => w.type === 'header');
      const parentHeader = headers.find(h => h.id === `header-${parentProj.id}`);
      expect(parentHeader).toBeDefined();
      expect(parentHeader!.depth).toBe(0);
    });

    it('子プロジェクトのヘッダーdepthが親より大きい', () => {
      const result = buildHierarchicalList({
        allItems: [grandchild],
        allProjects: [parentProj, childProj] as any,
        showGroups: true,
      });
      const headers = result.filter(w => w.type === 'header');
      const parentHeader = headers.find(h => h.id === `header-${parentProj.id}`);
      const childHeader = headers.find(h => h.id === `header-${childProj.id}`);
      expect(childHeader).toBeDefined();
      expect(childHeader!.depth).toBeGreaterThan(parentHeader!.depth);
    });

    it('孫タスクのdepthが子プロジェクトヘッダーより大きい', () => {
      const result = buildHierarchicalList({
        allItems: [grandchild],
        allProjects: [parentProj, childProj] as any,
        showGroups: true,
      });
      const headers = result.filter(w => w.type === 'header');
      const childHeader = headers.find(h => h.id === `header-${childProj.id}`);
      const taskWrapper = result.find(w => w.type === 'item');
      expect(taskWrapper).toBeDefined();
      expect(taskWrapper!.depth).toBeGreaterThan(childHeader!.depth);
    });
  });

  describe('wrapper.id の一意性（React key 衝突防止）', () => {
    it('プロジェクト1個 + タスク2個の全 wrapper.id が一意', () => {
      const projects = [makeProjectItem('proj-1', 'プロジェクト1')];
      const items = [makeTask('task-1', 'proj-1'), makeTask('task-2', 'proj-1')];
      const result = buildHierarchicalList({
        allItems: items,
        allProjects: projects as any,
        showGroups: true,
      });
      const ids = result.map(w => w.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('複数プロジェクト + 複数タスクの全 wrapper.id が一意', () => {
      const projects = [
        makeProjectItem('proj-1', 'プロジェクト1'),
        makeProjectItem('proj-2', 'プロジェクト2'),
      ];
      const items = [
        makeTask('task-1', 'proj-1'),
        makeTask('task-2', 'proj-1'),
        makeTask('task-3', 'proj-2'),
      ];
      const result = buildHierarchicalList({
        allItems: items,
        allProjects: projects as any,
        showGroups: true,
      });
      const ids = result.map(w => w.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('ヘッダーの id は header-{projectId} 形式', () => {
      const projects = [makeProjectItem('proj-abc', 'テスト')];
      const items = [makeTask('task-1', 'proj-abc')];
      const result = buildHierarchicalList({
        allItems: items,
        allProjects: projects as any,
        showGroups: true,
      });
      const header = result.find(w => w.type === 'header');
      expect(header).toBeDefined();
      expect(header!.id).toBe('header-proj-abc');
    });

    it('アイテムの id はタスク実ID', () => {
      const projects = [makeProjectItem('proj-1', 'テスト')];
      const items = [makeTask('task-xyz', 'proj-1')];
      const result = buildHierarchicalList({
        allItems: items,
        allProjects: projects as any,
        showGroups: true,
      });
      const itemWrapper = result.find(w => w.type === 'item');
      expect(itemWrapper).toBeDefined();
      expect(itemWrapper!.id).toBe('task-xyz');
    });
  });
});
