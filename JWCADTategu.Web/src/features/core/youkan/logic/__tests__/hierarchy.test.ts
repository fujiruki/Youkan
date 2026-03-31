import { describe, it, expect } from 'vitest';
import { sortItemsHierarchically, getHierarchicalProjects } from '../hierarchy';
import { Item } from '../../types';

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
