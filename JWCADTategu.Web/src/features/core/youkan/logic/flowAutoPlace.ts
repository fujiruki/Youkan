import type { Item, Dependency } from '../types';
import { parseISO, isValid, startOfDay } from 'date-fns';

// 納期/マイ期限の早い方を返す（sorting.tsと同等ロジック）
const getEffectiveDeadline = (item: Item): number | null => {
  let dueTime: number | null = null;
  if (item.due_date) {
    let d = parseISO(item.due_date);
    if (!isValid(d)) d = new Date(item.due_date);
    if (isValid(d)) dueTime = startOfDay(d).getTime();
  }

  let prepTime: number | null = null;
  if (item.prep_date) {
    const rawTime = item.prep_date < 100000000000 ? item.prep_date * 1000 : item.prep_date;
    prepTime = startOfDay(new Date(rawTime)).getTime();
  }

  if (dueTime !== null && prepTime !== null) return Math.min(dueTime, prepTime);
  return dueTime ?? prepTime;
};

// 自動配置用ソート: 期限の早い順（未設定は末尾、作成順）
export const sortItemsForChain = (items: Item[]): Item[] => {
  return [...items].sort((a, b) => {
    const aDeadline = getEffectiveDeadline(a);
    const bDeadline = getEffectiveDeadline(b);

    if (aDeadline === null && bDeadline !== null) return 1;
    if (aDeadline !== null && bDeadline === null) return -1;

    if (aDeadline === null && bDeadline === null) {
      return (a.createdAt || 0) - (b.createdAt || 0);
    }

    return (aDeadline as number) - (bDeadline as number);
  });
};

export interface PlacementResult {
  itemId: string;
  flow_x: number;
  flow_y: number;
  chainFrom?: string; // 前のアイテムID（依存関係作成用）
}

const X_INTERVAL = 250;
const Y_INTERVAL = 150;
// プロジェクト間オフセット（DAG全体の幅を確保するための余裕）
const PROJECT_X_OFFSET = 1000;

// Longest Path Layeringアルゴリズムでレイヤーを計算
const computeLayers = (
  itemIds: Set<string>,
  deps: Dependency[]
): Map<string, number> => {
  const internalDeps = deps.filter(
    (d) => itemIds.has(d.sourceItemId) && itemIds.has(d.targetItemId)
  );

  // 各ノードの先行ノード（predecessors）を収集
  const predecessors = new Map<string, string[]>();
  for (const id of itemIds) {
    predecessors.set(id, []);
  }
  for (const dep of internalDeps) {
    const preds = predecessors.get(dep.targetItemId) || [];
    preds.push(dep.sourceItemId);
    predecessors.set(dep.targetItemId, preds);
  }

  // メモ化再帰でlayer計算
  const layers = new Map<string, number>();
  const computing = new Set<string>();

  const getLayer = (id: string): number => {
    if (layers.has(id)) return layers.get(id)!;
    if (computing.has(id)) {
      layers.set(id, 0);
      return 0; // 循環依存ガード
    }
    computing.add(id);
    const preds = predecessors.get(id) || [];
    const layer = preds.length === 0
      ? 0
      : Math.max(...preds.map(getLayer)) + 1;
    computing.delete(id);
    layers.set(id, layer);
    return layer;
  };

  for (const id of itemIds) {
    getLayer(id);
  }

  return layers;
};

// DAGのレイアウトをLongest Path Layeringで計算し、座標を返す
const layoutDAG = (
  items: Item[],
  deps: Dependency[],
  xBaseOffset: number
): PlacementResult[] => {
  const itemIds = new Set(items.map((i) => i.id));
  const layers = computeLayers(itemIds, deps);

  // レイヤーごとにアイテムをグループ化（期限順でソート）
  const layerGroups = new Map<number, Item[]>();
  for (const item of items) {
    const layer = layers.get(item.id) ?? 0;
    const group = layerGroups.get(layer) || [];
    group.push(item);
    layerGroups.set(layer, group);
  }

  // 同一レイヤー内を期限順にソート
  for (const [layer, group] of layerGroups) {
    layerGroups.set(layer, sortItemsForChain(group));
  }

  const results: PlacementResult[] = [];
  for (const [layer, group] of layerGroups) {
    const x = xBaseOffset + layer * X_INTERVAL;
    const layerSize = group.length;
    for (let i = 0; i < layerSize; i++) {
      const y = (i - (layerSize - 1) / 2) * Y_INTERVAL;
      results.push({ itemId: group[i].id, flow_x: x, flow_y: y });
    }
  }

  return results;
};

// アイテム群の自動配置座標＋チェーン情報を計算
export const calculateAutoPlacement = (
  items: Item[],
  existingDeps: Dependency[] = []
): PlacementResult[] => {
  // プロジェクト別にグルーピング
  const projectGroups = new Map<string, Item[]>();
  const unassigned: Item[] = [];

  for (const item of items) {
    if (item.projectId) {
      const group = projectGroups.get(item.projectId);
      if (group) {
        group.push(item);
      } else {
        projectGroups.set(item.projectId, [item]);
      }
    } else {
      unassigned.push(item);
    }
  }

  const results: PlacementResult[] = [];
  let projectIndex = 0;

  // プロジェクトごとにDAGレイアウト
  for (const [, group] of projectGroups) {
    const xBase = projectIndex * PROJECT_X_OFFSET;
    const placed = layoutDAG(group, existingDeps, xBase);
    results.push(...placed);
    projectIndex++;
  }

  // 未所属アイテムは最右列にフラットに配置
  const sorted = sortItemsForChain(unassigned);
  const unassignedX = projectIndex * PROJECT_X_OFFSET;
  const unassignedSize = sorted.length;
  for (let i = 0; i < unassignedSize; i++) {
    const y = (i - (unassignedSize - 1) / 2) * Y_INTERVAL;
    results.push({ itemId: sorted[i].id, flow_x: unassignedX, flow_y: y });
  }

  return results;
};

// エッジの中間点を計算
export const calculateEdgeMidpoint = (
  source: { x: number; y: number },
  target: { x: number; y: number }
): { x: number; y: number } => ({
  x: (source.x + target.x) / 2,
  y: (source.y + target.y) / 2,
});

interface EdgeLike {
  id: string;
  source: string;
  target: string;
}

interface NearestEdgeResult {
  edge: EdgeLike;
  midpoint: { x: number; y: number };
  distance: number;
}

// ドロップ位置から最近傍エッジを検出
export const findNearestEdge = (
  dropPosition: { x: number; y: number },
  edges: EdgeLike[],
  nodePositions: Map<string, { x: number; y: number }>,
  threshold: number,
  excludeNodeId?: string
): NearestEdgeResult | null => {
  let nearest: NearestEdgeResult | null = null;

  for (const edge of edges) {
    if (excludeNodeId && (edge.source === excludeNodeId || edge.target === excludeNodeId)) continue;
    const sourcePos = nodePositions.get(edge.source);
    const targetPos = nodePositions.get(edge.target);
    if (!sourcePos || !targetPos) continue;

    const mid = calculateEdgeMidpoint(sourcePos, targetPos);
    const dx = dropPosition.x - mid.x;
    const dy = dropPosition.y - mid.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance <= threshold && (nearest === null || distance < nearest.distance)) {
      nearest = { edge, midpoint: mid, distance };
    }
  }

  return nearest;
};
