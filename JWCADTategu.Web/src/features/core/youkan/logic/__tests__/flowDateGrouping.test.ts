import { describe, it, expect } from 'vitest';
import {
  groupItemsByDeadline,
  calculateCriticalPathMinutes,
  calculateDateBands,
  calculateDateGroupLayout,
  formatHours,
  ROW_HEIGHT,
  NODE_WIDTH,
  UNDATED_KEY,
} from '../flowDateGrouping';
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

describe('groupItemsByDeadline', () => {
  it('有効締切の日付ごとにグルーピングし、日付の昇順で返す', () => {
    const items = [
      makeItem({ id: 'c', due_date: '2026-08-18' }),
      makeItem({ id: 'a', due_date: '2026-08-16' }),
      makeItem({ id: 'b', due_date: '2026-08-17' }),
      makeItem({ id: 'a2', due_date: '2026-08-16' }),
    ];
    const groups = groupItemsByDeadline(items);
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-08-16', '2026-08-17', '2026-08-18']);
    expect(groups[0].items.map((i) => i.id)).toEqual(['a', 'a2']);
  });

  it('納期とマイ期限の早い方を有効締切として使う', () => {
    const prep = new Date('2026-08-16T00:00:00').getTime();
    const items = [makeItem({ id: 'a', due_date: '2026-08-20', prep_date: prep })];
    const groups = groupItemsByDeadline(items);
    expect(groups[0].dateKey).toBe('2026-08-16');
  });

  it('有効締切が未設定のアイテムは「未定」区間として末尾に置く', () => {
    const items = [
      makeItem({ id: 'x' }),
      makeItem({ id: 'a', due_date: '2026-08-16' }),
    ];
    const groups = groupItemsByDeadline(items);
    expect(groups.map((g) => g.dateKey)).toEqual(['2026-08-16', UNDATED_KEY]);
    expect(groups[1].items.map((i) => i.id)).toEqual(['x']);
  });
});

describe('calculateCriticalPathMinutes', () => {
  it('直列の依存は目安時間を合計する', () => {
    const items = [
      makeItem({ id: 'a', estimatedMinutes: 60 }),
      makeItem({ id: 'b', estimatedMinutes: 120 }),
      makeItem({ id: 'c', estimatedMinutes: 60 }),
    ];
    const deps = [dep('a', 'b'), dep('b', 'c')];
    expect(calculateCriticalPathMinutes(items, deps)).toBe(240);
  });

  it('並列に分岐した経路は遅い方（最大値）を採用する', () => {
    // a → b(60) → d, a → c(150) → d
    const items = [
      makeItem({ id: 'a', estimatedMinutes: 60 }),
      makeItem({ id: 'b', estimatedMinutes: 60 }),
      makeItem({ id: 'c', estimatedMinutes: 150 }),
      makeItem({ id: 'd', estimatedMinutes: 60 }),
    ];
    const deps = [dep('a', 'b'), dep('a', 'c'), dep('b', 'd'), dep('c', 'd')];
    expect(calculateCriticalPathMinutes(items, deps)).toBe(270);
  });

  it('依存が全くない場合は最大の目安時間になる', () => {
    const items = [
      makeItem({ id: 'a', estimatedMinutes: 60 }),
      makeItem({ id: 'b', estimatedMinutes: 90 }),
    ];
    expect(calculateCriticalPathMinutes(items, [])).toBe(90);
  });

  it('区間外のアイテムを含む依存関係は計算に含めない', () => {
    const items = [makeItem({ id: 'b', estimatedMinutes: 60 })];
    const deps = [dep('outside', 'b')];
    expect(calculateCriticalPathMinutes(items, deps)).toBe(60);
  });

  it('目安時間未設定は0分として扱う', () => {
    const items = [makeItem({ id: 'a' }), makeItem({ id: 'b', estimatedMinutes: 30 })];
    expect(calculateCriticalPathMinutes(items, [dep('a', 'b')])).toBe(30);
  });

  it('循環依存があっても無限ループせずに値を返す', () => {
    const items = [
      makeItem({ id: 'a', estimatedMinutes: 60 }),
      makeItem({ id: 'b', estimatedMinutes: 60 }),
    ];
    const deps = [dep('a', 'b'), dep('b', 'a')];
    expect(calculateCriticalPathMinutes(items, deps)).toBeGreaterThan(0);
  });

  it('アイテムが空なら0', () => {
    expect(calculateCriticalPathMinutes([], [])).toBe(0);
  });
});

