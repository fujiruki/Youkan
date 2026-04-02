import type { Item } from '../types';
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

const X_OFFSET = 300;
const Y_INTERVAL = 150;

// アイテム群の自動配置座標＋チェーン情報を計算
export const calculateAutoPlacement = (items: Item[]): PlacementResult[] => {
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

  // プロジェクトごとにソートして配置＋チェーン生成
  for (const [, group] of projectGroups) {
    const sorted = sortItemsForChain(group);
    const x = projectIndex * X_OFFSET;

    for (let i = 0; i < sorted.length; i++) {
      const result: PlacementResult = {
        itemId: sorted[i].id,
        flow_x: x,
        flow_y: i * Y_INTERVAL,
      };
      if (i > 0) {
        result.chainFrom = sorted[i - 1].id;
      }
      results.push(result);
    }

    projectIndex++;
  }

  // 未所属アイテムは最右列にフラットに配置（チェーンなし）
  const sorted = sortItemsForChain(unassigned);
  const unassignedX = projectIndex * X_OFFSET;
  for (let i = 0; i < sorted.length; i++) {
    results.push({
      itemId: sorted[i].id,
      flow_x: unassignedX,
      flow_y: i * Y_INTERVAL,
    });
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
  threshold: number
): NearestEdgeResult | null => {
  let nearest: NearestEdgeResult | null = null;

  for (const edge of edges) {
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
