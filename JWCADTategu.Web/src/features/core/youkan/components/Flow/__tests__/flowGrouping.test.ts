import { describe, it, expect } from 'vitest';
import { buildGroupNodes, PROJECT_COLORS } from '../flowGrouping';
import type { Item } from '../../../types';
import type { Node } from '@xyflow/react';

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
  meta: { flow_x: 100, flow_y: 200 },
  ...overrides,
});

describe('buildGroupNodes', () => {
  it('プロジェクトIDを持つノードをグループ化する', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: 'p1', projectTitle: 'プロジェクトA', meta: { flow_x: 100, flow_y: 100 } }),
      makeItem({ id: 'b', projectId: 'p1', projectTitle: 'プロジェクトA', meta: { flow_x: 200, flow_y: 200 } }),
      makeItem({ id: 'c', projectId: 'p2', projectTitle: 'プロジェクトB', meta: { flow_x: 400, flow_y: 100 } }),
    ];

    const result = buildGroupNodes(items);

    // 2つのグループノードが生成される
    expect(result.groupNodes).toHaveLength(2);
    // 3つの子ノード情報（parentIdとrelative position）が生成される
    expect(result.childMappings).toHaveLength(3);
  });

  it('プロジェクトIDがないノードはグループ化しない', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: null, meta: { flow_x: 100, flow_y: 100 } }),
      makeItem({ id: 'b', projectId: undefined, meta: { flow_x: 200, flow_y: 200 } }),
    ];

    const result = buildGroupNodes(items);

    expect(result.groupNodes).toHaveLength(0);
    expect(result.childMappings).toHaveLength(0);
  });

  it('グループノードは子ノード群を囲む矩形になる', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: 'p1', projectTitle: 'テスト', meta: { flow_x: 100, flow_y: 100 } }),
      makeItem({ id: 'b', projectId: 'p1', projectTitle: 'テスト', meta: { flow_x: 300, flow_y: 400 } }),
    ];

    const result = buildGroupNodes(items);
    const group = result.groupNodes[0];

    // グループの位置はパディングを含む
    expect(group.position.x).toBeLessThan(100);
    expect(group.position.y).toBeLessThan(100);
    // グループのサイズは子ノードを包含する
    expect(group.style?.width).toBeGreaterThan(200);
    expect(group.style?.height).toBeGreaterThan(300);
  });

  it('子ノードの座標はグループノードからの相対座標に変換される', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: 'p1', projectTitle: 'テスト', meta: { flow_x: 150, flow_y: 200 } }),
    ];

    const result = buildGroupNodes(items);
    const child = result.childMappings[0];

    // 相対座標 = 元の座標 - グループの位置
    const group = result.groupNodes[0];
    expect(child.relativePosition.x).toBe(150 - group.position.x);
    expect(child.relativePosition.y).toBe(200 - group.position.y);
    expect(child.parentId).toBe(group.id);
  });

  it('異なるプロジェクトには異なる背景色が割り当てられる', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: 'p1', projectTitle: 'A', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', projectId: 'p2', projectTitle: 'B', meta: { flow_x: 500, flow_y: 0 } }),
    ];

    const result = buildGroupNodes(items);
    const bg1 = result.groupNodes[0].style?.backgroundColor;
    const bg2 = result.groupNodes[1].style?.backgroundColor;

    expect(bg1).toBeDefined();
    expect(bg2).toBeDefined();
    expect(bg1).not.toBe(bg2);
  });

  it('グループノードのラベルにプロジェクト名が含まれる', () => {
    const items: Item[] = [
      makeItem({ id: 'a', projectId: 'p1', projectTitle: '建具案件A', meta: { flow_x: 0, flow_y: 0 } }),
    ];

    const result = buildGroupNodes(items);
    expect(result.groupNodes[0].data.label).toBe('建具案件A');
  });
});

describe('PROJECT_COLORS', () => {
  it('少なくとも6色以上用意されている', () => {
    expect(PROJECT_COLORS.length).toBeGreaterThanOrEqual(6);
  });
});