describe('formatHours', () => {
  it('分を時間表記に変換する', () => {
    expect(formatHours(240)).toBe('4h');
    expect(formatHours(270)).toBe('4.5h');
    expect(formatHours(0)).toBe('0h');
    expect(formatHours(50)).toBe('0.8h');
  });
});

// R-113: 帯（表示専用）はノードの現在位置の外接矩形にライブ追従する
describe('calculateDateBands', () => {
  const items = [
    makeItem({ id: 'a', due_date: '2026-08-16', estimatedMinutes: 60, meta: { flow_x: 300, flow_y: 0 } }),
    makeItem({ id: 'b', due_date: '2026-08-16', estimatedMinutes: 120, meta: { flow_x: 100, flow_y: 50 } }),
    makeItem({ id: 'c', due_date: '2026-08-17', estimatedMinutes: 60, meta: { flow_x: 0, flow_y: 300 } }),
  ];

  it('日付グループごとにノードの現在位置の外接矩形（既定サイズ）を返す', () => {
    const bands = calculateDateBands(items, []);
    expect(bands).toHaveLength(2);
    const first = bands[0];
    // 8/16グループ: minX=100(b), maxRight=300+NODE_WIDTH(a), minY=0(a)-60, maxBottom=50+60(b)+20
    expect(first.x).toBe(100 - 140);
    expect(first.width).toBe(300 + NODE_WIDTH - (100 - 140));
    expect(first.y).toBe(0 - 60);
    expect(first.height).toBe(50 + 60 + 20 - (0 - 60));
  });

  it('sizesを渡すと実測サイズが外接矩形に反映される', () => {
    const withoutSizes = calculateDateBands(items, []);
    const sizes = new Map([['a', { width: 400, height: 100 }]]);
    const withSizes = calculateDateBands(items, [], sizes);
    expect(withSizes[0].width).toBeGreaterThan(withoutSizes[0].width);
  });

  it('ノードを動かすと帯の位置・大きさが追従する（表示のみ、順序無関係の外接矩形）', () => {
    const before = calculateDateBands(items, [])[0];
    const moved = items.map((item) =>
      item.id === 'a' ? { ...item, meta: { flow_x: -1000, flow_y: -1000 } } : item
    );
    const after = calculateDateBands(moved, [])[0];
    expect(after.x).toBeLessThan(before.x);
    expect(after.y).toBeLessThan(before.y);
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.height).toBeGreaterThan(before.height);
  });

  it('合計時間・最短時間はcalculateCriticalPathMinutesと一致する', () => {
    const bands = calculateDateBands(items, [dep('a', 'b')]);
    expect(bands[0].totalMinutes).toBe(180);
    expect(bands[0].criticalMinutes).toBe(180);
    expect(bands[1].totalMinutes).toBe(60);
  });

  it('区間のラベルは曜日つき「M/d(曜)まで」形式', () => {
    const bands = calculateDateBands(items, []);
    // 2026-08-16は日曜日
    expect(bands[0].label).toBe('8/16(日)まで');
  });

  it('未定グループも外接矩形とラベル「日付未定」を返す', () => {
    const bands = calculateDateBands([makeItem({ id: 'x', meta: { flow_x: 0, flow_y: 0 } })], []);
    expect(bands[0].dateKey).toBe(UNDATED_KEY);
    expect(bands[0].label).toBe('日付未定');
  });

  it('アイテムが空なら空配列を返す', () => {
    expect(calculateDateBands([], [])).toEqual([]);
  });
});

