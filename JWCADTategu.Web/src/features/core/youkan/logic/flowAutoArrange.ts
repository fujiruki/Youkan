import type { Item, Dependency } from '../types';
import type { PlacementResult } from './flowAutoPlace';
import { computeDepthWithin } from './flowDateGrouping';
import { NODE_WIDTH } from '../components/Flow/flowGrouping';

const NODE_HEIGHT = 60;
const GAP_X = 40;
// R-114: 既定の縦間隔（R-112時点の60pxの約60%）。スライダーで上書き可能
export const GAP_Y = 35;
const PROJECT_GAP = 200;
const BARYCENTER_SWEEPS = 4;

type SizeMap = Map<string, { width: number; height: number }>;

const sizeOf = (id: string, sizes?: SizeMap): { width: number; height: number } =>
  sizes?.get(id) ?? { width: NODE_WIDTH, height: NODE_HEIGHT };

// 対象アイテム内で閉じた隣接表（predecessors/successors）を作る（外部へ伸びる依存は無視）
const buildAdjacency = (
  items: Item[],
  deps: Dependency[]
): { predecessors: Map<string, string[]>; successors: Map<string, string[]> } => {
  const ids = new Set(items.map((i) => i.id));
  const predecessors = new Map<string, string[]>();
  const successors = new Map<string, string[]>();
  for (const id of ids) {
    predecessors.set(id, []);
    successors.set(id, []);
  }
  for (const d of deps) {
    if (!ids.has(d.sourceItemId) || !ids.has(d.targetItemId)) continue;
    successors.get(d.sourceItemId)!.push(d.targetItemId);
    predecessors.get(d.targetItemId)!.push(d.sourceItemId);
  }
  return { predecessors, successors };
};

// 1グループ（プロジェクト単位、または未所属）を簡易Sugiyamaでレイアウトする
const layoutGroup = (
  groupItems: Item[],
  deps: Dependency[],
  sizes: SizeMap | undefined,
  gapY: number
): { placements: PlacementResult[]; width: number } => {
  if (groupItems.length === 0) return { placements: [], width: 0 };

  const depths = computeDepthWithin(groupItems, deps);
  const maxRank = Math.max(...Array.from(depths.values()));

  // 層ごとの初期順（元のflow_x昇順で元の左右関係を尊重）
  const rankOrder = new Map<number, string[]>();
  for (const item of groupItems) {
    const rank = depths.get(item.id) ?? 0;
    const arr = rankOrder.get(rank) ?? [];
    arr.push(item.id);
    rankOrder.set(rank, arr);
  }
  for (const [rank, ids] of rankOrder) {
    const byId = new Map(groupItems.map((i) => [i.id, i]));
    const sorted = [...ids].sort(
      (a, b) => ((byId.get(a)!.meta?.flow_x as number) ?? 0) - ((byId.get(b)!.meta?.flow_x as number) ?? 0)
    );
    rankOrder.set(rank, sorted);
  }

  // 交差削減: 重心法（隣接層の接続先の平均順位）を下向き→上向きで数回掃引
  // ponytail: 重心寄せの座標微調整（実測サイズを加味した重み付け等）は未実装。見づらければ追加する
  const { predecessors, successors } = buildAdjacency(groupItems, deps);
  for (let sweep = 0; sweep < BARYCENTER_SWEEPS; sweep++) {
    const downward = sweep % 2 === 0;
    const ranks = Array.from(rankOrder.keys()).sort((a, b) => (downward ? a - b : b - a));
    for (const rank of ranks) {
      const positionOf = new Map<string, number>();
      for (const arr of rankOrder.values()) arr.forEach((id, i) => positionOf.set(id, i));

      const neighborsOf = downward ? predecessors : successors;
      const arr = rankOrder.get(rank)!;
      const withBary = arr.map((id, idx) => {
        const neighbors = neighborsOf.get(id) ?? [];
        const positions = neighbors
          .map((n) => positionOf.get(n))
          .filter((p): p is number => p !== undefined);
        const bary = positions.length > 0 ? positions.reduce((s, p) => s + p, 0) / positions.length : idx;
        return { id, bary, idx };
      });
      withBary.sort((a, b) => a.bary - b.bary || a.idx - b.idx);
      rankOrder.set(rank, withBary.map((w) => w.id));
    }
  }

  // 座標割当: 層内は左から実測幅+GAP_Xで詰め、層はプロジェクト内で中央揃え
  const rankLayout = new Map<number, { xs: Map<string, number>; width: number; height: number }>();
  let maxRankWidth = 0;
  for (const [rank, ids] of rankOrder) {
    let x = 0;
    let maxHeight = 0;
    const xs = new Map<string, number>();
    for (const id of ids) {
      const { width, height } = sizeOf(id, sizes);
      xs.set(id, x);
      x += width + GAP_X;
      maxHeight = Math.max(maxHeight, height);
    }
    const rankWidth = ids.length > 0 ? x - GAP_X : 0;
    rankLayout.set(rank, { xs, width: rankWidth, height: maxHeight });
    maxRankWidth = Math.max(maxRankWidth, rankWidth);
  }

  const placements: PlacementResult[] = [];
  let y = 0;
  for (let rank = 0; rank <= maxRank; rank++) {
    const layout = rankLayout.get(rank);
    if (!layout) continue;
    const offsetX = (maxRankWidth - layout.width) / 2;
    for (const [id, x] of layout.xs) {
      placements.push({ itemId: id, flow_x: offsetX + x, flow_y: y });
    }
    y += layout.height + gapY;
  }

  return { placements, width: maxRankWidth };
};

// フローチャート全体を「自動整理」する: プロジェクトごとに層分け→交差削減→座標割当し、プロジェクトを横並びにする
export const calculateAutoArrange = (
  items: Item[],
  deps: Dependency[],
  sizes?: SizeMap,
  options?: { gapY?: number }
): PlacementResult[] => {
  const gapY = options?.gapY ?? GAP_Y;
  const projectGroups = new Map<string, Item[]>();
  const unassigned: Item[] = [];
  for (const item of items) {
    if (item.projectId) {
      const arr = projectGroups.get(item.projectId);
      if (arr) arr.push(item);
      else projectGroups.set(item.projectId, [item]);
    } else {
      unassigned.push(item);
    }
  }

  const results: PlacementResult[] = [];
  let xOffset = 0;

  for (const [, group] of projectGroups) {
    const { placements, width } = layoutGroup(group, deps, sizes, gapY);
    for (const p of placements) results.push({ ...p, flow_x: p.flow_x + xOffset });
    if (width > 0) xOffset += width + PROJECT_GAP;
  }

  const { placements: unassignedPlacements } = layoutGroup(unassigned, deps, sizes, gapY);
  for (const p of unassignedPlacements) results.push({ ...p, flow_x: p.flow_x + xOffset });

  return results;
};
