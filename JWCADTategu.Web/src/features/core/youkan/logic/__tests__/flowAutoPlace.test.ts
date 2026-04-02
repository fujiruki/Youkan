import { describe, it, expect } from 'vitest';
import {
  sortItemsForChain,
  calculateAutoPlacement,
  findNearestEdge,
  calculateEdgeMidpoint,
} from '../flowAutoPlace';
import type { Item } from '../../types';

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

describe('sortItemsForChain', () => {
  it('納期の早い順にソートする', () => {
    const items = [
      makeItem({ id: 'c', due_date: '2026-03-01', createdAt: 100 }),
      makeItem({ id: 'a', due_date: '2026-01-01', createdAt: 200 }),
      makeItem({ id: 'b', due_date: '2026-02-01', createdAt: 300 }),
    ];
    const sorted = sortItemsForChain(items);
    expect(sorted.map((i) => i.id)).toEqual(['a', 'b', 'c']);
  });

  it('マイ期限と納期の早い方で比較する', () => {
    const items = [
      makeItem({ id: 'a', due_date: '2026-03-01', prep_date: 1735689600 }), // prep = 2025-01-01
      makeItem({ id: 'b', due_date: '2026-01-15', createdAt: 100 }),
    ];
    const sorted = sortItemsForChain(items);
    // aのprep_dateが2025-01なのでaが先
    expect(sorted[0].id).toBe('a');
  });

  it('期限未設定は末尾に配置、作成順でソート', () => {
    const items = [
      makeItem({ id: 'b', createdAt: 200 }),
      makeItem({ id: 'a', due_date: '2026-01-01', createdAt: 100 }),
      makeItem({ id: 'c', createdAt: 100 }),
    ];
    const sorted = sortItemsForChain(items);
    expect(sorted[0].id).toBe('a');
    // 期限なし同士はcreatedAt昇順
    expect(sorted[1].id).toBe('c');
    expect(sorted[2].id).toBe('b');
  });
});