// R-113:「日付整列」ボタン用。flow_xは変えず縦方向だけ日付順の区間へ移動する
describe('calculateDateGroupLayout', () => {
  const items = [
    makeItem({ id: 'a', due_date: '2026-08-16', estimatedMinutes: 60, meta: { flow_x: 300, flow_y: 0 } }),
    makeItem({ id: 'b', due_date: '2026-08-16', estimatedMinutes: 120, meta: { flow_x: 100, flow_y: 0 } }),
    makeItem({ id: 'c', due_date: '2026-08-17', estimatedMinutes: 60, meta: { flow_x: 0, flow_y: 0 } }),
  ];

  it('flow_xは元の値のまま変更しない', () => {
    const placements = calculateDateGroupLayout(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_x).toBe(300);
    expect(byId.get('b')!.flow_x).toBe(100);
    expect(byId.get('c')!.flow_x).toBe(0);
  });

  it('Xが重ならないノード同士は同じ帯なら同じ行（同じy）に詰める', () => {
    const placements = calculateDateGroupLayout(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // a(x=300→[300,480]) と b(x=100→[100,280])はNODE_WIDTH分でも重ならないので同じ行
    expect(byId.get('a')!.flow_y).toBe(byId.get('b')!.flow_y);
  });

  it('Xが重なるノードは別の行に分けられる（依存がなくても）', () => {
    const overlapping = [
      makeItem({ id: 'x1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x2', due_date: '2026-08-16', meta: { flow_x: 50, flow_y: 100 } }),
    ];
    const placements = calculateDateGroupLayout(overlapping, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('x1')!.flow_x).toBe(0);
    expect(byId.get('x2')!.flow_x).toBe(50);
    expect(byId.get('x1')!.flow_y).not.toBe(byId.get('x2')!.flow_y);
  });

  it('依存先は依存元より下の行に置かれる（flow_xは維持したまま縦移動のみ）', () => {
    const placements = calculateDateGroupLayout(items, [dep('a', 'b')]);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_x).toBe(300);
    expect(byId.get('b')!.flow_x).toBe(100);
    expect(byId.get('b')!.flow_y).toBeGreaterThan(byId.get('a')!.flow_y);
  });

  it('行間隔はROW_HEIGHT刻み', () => {
    const overlapping = [
      makeItem({ id: 'x1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x2', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const placements = calculateDateGroupLayout(overlapping, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(Math.abs(byId.get('x2')!.flow_y - byId.get('x1')!.flow_y)).toBe(ROW_HEIGHT);
  });

  it('y原点は全アイテムの最小flow_yを基準に決まる（丸ごとずれても相対関係は同じ）', () => {
    const original = calculateDateGroupLayout(items, []);
    const origById = new Map(original.map((p) => [p.itemId, p]));
    const shifted = items.map((item) => ({
      ...item,
      meta: { ...item.meta, flow_y: (item.meta!.flow_y as number) + 1000 },
    }));
    const placements = calculateDateGroupLayout(shifted, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_y).toBe(origById.get('a')!.flow_y + 1000);
    expect(byId.get('c')!.flow_y).toBe(origById.get('c')!.flow_y + 1000);
  });

  it('行数が増えると次の帯へのy移動幅（帯の高さ）が大きくなる', () => {
    const oneRow = [
      makeItem({ id: 'a', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'z', due_date: '2026-08-17', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const oneRowPlacements = calculateDateGroupLayout(oneRow, []);
    const oneRowById = new Map(oneRowPlacements.map((p) => [p.itemId, p]));
    const oneRowGap = oneRowById.get('z')!.flow_y - oneRowById.get('a')!.flow_y;

    const threeRows = [
      makeItem({ id: 'x1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x2', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x3', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'z', due_date: '2026-08-17', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const threeRowsPlacements = calculateDateGroupLayout(threeRows, []);
    const threeRowsById = new Map(threeRowsPlacements.map((p) => [p.itemId, p]));
    const threeRowsGap = threeRowsById.get('z')!.flow_y - threeRowsById.get('x1')!.flow_y;

    expect(threeRowsGap).toBeGreaterThan(oneRowGap);
  });

  it('アイテムが空なら空配列を返す', () => {
    expect(calculateDateGroupLayout([], [])).toEqual([]);
  });
});
