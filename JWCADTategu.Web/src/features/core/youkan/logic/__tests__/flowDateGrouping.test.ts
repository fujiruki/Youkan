import { describe, it, expect } from 'vitest';
import {
  groupItemsByDeadline,
  calculateCriticalPathMinutes,
  calculateDateBands,
  calculateDateGroupLayout,
  formatHours,
  ROW_HEIGHT,
  NODE_WIDTH,
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

// R-113: 帯（表示専用）はノードの現在位置の外接矩形にライブ追従する
// R-122: 帯幅は日付グループ単独ではなく「案件（projectId）ごと」の全ノードの外接矩形へ統一する
describe('calculateDateBands', () => {
  const items = [
    makeItem({ id: 'a', projectId: 'p1', due_date: '2026-08-16', estimatedMinutes: 60, meta: { flow_x: 300, flow_y: 0 } }),
    makeItem({ id: 'b', projectId: 'p1', due_date: '2026-08-16', estimatedMinutes: 120, meta: { flow_x: 100, flow_y: 50 } }),
    makeItem({ id: 'c', projectId: 'p1', due_date: '2026-08-17', estimatedMinutes: 60, meta: { flow_x: 0, flow_y: 300 } }),
  ];

  it('R-122: 帯のx/widthは日付グループではなく案件(projectId)内の全ノードの外接矩形で統一される', () => {
    const bands = calculateDateBands(items, []);
    expect(bands).toHaveLength(2);
    // p1内の全ノード(a,b,c): minX=0(c), maxRight=300+NODE_WIDTH(a)
    const expectedX = 0 - 140;
    const expectedWidth = 300 + NODE_WIDTH - expectedX;
    expect(bands[0].x).toBe(expectedX);
    expect(bands[0].width).toBe(expectedWidth);
    // 8/17帯（cのみ含む）も同じ幅へ統一される
    expect(bands[1].x).toBe(expectedX);
    expect(bands[1].width).toBe(expectedWidth);
  });

  it('yと高さは引き続きその日付グループ内ノードだけの外接矩形（案件全体には広げない）', () => {
    const bands = calculateDateBands(items, []);
    // 8/16グループ: minY=0(a)-60, maxBottom=50+60(b)+20
    expect(bands[0].y).toBe(0 - 60);
    expect(bands[0].height).toBe(50 + 60 + 20 - (0 - 60));
  });

  it('sizesを渡すと実測サイズが案件の外接矩形（帯幅）に反映される', () => {
    const withoutSizes = calculateDateBands(items, []);
    const sizes = new Map([['a', { width: 400, height: 100 }]]);
    const withSizes = calculateDateBands(items, [], sizes);
    expect(withSizes[0].width).toBeGreaterThan(withoutSizes[0].width);
  });

  it('ノードを動かすと帯の位置・大きさが追従する（表示のみ、順序無関係の外接矩形）', () => {
    const before = calculateDateBands(items, [])[0];
    const moved = items.map((item) =>
      item.id === 'a' ? { ...item, meta: { flow_x: -1000, flow_y: -1000 } } : item
    );
    const after = calculateDateBands(moved, [])[0];
    expect(after.x).toBeLessThan(before.x);
    expect(after.y).toBeLessThan(before.y);
    expect(after.width).toBeGreaterThan(before.width);
    expect(after.height).toBeGreaterThan(before.height);
  });

  it('合計時間・最短時間はcalculateCriticalPathMinutesと一致する', () => {
    const bands = calculateDateBands(items, [dep('a', 'b')]);
    expect(bands[0].totalMinutes).toBe(180);
    expect(bands[0].criticalMinutes).toBe(180);
    expect(bands[1].totalMinutes).toBe(60);
  });

  it('区間のラベルは曜日つき「M/d(曜)まで」形式', () => {
    const bands = calculateDateBands(items, []);
    // 2026-08-16は日曜日
    expect(bands[0].label).toBe('8/16(日)まで');
  });

  it('各帯にprojectIdを持つ', () => {
    const bands = calculateDateBands(items, []);
    expect(bands[0].projectId).toBe('p1');
    expect(bands[1].projectId).toBe('p1');
  });

  it('未定グループも外接矩形とラベル「日付未定」を返す', () => {
    const bands = calculateDateBands([makeItem({ id: 'x', meta: { flow_x: 0, flow_y: 0 } })], []);
    expect(bands[0].dateKey).toBe(UNDATED_KEY);
    expect(bands[0].label).toBe('日付未定');
  });

  it('アイテムが空なら空配列を返す', () => {
    expect(calculateDateBands([], [])).toEqual([]);
  });

  it('未完了タスクを含む区間はhasIncomplete=trueで、remainingMinutesは未完了分のみの合計', () => {
    const mixed = [
      makeItem({ id: 'a', due_date: '2026-08-16', estimatedMinutes: 60, status: 'inbox', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', due_date: '2026-08-16', estimatedMinutes: 120, status: 'done', meta: { flow_x: 100, flow_y: 0 } }),
    ];
    const bands = calculateDateBands(mixed, []);
    expect(bands[0].hasIncomplete).toBe(true);
    expect(bands[0].remainingMinutes).toBe(60);
  });

  it('全て完了済みの区間はhasIncomplete=false', () => {
    const allDone = [
      makeItem({ id: 'a', due_date: '2026-08-16', estimatedMinutes: 60, status: 'done', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'b', due_date: '2026-08-16', estimatedMinutes: 120, status: 'done', meta: { flow_x: 100, flow_y: 0 } }),
    ];
    const bands = calculateDateBands(allDone, []);
    expect(bands[0].hasIncomplete).toBe(false);
    expect(bands[0].remainingMinutes).toBe(0);
  });

  it('未完了だが目安時間0分のタスクのみでもhasIncomplete=true・remainingMinutes=0', () => {
    const zeroMinute = [
      makeItem({ id: 'a', due_date: '2026-08-16', status: 'inbox', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const bands = calculateDateBands(zeroMinute, []);
    expect(bands[0].hasIncomplete).toBe(true);
    expect(bands[0].remainingMinutes).toBe(0);
  });
});

// R-122: フォーカスなし（全案件表示）時、同じ日付でも案件が異なれば別々の帯として、
// それぞれの案件のノード外接矩形幅で表示する
describe('calculateDateBands: 複数案件が混在する場合（R-122）', () => {
  it('同じ日付でも案件(projectId)が異なれば別々の帯になり、案件ごとに幅が異なる', () => {
    const items = [
      // p1: 横に広い(x=0〜500)
      makeItem({ id: 'p1-a', projectId: 'p1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'p1-b', projectId: 'p1', due_date: '2026-08-16', meta: { flow_x: 500, flow_y: 0 } }),
      // p2: 横に狭い(x=1000のみ)、p1と同じ日付
      makeItem({ id: 'p2-a', projectId: 'p2', due_date: '2026-08-16', meta: { flow_x: 1000, flow_y: 100 } }),
    ];
    const bands = calculateDateBands(items, []);
    expect(bands).toHaveLength(2);

    const p1Band = bands.find((b) => b.projectId === 'p1')!;
    const p2Band = bands.find((b) => b.projectId === 'p2')!;
    expect(p1Band.dateKey).toBe('2026-08-16');
    expect(p2Band.dateKey).toBe('2026-08-16');
    // p1: minX=0, maxRight=500+NODE_WIDTH
    expect(p1Band.x).toBe(0 - 140);
    expect(p1Band.width).toBe(500 + NODE_WIDTH - (0 - 140));
    // p2: minX=1000, maxRight=1000+NODE_WIDTH（p1の幅とは別・案件をまたいでまとめない）
    expect(p2Band.x).toBe(1000 - 140);
    expect(p2Band.width).toBe(NODE_WIDTH + 140);
  });

  it('プロジェクトフォーカス中（該当案件のアイテムのみ渡された場合）も同じ幅基準になる', () => {
    const items = [
      makeItem({ id: 'p1-a', projectId: 'p1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'p1-b', projectId: 'p1', due_date: '2026-08-16', meta: { flow_x: 500, flow_y: 0 } }),
    ];
    // フォーカスなし(p2含む)で計算したp1帯と、p1のみ渡した場合の帯が一致する
    const withOtherProject = calculateDateBands(
      [...items, makeItem({ id: 'p2-a', projectId: 'p2', due_date: '2026-08-16', meta: { flow_x: 1000, flow_y: 0 } })],
      []
    ).find((b) => b.projectId === 'p1')!;
    const focusedOnly = calculateDateBands(items, [])[0];
    expect(focusedOnly.x).toBe(withOtherProject.x);
    expect(focusedOnly.width).toBe(withOtherProject.width);
  });

  it('projectIdが無いアイテム同士は1つの無所属バケットとしてまとめられる', () => {
    const items = [
      makeItem({ id: 'x', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'y', due_date: '2026-08-17', meta: { flow_x: 400, flow_y: 0 } }),
    ];
    const bands = calculateDateBands(items, []);
    expect(bands).toHaveLength(2);
    expect(bands[0].projectId).toBeNull();
    expect(bands[1].projectId).toBeNull();
    // 無所属バケット全体(x,y)の外接矩形: minX=0, maxRight=400+NODE_WIDTH
    expect(bands[0].x).toBe(bands[1].x);
    expect(bands[0].width).toBe(bands[1].width);
    expect(bands[0].width).toBe(400 + NODE_WIDTH - (0 - 140));
  });

  it('日付未定の専用列（R-115）は帯幅拡張の対象外で、案件をまたいでも現状維持のまま1つの帯になる', () => {
    const items = [
      makeItem({ id: 'p1-a', projectId: 'p1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'p1-x', projectId: 'p1', meta: { flow_x: -300, flow_y: 0 } }),
      makeItem({ id: 'p2-x', projectId: 'p2', meta: { flow_x: -300, flow_y: 200 } }),
    ];
    const bands = calculateDateBands(items, []);
    const undatedBands = bands.filter((b) => b.dateKey === UNDATED_KEY);
    // 案件が異なっても分割されず、常に1つの帯のまま（現状維持）
    expect(undatedBands).toHaveLength(1);
    expect(undatedBands[0].projectId).toBeNull();
  });
});

// R-122確定仕様3: サブプロジェクト（isProject + parentIdの入れ子）は技術調査の結果、
// 本要望のスコープ外として見送り。理由は requests_log.md を参照。
// このテストは「見送り」を仕様として固定するための回帰テスト:
// 同じ案件(projectId)内にサブプロジェクト構造(parentId)があっても、
// サブプロジェクト単位では分割されず、案件全体で1つの帯にまとまることを保証する
describe('calculateDateBands: サブプロジェクト混在時の現状仕様（R-122スコープ外）', () => {
  it('同じprojectId内にparentIdによる入れ子があっても、サブプロジェクトごとには分割されない', () => {
    const items = [
      // サブプロジェクト自体のコンテナアイテム
      makeItem({ id: 'sub', projectId: 'p1', isProject: true, due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      // サブプロジェクト配下の子タスク（parentId='sub'だがprojectIdは同じp1のまま）
      makeItem({ id: 'sub-child', projectId: 'p1', parentId: 'sub', due_date: '2026-08-16', meta: { flow_x: 900, flow_y: 0 } }),
      // サブプロジェクトに属さないp1直下のタスク
      makeItem({ id: 'plain', projectId: 'p1', due_date: '2026-08-16', meta: { flow_x: -300, flow_y: 0 } }),
    ];
    const bands = calculateDateBands(items, []);
    // 案件(p1)全体で1つの帯のまま。サブプロジェクト単位の追加分割はスコープ外
    expect(bands).toHaveLength(1);
    expect(bands[0].projectId).toBe('p1');
    // 幅はp1内の全ノード(sub, sub-child, plain)の外接矩形になる
    expect(bands[0].x).toBe(-300 - 140);
    expect(bands[0].width).toBe(900 + NODE_WIDTH - (-300 - 140));
  });
});

// R-113:「日付整列」ボタン用。flow_xは変えず縦方向だけ日付順の区間へ移動する
describe('calculateDateGroupLayout', () => {
  const items = [
    makeItem({ id: 'a', due_date: '2026-08-16', estimatedMinutes: 60, meta: { flow_x: 300, flow_y: 0 } }),
    makeItem({ id: 'b', due_date: '2026-08-16', estimatedMinutes: 120, meta: { flow_x: 100, flow_y: 0 } }),
    makeItem({ id: 'c', due_date: '2026-08-17', estimatedMinutes: 60, meta: { flow_x: 0, flow_y: 0 } }),
  ];

  it('flow_xは元の値のまま変更しない', () => {
    const placements = calculateDateGroupLayout(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_x).toBe(300);
    expect(byId.get('b')!.flow_x).toBe(100);
    expect(byId.get('c')!.flow_x).toBe(0);
  });

  it('Xが重ならないノード同士は同じ帯なら同じ行（同じy）に詰める', () => {
    const placements = calculateDateGroupLayout(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // a(x=300→[300,480]) と b(x=100→[100,280])はNODE_WIDTH分でも重ならないので同じ行
    expect(byId.get('a')!.flow_y).toBe(byId.get('b')!.flow_y);
  });

  it('Xが重なるノードは別の行に分けられる（依存がなくても）', () => {
    const overlapping = [
      makeItem({ id: 'x1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x2', due_date: '2026-08-16', meta: { flow_x: 50, flow_y: 100 } }),
    ];
    const placements = calculateDateGroupLayout(overlapping, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('x1')!.flow_x).toBe(0);
    expect(byId.get('x2')!.flow_x).toBe(50);
    expect(byId.get('x1')!.flow_y).not.toBe(byId.get('x2')!.flow_y);
  });

  it('依存先は依存元より下の行に置かれる（flow_xは維持したまま縦移動のみ）', () => {
    const placements = calculateDateGroupLayout(items, [dep('a', 'b')]);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_x).toBe(300);
    expect(byId.get('b')!.flow_x).toBe(100);
    expect(byId.get('b')!.flow_y).toBeGreaterThan(byId.get('a')!.flow_y);
  });

  it('行間隔はROW_HEIGHT刻み', () => {
    const overlapping = [
      makeItem({ id: 'x1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x2', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const placements = calculateDateGroupLayout(overlapping, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(Math.abs(byId.get('x2')!.flow_y - byId.get('x1')!.flow_y)).toBe(ROW_HEIGHT);
  });

  it('y原点は全アイテムの最小flow_yを基準に決まる（丸ごとずれても相対関係は同じ）', () => {
    const original = calculateDateGroupLayout(items, []);
    const origById = new Map(original.map((p) => [p.itemId, p]));
    const shifted = items.map((item) => ({
      ...item,
      meta: { ...item.meta, flow_y: (item.meta!.flow_y as number) + 1000 },
    }));
    const placements = calculateDateGroupLayout(shifted, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('a')!.flow_y).toBe(origById.get('a')!.flow_y + 1000);
    expect(byId.get('c')!.flow_y).toBe(origById.get('c')!.flow_y + 1000);
  });

  it('行数が増えると次の帯へのy移動幅（帯の高さ）が大きくなる', () => {
    const oneRow = [
      makeItem({ id: 'a', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'z', due_date: '2026-08-17', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const oneRowPlacements = calculateDateGroupLayout(oneRow, []);
    const oneRowById = new Map(oneRowPlacements.map((p) => [p.itemId, p]));
    const oneRowGap = oneRowById.get('z')!.flow_y - oneRowById.get('a')!.flow_y;

    const threeRows = [
      makeItem({ id: 'x1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x2', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x3', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'z', due_date: '2026-08-17', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const threeRowsPlacements = calculateDateGroupLayout(threeRows, []);
    const threeRowsById = new Map(threeRowsPlacements.map((p) => [p.itemId, p]));
    const threeRowsGap = threeRowsById.get('z')!.flow_y - threeRowsById.get('x1')!.flow_y;

    expect(threeRowsGap).toBeGreaterThan(oneRowGap);
  });

  it('アイテムが空なら空配列を返す', () => {
    expect(calculateDateGroupLayout([], [])).toEqual([]);
  });
});

// R-115: 日付未定ノードは有効締切ありの帯とは別に、左の専用1列へ縦中央揃えで配置する
describe('calculateDateGroupLayout: 日付未定ノードの専用列配置（R-115）', () => {
  it('未定ノードは有効締切ありの帯より左の専用列に配置される', () => {
    const items = [
      makeItem({ id: 'a', due_date: '2026-08-16', meta: { flow_x: 300, flow_y: 0 } }),
      makeItem({ id: 'x', meta: { flow_x: 500, flow_y: 0 } }),
    ];
    const placements = calculateDateGroupLayout(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // 専用列X = 有効締切ありの最小flow_x(300) - LABEL_MARGIN_WIDTH(140) - 追加ギャップ(60) - NODE_WIDTH
    expect(byId.get('x')!.flow_x).toBe(300 - 140 - 60 - NODE_WIDTH);
    expect(byId.get('x')!.flow_x).toBeLessThan(byId.get('a')!.flow_x);
  });

  it('未定列は日付帯全体の高さに対して縦中央に配置される', () => {
    const items = [
      makeItem({ id: 'a', due_date: '2026-08-16', meta: { flow_x: 300, flow_y: 0 } }),
      makeItem({ id: 'b', due_date: '2026-08-17', meta: { flow_x: 300, flow_y: 0 } }),
      makeItem({ id: 'x', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const placements = calculateDateGroupLayout(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    // 各帯は1行のみ→高さ= 1*110+60+20=190。帯2つで合計380。未定列も1行→高さ190
    // bandYStart = 0-60 = -60、undatedY = -60 + (380-190)/2 = 35、未定ノードのy = 35+60 = 95
    expect(byId.get('x')!.flow_y).toBe(95);
  });

  it('未定ノード同士に依存があれば依存元が上の行に置かれる', () => {
    const items = [
      makeItem({ id: 'a', due_date: '2026-08-16', meta: { flow_x: 300, flow_y: 0 } }),
      makeItem({ id: 'x1', meta: { flow_x: 0, flow_y: 100 } }),
      makeItem({ id: 'x2', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const placements = calculateDateGroupLayout(items, [dep('x1', 'x2')]);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('x2')!.flow_y).toBeGreaterThan(byId.get('x1')!.flow_y);
  });

  it('rowHeightオプションを渡すと未定列・帯どちらの行間隔にも反映される', () => {
    const items = [
      makeItem({ id: 'x1', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x2', due_date: '2026-08-16', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const placements = calculateDateGroupLayout(items, [], { rowHeight: 200 });
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(Math.abs(byId.get('x2')!.flow_y - byId.get('x1')!.flow_y)).toBe(200);
  });

  it('有効締切ありが0件でも未定列だけがy=0起点で配置される', () => {
    const items = [
      makeItem({ id: 'x1', meta: { flow_x: 0, flow_y: 0 } }),
      makeItem({ id: 'x2', meta: { flow_x: 0, flow_y: 0 } }),
    ];
    const placements = calculateDateGroupLayout(items, []);
    const byId = new Map(placements.map((p) => [p.itemId, p]));
    expect(byId.get('x1')!.flow_x).toBe(0 - 140 - 60 - NODE_WIDTH);
    expect(byId.get('x1')!.flow_y).toBe(60);
    expect(byId.get('x2')!.flow_y).toBeGreaterThan(byId.get('x1')!.flow_y);
  });
});
