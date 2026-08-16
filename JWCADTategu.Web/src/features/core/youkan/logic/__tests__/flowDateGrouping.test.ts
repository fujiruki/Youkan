import { describe, it, expect } from 'vitest';
import {
  groupItemsByDeadline,
  calculateCriticalPathMinutes,
  calculateDateGroupLayout,
  formatHours,
  BAND_HEIGHT,
  COL_WIDTH,
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

describe('calculateDateGroupLayout', () => {
  const items = [
    makeItem({ id: 'a', due_date: '2026-08-16', estimatedMinutes: 60, meta: { flow_x: 300, flow_y: 0 } }),
    makeItem({ id: 'b', due_date: '2026-08-16', estimatedMinutes: 120, meta: { flow_x: 100, flow_y: 0 } }),
    makeItem({ id: 'c', due_date: '2026-08-17', estimatedMinutes: 60, meta: { flow_x: 0, flow_y: 0 } }),
  ];

  it('日付区間ごとにy座標（縦積み）を割り当てる', () => {
    const { placements } = calculateDateGroupLayout(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // 同じ帯（8/16）のa・bは同じy座標
    expect(byId.get('a')!.flow_y).toBe(byId.get('b')!.flow_y);
    // 次の帯（8/17）はBAND_HEIGHT分だけ下にずれる
    expect(byId.get('c')!.flow_y - byId.get('a')!.flow_y).toBe(BAND_HEIGHT);
  });

  it('区間内は依存関係の順に左から右へ並べる', () => {
    const { placements } = calculateDateGroupLayout(items, [dep('a', 'b')]);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_x).toBeLessThan(byId.get('b')!.flow_x);
    expect(byId.get('b')!.flow_x - byId.get('a')!.flow_x).toBe(COL_WIDTH);
  });

  it('依存関係がない区間内は既存のx座標の並び順を保つ', () => {
    const { placements } = calculateDateGroupLayout(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // b(既存x=100)がa(既存x=300)より左のまま
    expect(byId.get('b')!.flow_x).toBeLessThan(byId.get('a')!.flow_x);
  });

  it('区間ごとの合計時間とクリティカルパス時間を返す', () => {
    const { bands } = calculateDateGroupLayout(items, [dep('a', 'b')]);
    expect(bands).toHaveLength(2);
    expect(bands[0].dateKey).toBe('2026-08-16');
    expect(bands[0].totalMinutes).toBe(180);
    expect(bands[0].criticalMinutes).toBe(180);
    expect(bands[1].totalMinutes).toBe(60);
  });

  it('区間の帯は同じ左端・幅で、y座標が区間順に積み上がる', () => {
    const { bands } = calculateDateGroupLayout(items, []);
    expect(bands[0].x).toBe(bands[1].x);
    expect(bands[0].width).toBe(bands[1].width);
    expect(bands[1].y - bands[0].y).toBe(BAND_HEIGHT);
    expect(bands[0].height).toBe(BAND_HEIGHT);
  });

  it('区間のラベルは曜日つき「M/d(曜)まで」形式', () => {
    const { bands } = calculateDateGroupLayout(items, []);
    // 2026-08-16は日曜日
    expect(bands[0].label).toBe('8/16(日)まで');
  });

  it('未定区間のラベルは「日付未定」', () => {
    const { bands } = calculateDateGroupLayout([makeItem({ id: 'x' })], []);
    expect(bands[0].label).toBe('日付未定');
  });

  it('アイテムが空なら空の結果を返す', () => {
    const { placements, bands } = calculateDateGroupLayout([], []);
    expect(placements).toEqual([]);
    expect(bands).toEqual([]);
  });
});
