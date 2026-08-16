import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Item, Dependency } from '../types';
import { getEffectiveDeadline, type PlacementResult } from './flowAutoPlace';

export const UNDATED_KEY = 'undated';

// 帯内でノードを横に並べる間隔（ノード最大幅180〜220に余白を確保）
export const COL_WIDTH = 250;
// 帯の縦の厚み（全帯共通の固定値）
export const BAND_HEIGHT = 220;
const NODE_HEIGHT = 80;
// 帯の左側に確保するラベル領域幅（日付・合計・最短の3行が収まる幅）
const LABEL_MARGIN_WIDTH = 140;

export interface DateGroup {
  dateKey: string;
  items: Item[];
}

// x/y/width/height は帯（全体幅いっぱいの横長帯、上から下へ積み上げ）の位置とサイズ
export interface DateBand {
  dateKey: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  totalMinutes: number;
  criticalMinutes: number;
}

export interface DateGroupLayout {
  placements: PlacementResult[];
  bands: DateBand[];
}

// 有効締切の日付ごとにアイテムをまとめる（日付昇順、未設定は末尾）
export const groupItemsByDeadline = (items: Item[]): DateGroup[] => {
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const deadline = getEffectiveDeadline(item);
    const key = deadline === null ? UNDATED_KEY : format(new Date(deadline), 'yyyy-MM-dd');
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }

  return Array.from(groups.entries())
    .map(([dateKey, groupItems]) => ({ dateKey, items: groupItems }))
    .sort((a, b) => {
      if (a.dateKey === UNDATED_KEY) return 1;
      if (b.dateKey === UNDATED_KEY) return -1;
      return a.dateKey.localeCompare(b.dateKey);
    });
};

const getMinutes = (item: Item): number => item.estimatedMinutes ?? 0;

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

// 依存グラフの最長経路（クリティカルパス）の所要分。直列は合計、並列分岐は最大値
export const calculateCriticalPathMinutes = (items: Item[], deps: Dependency[]): number => {
  const predecessors = buildPredecessors(items, deps);
  const byId = new Map(items.map((i) => [i.id, i]));
  const memo = new Map<string, number>();
  const computing = new Set<string>();

  const pathTo = (id: string): number => {
    const cached = memo.get(id);
    if (cached !== undefined) return cached;
    if (computing.has(id)) return 0; // 循環依存ガード
    computing.add(id);
    const preds = predecessors.get(id) ?? [];
    const upstream = preds.length === 0 ? 0 : Math.max(...preds.map(pathTo));
    computing.delete(id);
    const total = upstream + getMinutes(byId.get(id)!);
    memo.set(id, total);
    return total;
  };

  return items.reduce((max, item) => Math.max(max, pathTo(item.id)), 0);
};

// 依存の深さ（区間内で閉じたLongest Path Layering）
const computeDepthWithin = (items: Item[], deps: Dependency[]): Map<string, number> => {
  const predecessors = buildPredecessors(items, deps);
  const depths = new Map<string, number>();
  const computing = new Set<string>();

  const depthOf = (id: string): number => {
    const cached = depths.get(id);
    if (cached !== undefined) return cached;
    if (computing.has(id)) return 0; // 循環依存ガード
    computing.add(id);
    const preds = predecessors.get(id) ?? [];
    const depth = preds.length === 0 ? 0 : Math.max(...preds.map(depthOf)) + 1;
    computing.delete(id);
    depths.set(id, depth);
    return depth;
  };

  for (const item of items) depthOf(item.id);
  return depths;
};

export const formatHours = (minutes: number): string => {
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours}h`;
};

const bandLabel = (dateKey: string): string =>
  dateKey === UNDATED_KEY
    ? '日付未定'
    : `${format(parseISO(dateKey), 'M/d(E)', { locale: ja })}まで`;

// 日付グルーピング表示のノード座標と区間帯を計算する
export const calculateDateGroupLayout = (items: Item[], deps: Dependency[]): DateGroupLayout => {
  const groups = groupItemsByDeadline(items);
  if (groups.length === 0) return { placements: [], bands: [] };

  const maxCols = Math.max(...groups.map((g) => g.items.length));
  const bandX = 0;
  const bandWidth = LABEL_MARGIN_WIDTH + maxCols * COL_WIDTH;

  const placements: PlacementResult[] = [];
  const bands: DateBand[] = [];

  groups.forEach((group, index) => {
    const bandY = index * BAND_HEIGHT;
    const depths = computeDepthWithin(group.items, deps);
    // 依存の深い順を優先しつつ、同じ深さでは既存のx座標の左右関係を保つ
    const ordered = [...group.items].sort((a, b) => {
      const depthDiff = (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0);
      if (depthDiff !== 0) return depthDiff;
      const ax = (a.meta?.flow_x as number) ?? 0;
      const bx = (b.meta?.flow_x as number) ?? 0;
      return ax - bx;
    });

    ordered.forEach((item, col) => {
      placements.push({
        itemId: item.id,
        flow_x: LABEL_MARGIN_WIDTH + col * COL_WIDTH,
        flow_y: bandY + (BAND_HEIGHT - NODE_HEIGHT) / 2,
      });
    });

    bands.push({
      dateKey: group.dateKey,
      label: bandLabel(group.dateKey),
      x: bandX,
      y: bandY,
      width: bandWidth,
      height: BAND_HEIGHT,
      totalMinutes: group.items.reduce((sum, item) => sum + getMinutes(item), 0),
      criticalMinutes: calculateCriticalPathMinutes(group.items, deps),
    });
  });

  return { placements, bands };
};
