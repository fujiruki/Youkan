import type { Item, Dependency } from '../types';
import type { PlacementResult } from './flowAutoPlace';
import { GAP_Y } from './flowAutoArrange';
import { NODE_WIDTH } from './flowDateGrouping';

const NODE_HEIGHT = 60;

type SizeMap = Map<string, { width: number; height: number }>;

const sizeOf = (id: string, sizes?: SizeMap): { width: number; height: number } =>
  sizes?.get(id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };

// R-120「詰める」機能の横方向版: 並び順・縦位置(flow_y)は変えず、左右方向の隙間だけを最小化する。
// 現在のflow_x昇順に処理し、各ノードを「Yが重なる既配置ノードの右端」+ gapX まで左へ寄せる。
// フローの依存関係は上→下の縦方向の意味しか持たないため、横方向の圧縮では考慮しない
export const calculateHorizontalCompact = (
  items: Item[],
  _deps: Dependency[],
  sizes?: SizeMap,
  options?: { gapX?: number }
): PlacementResult[] => {
  const gapX = options?.gapX ?? GAP_Y;
  if (items.length === 0) return [];

  const xOf = (item: Item): number => (item.meta?.flow_x as number) ?? 0;
  const yOf = (item: Item): number => (item.meta?.flow_y as number) ?? 0;

  const order = items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => xOf(a.item) - xOf(b.item) || a.index - b.index)
    .map((entry) => entry.item);

  const overlapsY = (a: Item, b: Item): boolean => {
    const aSize = sizeOf(a.id, sizes);
    const bSize = sizeOf(b.id, sizes);
    const aY = yOf(a);
    const bY = yOf(b);
    return aY < bY + bSize.height && bY < aY + aSize.height;
  };

  // 依存関係が無く先行ノードは常に自分より前(x昇順)で確定済みなため、再帰は不要
  const resolved = new Map<string, { x: number; right: number }>();
  for (let idx = 0; idx < order.length; idx++) {
    const item = order[idx];
    let lower = -Infinity;
    for (let j = 0; j < idx; j++) {
      const other = order[j];
      if (overlapsY(item, other)) {
        lower = Math.max(lower, resolved.get(other.id)!.right + gapX);
      }
    }
    const x = lower === -Infinity ? xOf(item) : lower;
    resolved.set(item.id, { x, right: x + sizeOf(item.id, sizes).width });
  }

  return items.map((item) => ({
    itemId: item.id,
    flow_x: resolved.get(item.id)!.x,
    flow_y: yOf(item),
  }));
};
