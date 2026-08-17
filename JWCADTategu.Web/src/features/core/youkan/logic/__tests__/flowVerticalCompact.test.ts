import { describe, it, expect } from 'vitest';
import { calculateVerticalCompact } from '../flowVerticalCompact';
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
const DEFAULT_GAP_Y = 35;

describe('calculateVerticalCompact', () => {
  it('依存元ノードの下端+gapY以上の位置に来る', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 300, flow_y: 500 } }), // aとXが重ならない列
    ];
    const deps = [dep('a', 'b')];
    const placements = calculateVerticalCompact(items, deps);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('b')!.flow_y).toBeGreaterThanOrEqual(
      byId.get('a')!.flow_y + DEFAULT_HEIGHT + DEFAULT_GAP_Y
    );
  });

  it('Xが重ならないノード同士は独立して詰まる（上に大きな隙間があれば個別に上へ移動できる）', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 0, flow_y: 500 } }),
      makeItem({ id: 'c', meta: { flow_x: 300, flow_y: 0 } }),
      makeItem({ id: 'd', meta: { flow_x: 300, flow_y: 800 } }),
    ];
    const deps = [dep('a', 'b'), dep('c', 'd')];
    const placements = calculateVerticalCompact(items, deps);
    const byId = new Map(placements.map((p) => [p.itemId, p]));

    // 両方の列が、それぞれの元の依存元の直下まで個別に詰まる（大きな隙間が縮まる）
    expect(byId.get('b')!.flow_y).toBeLessThan(500);
    expect(byId.get('d')!.flow_y).toBeLessThan(800);
    // 片方の列の結果がもう片方に影響しない
    expect(byId.get('b')!.flow_y).toBe(byId.get('a')!.flow_y + DEFAULT_HEIGHT + DEFAULT_GAP_Y);
    expect(byId.get('d')!.flow_y).toBe(byId.get('c')!.flow_y + DEFAULT_HEIGHT + DEFAULT_GAP_Y);
  });

  it('Xが重なるノード同士はgapY以上の間隔を保つ', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      // aと同じX区間で、詰める前はaと重なるほど近い（依存関係なし）
      makeItem({ id: 'b', meta: { flow_x: 0, flow_y: 40 } }),
    ];
    const placements = calculateVerticalCompact(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('b')!.flow_y - byId.get('a')!.flow_y).toBeGreaterThanOrEqual(
      DEFAULT_HEIGHT + DEFAULT_GAP_Y
    );
  });

  it('処理前後で元の上下の並び順（どのノードがどのノードより上か）が変わらない', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 0, flow_y: 100 } }),
      makeItem({ id: 'c', meta: { flow_x: 0, flow_y: 200 } }),
    ];
    const placements = calculateVerticalCompact(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_y).toBeLessThan(byId.get('b')!.flow_y);
    expect(byId.get('b')!.flow_y).toBeLessThan(byId.get('c')!.flow_y);
  });

  it('flow_xが変わらない', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 123, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 456, flow_y: 500 } }),
    ];
    const placements = calculateVerticalCompact(items, [dep('a', 'b')]);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_x).toBe(123);
    expect(byId.get('b')!.flow_x).toBe(456);
  });

  it('gapYオプションが反映される', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 0, flow_y: 500 } }),
    ];
    const deps = [dep('a', 'b')];

    const narrow = calculateVerticalCompact(items, deps, undefined, { gapY: 10 });
    const narrowById = new Map(narrow.map((p) => [p.itemId, p]));
    const narrowGap = narrowById.get('b')!.flow_y - narrowById.get('a')!.flow_y;

    const wide = calculateVerticalCompact(items, deps, undefined, { gapY: 100 });
    const wideById = new Map(wide.map((p) => [p.itemId, p]));
    const wideGap = wideById.get('b')!.flow_y - wideById.get('a')!.flow_y;

    expect(wideGap).toBeGreaterThan(narrowGap);
  });

  it('複数ノードが1つのノードに依存する合流ケースで正しく下端を計算する', () => {
    const items = [
      makeItem({ id: 'a', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', meta: { flow_x: 300, flow_y: 0 } }),
      makeItem({ id: 'c', meta: { flow_x: 600, flow_y: 10 } }), // a, bどちらともXが重ならない
    ];
    const sizes = new Map([
      ['a', { width: DEFAULT_WIDTH, height: 60 }],
      ['b', { width: DEFAULT_WIDTH, height: 100 }], // bの方が高い
    ]);
    const deps = [dep('a', 'c'), dep('b', 'c')];
    const placements = calculateVerticalCompact(items, deps, sizes);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // 高い方(b, 下端=100)を基準にgapY(35)分空けた位置になる
    expect(byId.get('c')!.flow_y).toBe(byId.get('b')!.flow_y + 100 + DEFAULT_GAP_Y);
  });
});
