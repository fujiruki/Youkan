import { describe, it, expect } from 'vitest';
import { calculateAutoArrange } from '../flowAutoArrange';
import type { Item, Dependency } from '../../types';

const makeItem = (overrides: Partial<Item>): Item => ({
  id: 'item-1',
  title: 'テスト',
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

const dep = (source: string, target: string): Dependency => ({
  id: `${source}->${target}`,
  sourceItemId: source,
  targetItemId: target,
  createdAt: 0,
});

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 60;

const overlaps = (
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number }
): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('calculateAutoArrange', () => {
  it('どのノードのバウンディングボックスも重ならない', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 100, flow_y: 0 } }),
      makeItem({ id: 'c', meta: { flow_x: 0, flow_y: 200 } }),
      makeItem({ id: 'd', meta: { flow_x: 100, flow_y: 200 } }),
    ];
    const deps = [dep('a', 'b'), dep('a', 'c'), dep('b', 'd'), dep('c', 'd')];
    const placements = calculateAutoArrange(items, deps);

    const rects = placements.map((p) => ({ x: p.flow_x, y: p.flow_y, w: DEFAULT_WIDTH, h: DEFAULT_HEIGHT }));
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        expect(overlaps(rects[i], rects[j])).toBe(false);
      }
    }
  });

  it('依存先は依存元より下（yが大きい）に置かれる', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'c', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const deps = [dep('a', 'b'), dep('b', 'c')];
    const placements = calculateAutoArrange(items, deps);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('b')!.flow_y).toBeGreaterThan(byId.get('a')!.flow_y);
    expect(byId.get('c')!.flow_y).toBeGreaterThan(byId.get('b')!.flow_y);
  });

  it('交差する依存関係が重心法で並べ替えられる（A→D, B→C）', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 100, flow_y: 0 } }),
      makeItem({ id: 'c', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'd', meta: { flow_x: 100, flow_y: 0 } }),
    ];
    // 初期順のまま(rank1=[c,d])だとA(左)→D(右)、B(右)→C(左)で交差する
    const deps = [dep('a', 'd'), dep('b', 'c')];
    const placements = calculateAutoArrange(items, deps);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // 交差を減らすため rank1 は d が c より左になるよう並べ替わる
    expect(byId.get('d')!.flow_x).toBeLessThan(byId.get('c')!.flow_x);
  });

  it('プロジェクトが横方向に分かれ、重ならない', () => {
    const items = [
      makeItem({ id: 'p1a', projectId: 'p1', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'p1b', projectId: 'p1', meta: { flow_x: 200, flow_y: 0 } }),
      makeItem({ id: 'p2a', projectId: 'p2', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'p2b', projectId: 'p2', meta: { flow_x: 200, flow_y: 0 } }),
    ];
    const placements = calculateAutoArrange(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    const p1MaxRight = Math.max(byId.get('p1a')!.flow_x, byId.get('p1b')!.flow_x) + DEFAULT_WIDTH;
    const p2MinLeft = Math.min(byId.get('p2a')!.flow_x, byId.get('p2b')!.flow_x);
    expect(p2MinLeft).toBeGreaterThanOrEqual(p1MaxRight);
  });

  it('sizesを渡すと実測幅に応じて間隔が変わる', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 100, flow_y: 0 } }),
    ];
    const defaultPlacements = calculateAutoArrange(items, []);
    const defaultById = new Map(defaultPlacements.map((p) => [p.itemId, p]));
    const defaultGap = defaultById.get('b')!.flow_x - defaultById.get('a')!.flow_x;

    const sizes = new Map([['a', { width: 400, height: 60 }]]);
    const widePlacements = calculateAutoArrange(items, [], sizes);
    const wideById = new Map(widePlacements.map((p) => [p.itemId, p]));
    const wideGap = wideById.get('b')!.flow_x - wideById.get('a')!.flow_x;

    expect(wideGap).toBeGreaterThan(defaultGap);
  });

  it('依存のない同じ層のノードは元のflow_x順が同点解消に使われる', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 300, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 100, flow_y: 0 } }),
      makeItem({ id: 'c', meta: { flow_x: 200, flow_y: 0 } }),
    ];
    const placements = calculateAutoArrange(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // 元のflow_x順（b < c < a）のまま左から並ぶ
    expect(byId.get('b')!.flow_x).toBeLessThan(byId.get('c')!.flow_x);
    expect(byId.get('c')!.flow_x).toBeLessThan(byId.get('a')!.flow_x);
  });

  it('アイテムが空なら空配列を返す', () => {
    expect(calculateAutoArrange([], [])).toEqual([]);
  });
});