describe('calculateAutoPlacement', () => {
  it('プロジェクトごとにX軸をオフセットして縦に配置する', () => {
    const items = [
      makeItem({ id: 'a1', projectId: 'p1', due_date: '2026-01-01' }),
      makeItem({ id: 'a2', projectId: 'p1', due_date: '2026-02-01' }),
      makeItem({ id: 'b1', projectId: 'p2', due_date: '2026-01-15' }),
    ];
    const result = calculateAutoPlacement(items);

    // p1が最初のプロジェクト → x=0, p2 → x=300
    const a1 = result.find((r) => r.itemId === 'a1')!;
    const a2 = result.find((r) => r.itemId === 'a2')!;
    const b1 = result.find((r) => r.itemId === 'b1')!;

    expect(a1.flow_x).toBe(0);
    expect(a1.flow_y).toBe(0);
    expect(a2.flow_x).toBe(0);
    expect(a2.flow_y).toBe(150);

    expect(b1.flow_x).toBe(300);
    expect(b1.flow_y).toBe(0);
  });

  it('プロジェクト未所属のアイテムは最右列にフラットに配置される', () => {
    const items = [
      makeItem({ id: 'a', projectId: 'p1', due_date: '2026-01-01' }),
      makeItem({ id: 'x', projectId: null, createdAt: 100 }),
      makeItem({ id: 'y', projectId: undefined, createdAt: 200 }),
    ];
    const result = calculateAutoPlacement(items);

    const x = result.find((r) => r.itemId === 'x')!;
    const y = result.find((r) => r.itemId === 'y')!;

    // p1はx=0、未所属は最右列（p1の次のオフセット = 300）
    expect(x.flow_x).toBe(300);
    expect(x.flow_y).toBe(0);
    expect(y.flow_x).toBe(300);
    expect(y.flow_y).toBe(150);
  });

  it('チェーン情報を生成する（同一プロジェクト内で順番にA→B→C）', () => {
    const items = [
      makeItem({ id: 'a', projectId: 'p1', due_date: '2026-01-01' }),
      makeItem({ id: 'b', projectId: 'p1', due_date: '2026-02-01' }),
      makeItem({ id: 'c', projectId: 'p1', due_date: '2026-03-01' }),
    ];
    const result = calculateAutoPlacement(items);
    const chains = result.filter((r) => r.chainFrom != null);

    // a→b, b→c のチェーン
    expect(chains).toHaveLength(2);
    expect(chains[0]).toEqual(expect.objectContaining({ itemId: 'b', chainFrom: 'a' }));
    expect(chains[1]).toEqual(expect.objectContaining({ itemId: 'c', chainFrom: 'b' }));
  });

  it('プロジェクト未所属アイテムはチェーンを生成しない', () => {
    const items = [
      makeItem({ id: 'x', projectId: null, createdAt: 100 }),
      makeItem({ id: 'y', projectId: null, createdAt: 200 }),
    ];
    const result = calculateAutoPlacement(items);
    const chains = result.filter((r) => r.chainFrom != null);
    expect(chains).toHaveLength(0);
  });

  it('既存依存関係がある場合、チェーン順で配置しノンチェーンは下に追加', () => {
    const deps = [
      { id: 'd1', sourceItemId: 'b', targetItemId: 'c', createdAt: 0 },
    ];
    const items = [
      makeItem({ id: 'a', projectId: 'p1', createdAt: 100 }),
      makeItem({ id: 'b', projectId: 'p1', createdAt: 200 }),
      makeItem({ id: 'c', projectId: 'p1', createdAt: 300 }),
    ];
    const result = calculateAutoPlacement(items, deps);

    // b→c のチェーンが先、aはチェーン外なのでその下
    const bResult = result.find((r) => r.itemId === 'b')!;
    const cResult = result.find((r) => r.itemId === 'c')!;
    const aResult = result.find((r) => r.itemId === 'a')!;

    expect(bResult.flow_x).toBe(0);
    expect(bResult.flow_y).toBe(0);
    expect(cResult.flow_x).toBe(0);
    expect(cResult.flow_y).toBe(150);
    // aはチェーン外、b→cの下に配置
    expect(aResult.flow_x).toBe(0);
    expect(aResult.flow_y).toBe(300);
    // 既存チェーンのchainFromは生成しない（既にある）
    expect(cResult.chainFrom).toBeUndefined();
    expect(aResult.chainFrom).toBeUndefined();
  });

  it('複数チェーンがあるプロジェクトでは最長チェーンから順に配置', () => {
    const deps = [
      { id: 'd1', sourceItemId: 'a', targetItemId: 'b', createdAt: 0 },
      { id: 'd2', sourceItemId: 'b', targetItemId: 'c', createdAt: 0 },
      { id: 'd3', sourceItemId: 'x', targetItemId: 'y', createdAt: 0 },
    ];
    const items = [
      makeItem({ id: 'a', projectId: 'p1', createdAt: 100 }),
      makeItem({ id: 'b', projectId: 'p1', createdAt: 200 }),
      makeItem({ id: 'c', projectId: 'p1', createdAt: 300 }),
      makeItem({ id: 'x', projectId: 'p1', createdAt: 400 }),
      makeItem({ id: 'y', projectId: 'p1', createdAt: 500 }),
      makeItem({ id: 'z', projectId: 'p1', createdAt: 600 }),
    ];
    const result = calculateAutoPlacement(items, deps);

    // a→b→c（長さ3）が先、x→y（長さ2）が続く、zはチェーン外
    const aR = result.find((r) => r.itemId === 'a')!;
    const bR = result.find((r) => r.itemId === 'b')!;
    const cR = result.find((r) => r.itemId === 'c')!;
    const xR = result.find((r) => r.itemId === 'x')!;
    const yR = result.find((r) => r.itemId === 'y')!;
    const zR = result.find((r) => r.itemId === 'z')!;

    // 全て同一プロジェクトなのでx=0
    expect(aR.flow_x).toBe(0);
    expect(aR.flow_y).toBe(0);
    expect(bR.flow_y).toBe(150);
    expect(cR.flow_y).toBe(300);
    expect(xR.flow_y).toBe(450);
    expect(yR.flow_y).toBe(600);
    expect(zR.flow_y).toBe(750);
  });

  it('クロスプロジェクトの依存関係はプロジェクト集約に影響しない', () => {
    const deps = [
      { id: 'd1', sourceItemId: 'a', targetItemId: 'b', createdAt: 0 },
    ];
    const items = [
      makeItem({ id: 'a', projectId: 'p1', createdAt: 100 }),
      makeItem({ id: 'b', projectId: 'p2', createdAt: 200 }),
    ];
    const result = calculateAutoPlacement(items, deps);

    // aはp1列、bはp2列に配置（プロジェクト別は維持）
    const aR = result.find((r) => r.itemId === 'a')!;
    const bR = result.find((r) => r.itemId === 'b')!;
    expect(aR.flow_x).not.toBe(bR.flow_x);
  });
});

describe('findNearestEdge', () => {
  const edges = [
    { id: 'e1', source: 'a', target: 'b' },
    { id: 'e2', source: 'b', target: 'c' },
  ];
  const nodePositions = new Map([
    ['a', { x: 0, y: 0 }],
    ['b', { x: 0, y: 150 }],
    ['c', { x: 0, y: 300 }],
  ]);

  it('閾値以内の最近傍エッジを返す', () => {
    // e1の中間点は (0, 75)
    const result = findNearestEdge({ x: 10, y: 75 }, edges, nodePositions, 100);
    expect(result).not.toBeNull();
    expect(result!.edge.id).toBe('e1');
  });

  it('閾値外の場合はnullを返す', () => {
    const result = findNearestEdge({ x: 500, y: 500 }, edges, nodePositions, 100);
    expect(result).toBeNull();
  });

  it('最も近いエッジを選択する', () => {
    // (0, 220) は e2の中間点(0, 225)に近い
    const result = findNearestEdge({ x: 0, y: 220 }, edges, nodePositions, 100);
    expect(result).not.toBeNull();
    expect(result!.edge.id).toBe('e2');
  });
});

describe('calculateEdgeMidpoint', () => {
  it('2点の中間座標を計算する', () => {
    const source = { x: 100, y: 200 };
    const target = { x: 300, y: 400 };
    const mid = calculateEdgeMidpoint(source, target);
    expect(mid).toEqual({ x: 200, y: 300 });
  });
});
