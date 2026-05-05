import { describe, it, expect } from 'vitest';
import { buildHierarchicalList, type HierarchicalWrapper } from '../hierarchy';
import type { Item } from '../../types';

describe('R-030: HierarchicalWrapper type split', () => {
  const setupData = (): { projects: Item[]; items: Item[] } => {
    const projects = [
      { id: 'proj-1', title: 'プロジェクト1', isProject: true } as any,
    ];
    const items = [
      { id: 'task-1', title: 'タスク1', projectId: 'proj-1' } as any,
      { id: 'task-2', title: 'タスク2', projectId: 'proj-1' } as any,
    ];
    return { projects, items };
  };

  it('ヘッダー型のwrapper.idは header-{projectId} 形式（virtual-header- は含まれない）', () => {
    const { projects, items } = setupData();
    const result = buildHierarchicalList({
      allItems: items, allProjects: projects, showGroups: true,
    });
    const header = result.find(w => w.type === 'header');
    expect(header).toBeDefined();
    expect(header!.id).toBe('header-proj-1');
    expect(header!.id).not.toContain('virtual-header-');
  });

  it('ヘッダー型は projectId / projectTitle を持つ（item は持たない）', () => {
    const { projects, items } = setupData();
    const result = buildHierarchicalList({
      allItems: items, allProjects: projects, showGroups: true,
    });
    const header = result.find(w => w.type === 'header');
    expect(header).toBeDefined();
    if (header && header.type === 'header') {
      expect(header.projectId).toBe('proj-1');
      expect(header.projectTitle).toBe('プロジェクト1');
      expect((header as any).item).toBeUndefined();
    }
  });

  it('アイテム型の wrapper.item.id は実IDのまま（virtual-header- が混入しない）', () => {
    const { projects, items } = setupData();
    const result = buildHierarchicalList({
      allItems: items, allProjects: projects, showGroups: true,
    });
    const itemWrappers = result.filter(w => w.type === 'item');
    expect(itemWrappers.length).toBeGreaterThan(0);
    itemWrappers.forEach(w => {
      if (w.type === 'item') {
        expect(w.item.id).not.toContain('virtual-header-');
      }
    });
  });

  it('ヘッダー型の project は元のプロジェクト本体を参照（id偽装なし）', () => {
    const { projects, items } = setupData();
    const result = buildHierarchicalList({
      allItems: items, allProjects: projects, showGroups: true,
    });
    const header = result.find(w => w.type === 'header');
    if (header && header.type === 'header') {
      expect(header.project.id).toBe('proj-1');
      expect(header.project.id).not.toContain('virtual-header-');
    }
  });

  it('全 wrapper.id が一意（React key 衝突防止）', () => {
    const { projects, items } = setupData();
    const result = buildHierarchicalList({
      allItems: items, allProjects: projects, showGroups: true,
    });
    const ids = result.map(w => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
