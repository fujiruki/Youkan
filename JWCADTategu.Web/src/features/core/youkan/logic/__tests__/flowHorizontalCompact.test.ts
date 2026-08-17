import { describe, it, expect } from 'vitest';
import { calculateHorizontalCompact } from '../flowHorizontalCompact';
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
const DEFAULT_GAP_X = 35;

describe('calculateHorizontalCompact', () => {
  it('Yが重なるノード同士はgapX以上の間隔を保つ', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      // aと同じY区間で、詰める前はaと重なるほど近い
      makeItem({ id: 'b', meta: { flow_x: 500, flow_y: 0 } }),
    ];
    const placements = calculateHorizontalCompact(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('b')!.flow_x - byId.get('a')!.flow_x).toBeGreaterThanOrEqual(
      DEFAULT_WIDTH + DEFAULT_GAP_X
    );
  });

  it('Yが重ならないノード同士は独立して詰まる（左に大きな隙間があれば個別に左へ移動できる）', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 500, flow_y: 0 } }),
      makeItem({ id: 'c', meta: { flow_x: 0, flow_y: 300 } }),
      makeItem({ id: 'd', meta: { flow_x: 800, flow_y: 300 } }),
    ];
    const placements = calculateHorizontalCompact(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));

    // 両方の行が、それぞれの元の左のノードの右端直後まで個別に詰まる（大きな隙間が縮まる）
    expect(byId.get('b')!.flow_x).toBeLessThan(500);
    expect(byId.get('d')!.flow_x).toBeLessThan(800);
    expect(byId.get('b')!.flow_x).toBe(byId.get('a')!.flow_x + DEFAULT_WIDTH + DEFAULT_GAP_X);
    expect(byId.get('d')!.flow_x).toBe(byId.get('c')!.flow_x + DEFAULT_WIDTH + DEFAULT_GAP_X);
  });

  it('依存関係があっても無視して横方向の重なりだけで判定する', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      // aとYが重ならない列だが、依存関係がある。依存は無視されるため詰まらない
      makeItem({ id: 'b', meta: { flow_x: 500, flow_y: 500 } }),
    ];
    const deps = [dep('a', 'b')];
    const placements = calculateHorizontalCompact(items, deps);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('b')!.flow_x).toBe(500);
  });

  it('処理前後で元の左右の並び順（どのノードがどのノードより左か）が変わらない', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 100, flow_y: 0 } }),
      makeItem({ id: 'c', meta: { flow_x: 200, flow_y: 0 } }),
    ];
    const placements = calculateHorizontalCompact(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_x).toBeLessThan(byId.get('b')!.flow_x);
    expect(byId.get('b')!.flow_x).toBeLessThan(byId.get('c')!.flow_x);
  });

  it('flow_yが変わらない', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 123 } }),
      makeItem({ id: 'b', meta: { flow_x: 500, flow_y: 456 } }),
    ];
    const placements = calculateHorizontalCompact(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_y).toBe(123);
    expect(byId.get('b')!.flow_y).toBe(456);
  });

  it('gapXオプションが反映される', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 500, flow_y: 0 } }),
    ];

    const narrow = calculateHorizontalCompact(items, [], undefined, { gapX: 10 });
    const narrowById = new Map(narrow.map((p) => [p.itemId, p]));
    const narrowGap = narrowById.get('b')!.flow_x - narrowById.get('a')!.flow_x;

    const wide = calculateHorizontalCompact(items, [], undefined, { gapX: 100 });
    const wideById = new Map(wide.map((p) => [p.itemId, p]));
    const wideGap = wideById.get('b')!.flow_x - wideById.get('a')!.flow_x;

    expect(wideGap).toBeGreaterThan(narrowGap);
  });

  it('複数ノードとYが重なる合流ケースで正しく右端を計算する', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }), // y: 0-60
      makeItem({ id: 'b', meta: { flow_x: 0, flow_y: 100 } }), // y: 100-160（aとはY非重複）
      makeItem({ id: 'c', meta: { flow_x: 1000, flow_y: 0 } }), // y: 0-200（a,b両方とY重複）
    ];
    const sizes = new Map([
      ['a', { width: 180, height: 60 }],
      ['b', { width: 260, height: 60 }], // bの方が幅広い
      ['c', { width: 180, height: 200 }],
    ]);
    const placements = calculateHorizontalCompact(items, [], sizes);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // 幅広い方(b, 右端=260)を基準にgapX(35)分空けた位置になる
    expect(byId.get('c')!.flow_x).toBe(byId.get('b')!.flow_x + 260 + DEFAULT_GAP_X);
  });
});
