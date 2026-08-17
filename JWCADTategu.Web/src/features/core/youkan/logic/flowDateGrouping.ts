import { format, parseISO } from 'date-fns';
import { ja } from 'date-fns/locale';
import type { Item, Dependency } from '../types';
import { getEffectiveDeadline, type PlacementResult } from './flowAutoPlace';
import { NODE_WIDTH } from '../components/Flow/flowGrouping';

export { NODE_WIDTH };

export const UNDATED_KEY = 'undated';

// 帯内でノードを縦に並べる行間隔（「日付整列」用）
export const ROW_HEIGHT = 110;
// 帯の上端から1行目までの余白（左上3行ラベルとの重なりを避ける）
const BAND_PADDING_TOP = 60;
const BAND_PADDING_BOTTOM = 20;
// 帯の最小高さ（左上3行ラベルが収まる値、「日付整列」用）
const BAND_MIN_HEIGHT = 150;
// 帯の左側に確保するラベル領域幅（日付・合計・最短の3行が収まる幅）
const LABEL_MARGIN_WIDTH = 140;
// ノードサイズの実測値が無い場合の既定高さ（幅はNODE_WIDTHを使う）
const DEFAULT_NODE_HEIGHT = 60;

export interface DateGroup {
  dateKey: string;
  items: Item[];
}

// x/y/width/height は帯（その日付グループに属するノードの現在位置の外接矩形）の位置とサイズ
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

// 依存の深さ（区間内で閉じたLongest Path Layering）。flowAutoArrange.tsからも流用
export const computeDepthWithin = (items: Item[], deps: Dependency[]): Map<string, number> => {
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

// R-113: 日付グループごとに、ノードの現在位置（ドラッグ中も含む）から外接矩形を計算する。
// 表示専用で、ノードの位置は一切書き換えない
export const calculateDateBands = (
  items: Item[],
  deps: Dependency[],
  sizes?: Map<string, { width: number; height: number }>
): DateBand[] => {
  const groups = groupItemsByDeadline(items);

  return groups.map((group) => {
    let minX = Infinity;
    let maxRight = -Infinity;
    let minY = Infinity;
    let maxBottom = -Infinity;

    for (const item of group.items) {
      const x = (item.meta?.flow_x as number) ?? 0;
      const y = (item.meta?.flow_y as number) ?? 0;
      const size = sizes?.get(item.id) ?? { width: NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
      minX = Math.min(minX, x);
      maxRight = Math.max(maxRight, x + size.width);
      minY = Math.min(minY, y);
      maxBottom = Math.max(maxBottom, y + size.height);
    }

    const x = minX - LABEL_MARGIN_WIDTH;
    const y = minY - BAND_PADDING_TOP;

    return {
      dateKey: group.dateKey,
      label: bandLabel(group.dateKey),
      x,
      y,
      width: maxRight - x,
      height: maxBottom + BAND_PADDING_BOTTOM - y,
      totalMinutes: group.items.reduce((sum, item) => sum + getMinutes(item), 0),
      criticalMinutes: calculateCriticalPathMinutes(group.items, deps),
    };
  });
};

// 帯内でノードの行（row）を決める: 依存元の行より下を下限に、X区間が重ならない最初の行を選ぶ
const assignRows = (
  orderedItems: Item[],
  predecessors: Map<string, string[]>
): Map<string, number> => {
  const rowOf = new Map<string, number>();
  const rowIntervals = new Map<number, Array<[number, number]>>();

  for (const item of orderedItems) {
    const x = (item.meta?.flow_x as number) ?? 0;
    const preds = predecessors.get(item.id) ?? [];
    let minRow = 0;
    for (const predId of preds) {
      const predRow = rowOf.get(predId);
      if (predRow !== undefined) minRow = Math.max(minRow, predRow + 1);
    }

    let row = minRow;
    for (;;) {
      const intervals = rowIntervals.get(row) ?? [];
      const overlaps = intervals.some(([ix1, ix2]) => x < ix2 && x + NODE_WIDTH > ix1);
      if (!overlaps) break;
      row++;
    }

    rowOf.set(item.id, row);
    const intervals = rowIntervals.get(row) ?? [];
    intervals.push([x, x + NODE_WIDTH]);
    rowIntervals.set(row, intervals);
  }

  return rowOf;
};

// R-113「日付整列」ボタン用: R-111で確定した帯内配置ルールどおりに、flow_xは変えず縦方向だけ
// 各ノードを日付順の区間へ移動する。y原点は全アイテムの最小flow_y - 上パディングから区間を累積する
export const calculateDateGroupLayout = (items: Item[], deps: Dependency[]): PlacementResult[] => {
  const groups = groupItemsByDeadline(items);
  if (groups.length === 0) return [];

  const ys = items.map((item) => (item.meta?.flow_y as number) ?? 0);
  let bandY = (ys.length > 0 ? Math.min(...ys) : 0) - BAND_PADDING_TOP;

  const placements: PlacementResult[] = [];

  for (const group of groups) {
    const depths = computeDepthWithin(group.items, deps);
    const predecessors = buildPredecessors(group.items, deps);
    // 処理順: 依存の深さ昇順→同じ深さは元のflow_y昇順（元の上下関係を保つ）
    const ordered = [...group.items].sort((a, b) => {
      const depthDiff = (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0);
      if (depthDiff !== 0) return depthDiff;
      const ay = (a.meta?.flow_y as number) ?? 0;
      const by = (b.meta?.flow_y as number) ?? 0;
      return ay - by;
    });

    const rowOf = assignRows(ordered, predecessors);
    const rows = Math.max(...Array.from(rowOf.values())) + 1;
    const height = Math.max(rows * ROW_HEIGHT + BAND_PADDING_TOP + BAND_PADDING_BOTTOM, BAND_MIN_HEIGHT);

    for (const item of ordered) {
      placements.push({
        itemId: item.id,
        flow_x: (item.meta?.flow_x as number) ?? 0,
        flow_y: bandY + BAND_PADDING_TOP + rowOf.get(item.id)! * ROW_HEIGHT,
      });
    }

    bandY += height;
  }

  return placements;
};
