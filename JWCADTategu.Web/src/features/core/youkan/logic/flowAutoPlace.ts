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

const X_OFFSET = 300;
const Y_INTERVAL = 150;

// 同一プロジェクト内の依存関係からチェーン（トポロジカル順）を構築
const buildDependencyChains = (
  projectItemIds: Set<string>,
  deps: Dependency[]
): string[][] => {
  // プロジェクト内の依存関係のみ抽出
  const internalDeps = deps.filter(
    (d) => projectItemIds.has(d.sourceItemId) && projectItemIds.has(d.targetItemId)
  );
  if (internalDeps.length === 0) return [];

  // 隣接リストと入次数
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, number>();
  const nodesInDeps = new Set<string>();

  for (const dep of internalDeps) {
    nodesInDeps.add(dep.sourceItemId);
    nodesInDeps.add(dep.targetItemId);
    const targets = outgoing.get(dep.sourceItemId) || [];
    targets.push(dep.targetItemId);
    outgoing.set(dep.sourceItemId, targets);
    incoming.set(dep.targetItemId, (incoming.get(dep.targetItemId) || 0) + 1);
    if (!incoming.has(dep.sourceItemId)) incoming.set(dep.sourceItemId, 0);
  }

  // ルートノード（入次数0）ごとにチェーンをたどる
  const roots = [...nodesInDeps].filter((id) => (incoming.get(id) || 0) === 0);
  const visited = new Set<string>();
  const chains: string[][] = [];

  for (const root of roots) {
    const chain: string[] = [];
    let current: string | undefined = root;
    while (current && !visited.has(current)) {
      visited.add(current);
      chain.push(current);
      const nexts: string[] = outgoing.get(current) || [];
      current = nexts.find((n: string) => !visited.has(n));
    }
    if (chain.length > 0) chains.push(chain);
  }

  // 長いチェーンを先に
  chains.sort((a, b) => b.length - a.length);
  return chains;
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
  const hasDeps = existingDeps.length > 0;

  // プロジェクトごとに配置
  for (const [, group] of projectGroups) {
    const x = projectIndex * X_OFFSET;
    const itemIds = new Set(group.map((i) => i.id));

    if (hasDeps) {
      // 既存依存関係のチェーン順で配置
      const chains = buildDependencyChains(itemIds, existingDeps);
      const placedIds = new Set<string>();
      let yIndex = 0;

      // チェーンに含まれるアイテムをチェーン順に配置
      for (const chain of chains) {
        for (const id of chain) {
          if (placedIds.has(id)) continue;
          placedIds.add(id);
          results.push({ itemId: id, flow_x: x, flow_y: yIndex * Y_INTERVAL });
          yIndex++;
        }
      }

      // チェーンに含まれないアイテムを下に追加
      const nonChainItems = group.filter((i) => !placedIds.has(i.id));
      const sortedNonChain = sortItemsForChain(nonChainItems);
      for (const item of sortedNonChain) {
        results.push({ itemId: item.id, flow_x: x, flow_y: yIndex * Y_INTERVAL });
        yIndex++;
      }
    } else {
      // 依存関係なし: 期限順でソート+チェーン生成
      const sorted = sortItemsForChain(group);
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
