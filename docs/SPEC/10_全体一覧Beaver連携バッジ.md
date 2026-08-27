# 10. 全体一覧Beaver連携バッジ

- 要望: R-156（`docs/requests_log.md`）
- 前提: Y1（`docs/SPEC/07_Beaver連携.md`）・Y2（`docs/SPEC/08_Beaver連携Y2.md`）は無変更。既存の`useBeaverIntegration`/`useWorkPackageSummary`をそのまま利用する追加UIのみの仕様であり、同期・負荷計算ロジックには一切変更を加えない
- 対象画面: 全体一覧（`OverviewBoard.tsx` / `OverviewItem.tsx`、Newspaper View）

## 1. 背景・原文

2026-08-28 会話内発言原文（ローマ字入力）:
「soreto、zentaiitiran ni [ beavertorenkeisareteirupurojekutoda]toiukotogawakaruyouna bajjihyoujigahosii sikakuihaikeini B to kakareta tiisanaaikonn de ii medataseruhituyouhanai. renkeidetukuraretaseisikinahoudatoiunogawakaruyounisitai」

意訳: 全体一覧で「Beaverと連携されているプロジェクトだ」とわかるバッジ表示が欲しい。四角い背景に「B」と書かれた小さいアイコンでよい。目立たせる必要はない。連携で作られた正式な方だとわかるようにしたい。

`ProjectRegistryScreen.tsx`には既に`data-testid="beaver-badge"`のBeaverバッジ（「Beaver」テキスト表示、`docs/SPEC/08_Beaver連携Y2.md` §11）があるが、全体一覧（`OverviewBoard.tsx`/`OverviewItem.tsx`）のプロジェクトヘッダー行には同種の表示がない。

R-155「全体一覧ドラッグでプロジェクト移動」（`docs/SPEC/09_全体一覧ドラッグでプロジェクト移動.md`）とは独立した別要望として扱う（発注者判断2026-08-28）。

## 2. 目的

全体一覧のプロジェクト／サブプロジェクト／work_packageのheader行のうち、Beaver連携由来のものに、控えめな「B」バッジを表示し、「Beaver連携で作られた正規のコンテナである」ことを一覧上で識別できるようにする。

## 3. 表示仕様

- 見た目: 四角い背景に「B」の文字のみ。小さく、目立たせない（原文どおり）。既存`ProjectRegistryScreen.tsx`の`beaver-badge`（`text-[9px] font-bold px-1 rounded bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300`、テキスト「Beaver」）と近い視覚言語を踏襲しつつ、文字は「B」の1文字にする（全体一覧は行の情報密度が高いため、テキスト「Beaver」より短い表示が適切）
- 配置: `OverviewItem.tsx`のheader行、既存のFolder/FolderOpenアイコンとプロジェクトタイトルの間、またはタイトル直後（実装時に既存レイアウトを崩さない位置を選ぶ）
- `data-testid="overview-beaver-badge"`（`ProjectRegistryScreen.tsx`の`beaver-badge`とは別画面のため区別したtestidにする）
- 表示対象:
  - ルート案件（Beaverプロジェクトの直接リンクを持つheader）
  - Beaver由来work_package（`is_project=1`のitemでwork_packageリンクを持つheader）
  - 上記いずれにも該当しない通常の手動プロジェクト・手動サブプロジェクトには表示しない
- `missing_upstream`状態の警告表示（「Beaver側から消えています・要確認」）は本要望のスコープ外。既存どおり`ProjectRegistryScreen.tsx`側でのみ表示する。全体一覧のバッジは「連携されているか否か」の二値表示のみ
- `.env`未設定・overview取得失敗時（`overview === null`）は、Y1/Y2と同じ縮退方針を継続し、バッジを一切表示しない

## 4. 実装方針

- 新しいAPI・DBスキーマ変更は不要。既存の`useBeaverIntegration()`が返す`linkByProjectId`（ルート案件判定）と、既存の`useWorkPackageSummary(overview)`（work_package判定、`useBeaverIntegration.ts`に既存関数あり）をそのまま使う
- `OverviewBoard.tsx`で`useBeaverIntegration()`を呼び出し、`linkByProjectId`と`useWorkPackageSummary(overview)`の結果を`OverviewItem`へpropとして渡す
- `OverviewItem.tsx`のheader分岐で、`linkByProjectId.has(String(projectId))`または`workPackageSummary.has(String(projectId))`のいずれかが真なら`overview-beaver-badge`を表示する
- 既存のBeaver関連ロジック（同期・負荷計算・capacity）には一切触れない。表示のみの追加

## 5. スコープ外

- `missing_upstream`警告表示（既存`ProjectRegistryScreen.tsx`で対応済み、変更なし）
- バッジクリックによるBeaver詳細表示・遷移
- ホバーツールチップ以上の情報表示（必要なら`title`属性程度に留める）
- 同期・負荷計算ロジックの変更

## 6. 必須テスト

- ルート案件（Beaverリンクあり）のheader行にバッジが表示される
- Beaver由来work_packageのheader行にバッジが表示される
- 通常の手動プロジェクト・手動サブプロジェクトのheader行にはバッジが表示されない
- `missing_upstream`状態のリンクでも「連携されている」バッジ自体は表示される（警告バッジとは別物であるため）
- overview取得失敗（`.env`未設定含む）時は一切表示されない

## 7. 本番受け入れ確認

1. Beaver自動同期済みの案件を全体一覧で開き、header行に「B」バッジが表示されることを確認
2. 同案件のwork_package行にも「B」バッジが表示されることを確認
3. 手動プロジェクトの行にはバッジが表示されないことを確認
4. 表示のみの変更であり、ドラッグ移動・同期・負荷計算に影響がないことを確認（R-155実装後は、R-155のドラッグ操作と共存して問題ないことも確認）
