import type { Item, Dependency } from '../types';
import type { PlacementResult } from './flowAutoPlace';
import { GAP_Y } from './flowAutoArrange';
import { NODE_WIDTH } from './flowDateGrouping';

const NODE_HEIGHT = 60;

type SizeMap = Map<string, { width: number; height: number }>;

const sizeOf = (id: string, sizes?: SizeMap): { width: number; height: number } =>
  sizes?.get(id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };

// 対象アイテム内で閉じた依存グラフの先行ノード表を作る（外部へ伸びる依存は無視）
const buildPredecessors = (items: Item[], deps: Dependency[]): Map<string, string[]> => {
  const ids = new Set(items.map((i) => i.id));
  const predecessors = new Map<string, string[]>();
  for (const id of ids) predecessors.set(id, []);
  for (const d of deps) {
    if (!ids.has(d.sourceItemId) || !ids.has(d.targetItemId)) continue;
    predecessors.get(d.targetItemId)!.push(d.sourceItemId);
  }
  return predecessors;
};

// R-118「詰める」機能: 並び順・横位置(flow_x)は変えず、上下方向の隙間だけを最小化する。
// 現在のflow_y昇順に処理し、各ノードを「Xが重なる既配置ノードの下端」「依存元ノードの下端」の
// 最大値 + gapY まで引き上げる。制約が無いノード（一番上のノード群）は現在位置のまま動かさない
export const calculateVerticalCompact = (
  items: Item[],
  deps: Dependency[],
  sizes?: SizeMap,
  options?: { gapY?: number }
): PlacementResult[] => {
  const gapY = options?.gapY ?? GAP_Y;
  if (items.length === 0) return [];

  const xOf = (item: Item): number => (item.meta?.flow_x as number) ?? 0;
  const yOf = (item: Item): number => (item.meta?.flow_y as number) ?? 0;

  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => yOf(a.item) - yOf(b.item) || a.index - b.index)
    .map((entry) => entry.item);

  const orderIndex = new Map(order.map((item, idx) => [item.id, idx]));
  const predecessors = buildPredecessors(items, deps);
  const byId = new Map(items.map((item) => [item.id, item]));

  const overlapsX = (a: Item, b: Item): boolean => {
    const aSize = sizeOf(a.id, sizes);
    const bSize = sizeOf(b.id, sizes);
    const aX = xOf(a);
    const bX = xOf(b);
    return aX < bX + bSize.width && bX < aX + aSize.width;
  };

  const resolved = new Map<string, { y: number; bottom: number }>();
  const computing = new Set<string>();

  const resolve = (id: string): { y: number; bottom: number } => {
    const cached = resolved.get(id);
    if (cached) return cached;
    const item = byId.get(id)!;
    if (computing.has(id)) {
      // 循環依存ガード: 制約に加えず現在位置を仮に返す
      const y = yOf(item);
      return { y, bottom: y + sizeOf(id, sizes).height };
    }
    computing.add(id);

    let lower = -Infinity;
    const idx = orderIndex.get(id)!;
    for (let j = 0; j < idx; j++) {
      const other = order[j];
      if (overlapsX(item, other)) {
        lower = Math.max(lower, resolve(other.id).bottom + gapY);
      }
    }
    for (const predId of predecessors.get(id) ?? []) {
      lower = Math.max(lower, resolve(predId).bottom + gapY);
    }

    computing.delete(id);

    const y = lower === -Infinity ? yOf(item) : lower;
    const result = { y, bottom: y + sizeOf(id, sizes).height };
    resolved.set(id, result);
    return result;
  };

  return items.map((item) => ({
    itemId: item.id,
    flow_x: xOf(item),
    flow_y: resolve(item.id).y,
  }));
};
