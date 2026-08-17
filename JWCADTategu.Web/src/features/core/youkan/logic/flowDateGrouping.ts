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
// R-115: 日付未定の専用列と、有効締切ありの帯との間に空ける追加の間隔
const UNDATED_COLUMN_GAP = 60;

export interface DateGroup {
  dateKey: string;
  items: Item[];
}

// x/y/width/height は帯（その日付グループに属するノードの現在位置の外接矩形）の位置とサイズ
// R-122: 日付が確定している帯は、x/widthを「案件（projectId）ごと」の全ノードの外接矩形へ統一する。
// projectIdはReactのkey生成（同日付・別案件の帯を区別する）にも使う
export interface DateBand {
  dateKey: string;
  projectId: string | null;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
  totalMinutes: number;
  criticalMinutes: number;
  remainingMinutes: number;
  hasIncomplete: boolean;
}

// projectIdが無い（個人タスク等）アイテムをまとめる仮想キー
const NO_PROJECT_KEY = '__no_project__';
const projectKeyOf = (item: Item): string => item.projectId ?? NO_PROJECT_KEY;

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

// 指定アイテム群を、projectKeyOf() ごとのX方向の外接矩形（案件全体の帯幅の基準）へ集計する
const calculateProjectXBounds = (
  items: Item[],
  sizes?: Map<string, { width: number; height: number }>
): Map<string, { minX: number; maxRight: number }> => {
  const bounds = new Map<string, { minX: number; maxRight: number }>();
  for (const item of items) {
    const key = projectKeyOf(item);
    const x = (item.meta?.flow_x as number) ?? 0;
    const size = sizes?.get(item.id) ?? { width: NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
    const right = x + size.width;
    const existing = bounds.get(key);
    if (existing) {
      existing.minX = Math.min(existing.minX, x);
      existing.maxRight = Math.max(existing.maxRight, right);
    } else {
      bounds.set(key, { minX: x, maxRight: right });
    }
  }
  return bounds;
};

// 帯1件分の外接矩形（y/height）と集計値を組み立てる。x/widthは省略時のみノード自身から算出する
const buildBand = (
  dateKey: string,
  projectId: string | null,
  groupItems: Item[],
  deps: Dependency[],
  sizes: Map<string, { width: number; height: number }> | undefined,
  xOverride?: number,
  widthOverride?: number
): DateBand => {
  let minX = Infinity;
  let maxRight = -Infinity;
  let minY = Infinity;
  let maxBottom = -Infinity;

  for (const item of groupItems) {
    const x = (item.meta?.flow_x as number) ?? 0;
    const y = (item.meta?.flow_y as number) ?? 0;
    const size = sizes?.get(item.id) ?? { width: NODE_WIDTH, height: DEFAULT_NODE_HEIGHT };
    minX = Math.min(minX, x);
    maxRight = Math.max(maxRight, x + size.width);
    minY = Math.min(minY, y);
    maxBottom = Math.max(maxBottom, y + size.height);
  }

  const x = xOverride ?? minX - LABEL_MARGIN_WIDTH;
  const y = minY - BAND_PADDING_TOP;
  const width = widthOverride ?? maxRight - x;
  const incompleteItems = groupItems.filter((item) => item.status !== 'done');

  return {
    dateKey,
    projectId,
    label: bandLabel(dateKey),
    x,
    y,
    width,
    height: maxBottom + BAND_PADDING_BOTTOM - y,
    totalMinutes: groupItems.reduce((sum, item) => sum + getMinutes(item), 0),
    criticalMinutes: calculateCriticalPathMinutes(groupItems, deps),
    remainingMinutes: incompleteItems.reduce((sum, item) => sum + getMinutes(item), 0),
    hasIncomplete: incompleteItems.length > 0,
  };
};

// R-113: 日付グループごとに、ノードの現在位置（ドラッグ中も含む）から外接矩形を計算する。
// 表示専用で、ノードの位置は一切書き換えない
// R-122: 有効締切ありの帯は、日付グループ単独の外接矩形ではなく「案件（projectId）ごと」の
// 全ノードの外接矩形へx/widthを統一する。フォーカスなし時に画面へ複数案件が混在していても、
// 同じ日付を案件をまたいでまとめず、案件ごとに別々の帯として扱う。
// 日付未定の専用列（R-115）は対象外・現状維持（案件をまたいだ1つの帯のまま、幅も統一しない）
export const calculateDateBands = (
  items: Item[],
  deps: Dependency[],
  sizes?: Map<string, { width: number; height: number }>
): DateBand[] => {
  const groups = groupItemsByDeadline(items);
  const datedGroups = groups.filter((g) => g.dateKey !== UNDATED_KEY);
  const undatedGroup = groups.find((g) => g.dateKey === UNDATED_KEY);

  const datedItems = datedGroups.flatMap((g) => g.items);
  const projectBounds = calculateProjectXBounds(datedItems, sizes);

  const projectOrder: string[] = [];
  const seenProjects = new Set<string>();
  for (const item of datedItems) {
    const key = projectKeyOf(item);
    if (!seenProjects.has(key)) {
      seenProjects.add(key);
      projectOrder.push(key);
    }
  }

  const bands: DateBand[] = [];
  for (const projectKey of projectOrder) {
    const bounds = projectBounds.get(projectKey)!;
    const bandX = bounds.minX - LABEL_MARGIN_WIDTH;
    const bandWidth = bounds.maxRight - bandX;
    const projectId = projectKey === NO_PROJECT_KEY ? null : projectKey;

    for (const group of datedGroups) {
      const groupProjectItems = group.items.filter((item) => projectKeyOf(item) === projectKey);
      if (groupProjectItems.length === 0) continue;
      bands.push(buildBand(group.dateKey, projectId, groupProjectItems, deps, sizes, bandX, bandWidth));
    }
  }

  if (undatedGroup) {
    bands.push(buildBand(undatedGroup.dateKey, null, undatedGroup.items, deps, sizes));
  }

  return bands;
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

// 依存の深さ昇順→同じ深さは元のflow_y昇順（元の上下関係を保つ）の並び順
const orderByDepthThenFlowY = (items: Item[], deps: Dependency[]): Item[] => {
  const depths = computeDepthWithin(items, deps);
  return [...items].sort((a, b) => {
    const depthDiff = (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0);
    if (depthDiff !== 0) return depthDiff;
    const ay = (a.meta?.flow_y as number) ?? 0;
    const by = (b.meta?.flow_y as number) ?? 0;
    return ay - by;
  });
};

// R-113「日付整列」ボタン用: R-111で確定した帯内配置ルールどおりに、flow_xは変えず縦方向だけ
// 各ノードを日付順の区間へ移動する。y原点は有効締切ありアイテムの最小flow_y - 上パディングから区間を累積する。
// R-115: 日付未定のアイテムは帯の縦積みには含めず、帯の左側の専用1列へ縦中央揃えで配置する
export const calculateDateGroupLayout = (
  items: Item[],
  deps: Dependency[],
  options?: { rowHeight?: number }
): PlacementResult[] => {
  const rowHeight = options?.rowHeight ?? ROW_HEIGHT;
  const groups = groupItemsByDeadline(items);
  if (groups.length === 0) return [];

  const datedGroups = groups.filter((g) => g.dateKey !== UNDATED_KEY);
  const undatedGroup = groups.find((g) => g.dateKey === UNDATED_KEY);
  const datedItems = datedGroups.flatMap((g) => g.items);

  const bandYStart =
    datedItems.length > 0
      ? Math.min(...datedItems.map((item) => (item.meta?.flow_y as number) ?? 0)) - BAND_PADDING_TOP
      : 0;
  let bandY = bandYStart;

  const placements: PlacementResult[] = [];

  for (const group of datedGroups) {
    const predecessors = buildPredecessors(group.items, deps);
    const ordered = orderByDepthThenFlowY(group.items, deps);

    const rowOf = assignRows(ordered, predecessors);
    const rows = Math.max(...Array.from(rowOf.values())) + 1;
    const height = Math.max(rows * rowHeight + BAND_PADDING_TOP + BAND_PADDING_BOTTOM, BAND_MIN_HEIGHT);

    for (const item of ordered) {
      placements.push({
        itemId: item.id,
        flow_x: (item.meta?.flow_x as number) ?? 0,
        flow_y: bandY + BAND_PADDING_TOP + rowOf.get(item.id)! * rowHeight,
      });
    }

    bandY += height;
  }

  const totalDatedHeight = bandY - bandYStart;

  if (undatedGroup) {
    const ordered = orderByDepthThenFlowY(undatedGroup.items, deps);
    const rows = ordered.length;
    const undatedHeight = Math.max(rows * rowHeight + BAND_PADDING_TOP + BAND_PADDING_BOTTOM, BAND_MIN_HEIGHT);

    const baseX =
      datedItems.length > 0 ? Math.min(...datedItems.map((item) => (item.meta?.flow_x as number) ?? 0)) : 0;
    const undatedX = baseX - LABEL_MARGIN_WIDTH - UNDATED_COLUMN_GAP - NODE_WIDTH;
    const undatedY = datedGroups.length > 0 ? bandYStart + (totalDatedHeight - undatedHeight) / 2 : 0;

    ordered.forEach((item, index) => {
      placements.push({
        itemId: item.id,
        flow_x: undatedX,
        flow_y: undatedY + BAND_PADDING_TOP + index * rowHeight,
      });
    });
  }

  return placements;
};
