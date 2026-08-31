# Youkan — 現在のタスク

前セッション（R-125〜R-152、R-144除く）は本番反映済み。R-144は仕様確定・発注者指示で実装後日（F-57）。R-153〜R-157は前セッションで完了・本番反映済み（詳細は本ファイル下部）。

## R-0161 Beaver連携標準事務タスク（見積・請求の自動生成とcapacity算入） — 仕様確定・実装待ち（2026-08-31）

Beaver→Youkan連携の追加改善。要望原文・判断根拠: `docs/requests_log.md` R-0161行。仕様: `docs/SPEC/14_Beaver標準事務タスク.md`（正本）。Y1（`07_Beaver連携.md`）・Y2（`08_Beaver連携Y2.md`）は無変更で継承。**Y3には進まず本機能完了で停止**（発注者指示）。

事前調査で確定した事実（仕様書§3・§6に反映済み）:
- Beaver baseline/work_packagesは`factory`/`site`（生産工数）のみで構成され、見積・請求工数は含まれない → baselineとの二重計上の心配なし
- 既存`BeaverCapacityService.php`は除外ステータス（納品済等）時にbaselineのみ0化し、末端タスク（`children_sum`）はそのまま残す設計 → **同ファイルへのコード変更は不要**

実装スコープ（Codexへ委譲想定・TDD）:
- [ ] Phase 4: 実装
  - [ ] `backend/db.php`: `generated_task_links`テーブル新設（仕様書§4.1）
  - [ ] `backend/.env.example`等: `BEAVER_STANDARD_ESTIMATE_MINUTES`（既定60）・`BEAVER_STANDARD_INVOICE_MINUTES`（既定30）追加、`CryptoService::loadEnvKey()`パターンで読み込み
  - [ ] `backend/services/BeaverSyncService.php`: `upsertProject()`内で標準タスク（見積・請求）生成ロジック追加（§5.1・§5.2）。新規案件作成時・既存案件への後追いバックフィルの両方に対応
  - [ ] 同ファイル: Beaverステータス連動によるstatus自動遷移ロジック追加（§5.3、単調前進のみ・見積todo→done/cancelled、請求pending→todo→done/cancelled）
  - [ ] `backend/services/BeaverCapacityService.php`: **変更しない**（仕様書§6の結論どおり。誤って触った場合はY1/Y2回帰を必ず確認）
  - [ ] 仕様書§10の18項目をTDDでカバーする新規テストファイル追加
- [ ] Phase 5: 指揮AIによるレビュー（diff確認・テスト再実行）・マージ
- [ ] 本番デプロイ・実機検証（仕様書§12、9項目）。検証用データは終了後に削除・復元
- [ ] 完了報告（要望原文の完了報告フォーマットに従う: R-ID・仕様書パス・標準タスクのデータ表現・identity規則・見積/請求の標準工数・capacity算入ルール・二重計上防止方法・not_ready/activeの表現・Beaver status連動・納品済/請求済時の挙動・本番検証結果・回帰テスト結果・今後のテンプレート拡張余地）
- [ ] 完了後はY3には進まず停止

## R-0160 Beaver連携: 案件→Youkanプロジェクトの直リンク解決API — 実装完了・マージ待ち（2026-08-31）

Beaverリポジトリからの要望（`docs/requests_log.md` R-0160行）。仕様: `docs/SPEC/13_Beaver連携プロジェクトURL.md`（正本）。実装はCodexへ委譲、指揮AIが再実行して裏取り済み。

- [x] Phase 1-3: Beaver側からの要望受領・実現可能性調査・仕様確定
- [x] Phase 4: Codexへ実装を委譲（TDD、`IntegrationController.php`へ`GET /beaver/project-link/{id}`追加、新規テスト`test_r0160_beaver_project_link.php`18件）
- [x] Phase 5: 指揮AIがテスト結果を再実行して裏取り（新規18/18 PASS、既存Beaver連携回帰4ファイル計149アサーション全PASS。全体スイートの既往失敗2件はYoukan既知バックログ`docs/requests.md`【低】項目と一致し本変更と無関係と確認）
- [ ] コミット・マージ（発注者確認待ち）

## R-158 フローチャート表示中モーダルの入力遅延調査 — 他要望へ統合（R-075）・完了（2026-08-29）

原文・仕様: `docs/requests_log.md` R-158行。Codexへ調査委譲した結果、同一事象は既にR-075（2026-08-12完了・本番検証済み）で対応済みと判明。現行masterに`SimpleModal.tsx`/`DecisionDetailModal.tsx`の`backdrop-blur-sm`削除が反映済みであることを指揮AIがコードで確認。追加実装なし。

- [x] Phase 1-3: 本番改善要望フォームからの発見・仕様確定
- [x] Phase 4: Codexへ調査委譲 → R-075と同一事象と判明、追加修正不要
- [x] Phase 5: 指揮AIが現行masterのコードで解消済みであることを確認、記録更新

## R-159 ステータス色の再調整 — 実装完了・マージ待ち（2026-08-29）

原文: `docs/requests_log.md` R-159行。仕様: `docs/SPEC/12_ステータス色の再調整.md`（正本）。実装はCodexへ委譲、ブランチ`feature/R-159-status-colors`。

- [x] Phase 1-3: 本番改善要望フォームからの発見・仕様確定
- [x] Phase 4a: Codexへ実装を委譲（初回、TDD、共通色ロジックを`statusUtils.ts`へ集約）
- [x] 仕様訂正: Codex初回実装は「あとでやる」＝`someday`と誤って判断しグレーへ変更。指揮AIが添付スクリーンショット（拡大確認）とコードの食い違いに気づき発注者へ確認 → 「あとでやる」は`todo`（後日着手）を指すと判明。`todo`=グレー、`someday`（いつかやる）=黄色に確定し仕様書訂正
- [x] Phase 4b: Codexへ再修正を委譲（`todo`/`someday`の色定義修正＋旧仕様テストアサーション訂正）
- [x] Phase 5a: 指揮AIがCodexの未コミット変更をレビューしコミット（`f3e891f`, `9e50a49`）。対象3ファイル31件・全体1340 passed/1 failed（既知の無関係flake）/14 skipped、`npx tsc --noEmit` 0エラーを確認
- [x] Phase 5b: マージ（`576cdba`、master push済み）・本番デプロイ（`upload.ps1`、稼働バンドル`index-Du7tH6gN.js`）・実機検証（claude-in-chromeでDOM走査、inbox=emerald・todo=slate・focus=blue・期限超過=roseを本番データで確認、コンソールエラーなし。someday=amberは該当データなしのため単体テストで代替確認）

## R-157 全体一覧ドラッグ範囲拡大 — マージ済み・デプロイ待ち（2026-08-29）

仕様: `docs/SPEC/11_全体一覧ドラッグ範囲拡大.md`（正本）。前提のR-155（`docs/SPEC/09_...md`）・R-156（`docs/SPEC/10_...md`）は無変更・不変条件を継承。

- [x] Phase 1-3: 要望記録・現行実装調査（`OverviewItem.tsx`のuseDroppable範囲・`OverviewBoard.tsx`のハイライトロジック・`hierarchy.ts`の`project`フィールド構造）・仕様確定
- [x] Phase 4: 実装（TDD、単一Agent、フロントエンドのみ）— `feature/R-157-overview-drag-range`（`8c540ee` Red→`691c25f` Green）
  - [x] `resolveGroupId`ヘルパー新設（`hierarchy.ts`、既存`project`フィールドから導出、新規型フィールド追加なし）
  - [x] `OverviewItem.tsx`: item行への`useDroppable`追加（id: `item-drop-${wrapper.id}`）、draggable/droppable ref合成（`setItemNodeRef`）、`dropHighlighted` prop導入とスタイル置換（header行はラベル維持、item行はハイライトのみ）
  - [x] `OverviewBoard.tsx`: `hoveredGroupId` state・`onDragOver`ハンドラ・`resolveHeaderWrapperFromOverId`（header-*/item-drop-*両対応）・`handleDragEnd`のoverId解決部分の変更・`dropDisabledByGroupId`の事前計算。`computeDragMoveOutcome`（dragMove.ts）は無変更で、item行ドロップもheader行ドロップと完全に同じ処理経路に合流
  - [x] テスト: `hierarchy.test.ts`（+5）・`useOverviewItems.test.ts`（+1）・`OverviewBoard.dragMove.test.tsx`（+4、onDragOverキャプチャ含む）
  - [x] 11番仕様書§7の全テスト項目Green
- [x] Phase 5: 全テストGreen確認・指揮AIによるコードレビュー（diff確認・テスト再実行で妥当性確認）・マージ
  - フロント1333 passed/1 failed（既知の無関係flake`useYoukanViewModel.capacity.test.tsx`の`shelf.active...`、R-157が触れたファイルを一切importせずmaster単体でも失敗する既存問題）/14 skipped、`npx tsc --noEmit` 0エラー
  - マージ: `feature/R-157-overview-drag-range`を`master`へマージ（`2e0afd8`、コンフリクトなし）・`git push origin master`成功（`9de4d4b..2e0afd8`）
- [x] 本番デプロイ・実機検証（11番仕様書§8、5項目）— `upload.ps1`実行、稼働バンドル`index-C5U2XOVs.js`。指揮AIがclaude-in-chromeで実施
  - 検証用データ（ルートプロジェクトA→サブプロジェクトB/B2→コアアイテムX/Y/Z、独立ルートC、ドラッグ元タスク）をAPI経由で作成し、実UIのdnd-kit経路（PointerEventをsrc要素・documentへ直接dispatch、`OverviewBoard.tsx`の実コードパスを通過）でドラッグを実行
  - (1) サブB配下のitem行「アイテムX」上にドロップ→サブBのheader行とitem行Xの両方に`data-drop-highlighted="true"`が同時に付与されることを確認（ハイライト範囲拡大） (2) ドロップ後、対象タスクの`parentId`=サブB・`projectId`=ルートA（API応答で確認）となり、親A・兄弟サブB2には一切ハイライト・移動が発生しないことを確認（サブプロジェクト境界の正しさ） (3) 工数(45m)・statusが移動前後で保持されることを確認 (4) 列数6の多列段組みで、ドラッグ元とドロップ先が数千pxの別列間に離れた状態でも正しく判定されることを確認（段組み環境での動作） (5) コンソールエラーなし
  - 検証データは`trash`→`destroy`で全8件完全削除し原状回復済み（削除後`remainCount:0`を確認）

詳細: `docs/requests_log.md` R-157行、`docs/SPEC/11_全体一覧ドラッグ範囲拡大.md`

## R-155 全体一覧ドラッグでプロジェクト移動 — 完了（2026-08-28）

仕様: `docs/SPEC/09_全体一覧ドラッグでプロジェクト移動.md`（正本）。原文: `docs/reference/vision/2026-08-28_全体一覧ドラッグでプロジェクト移動.md`。前提のY2仕様（`docs/SPEC/08_Beaver連携Y2.md`）は無変更・階層解釈を再利用。

- [x] Phase 1-3: 要望文書読み込み・現行実装調査（`hierarchy.ts`・`OverviewBoard.tsx`・`ItemController::update()`・`BeaverCapacityService`・`@dnd-kit`導入状況）・仕様確定
- [ ] Phase 4: 実装（TDD）
  - [x] バックエンド: `ItemController::update()` に `parentId` 変更時の循環参照チェック追加（自分自身・子孫への移動を400拒否）— `feature/R-155-drag-move-backend` `2bbe8d6`。新規ヘルパー`resolveDescendantIdsByHierarchyRule()`追加（既存`getAllDescendantIds()`はOR和集合でR-154同種の危険パターンのため流用せず）。新規テスト27アサーションGreen、Y1/Y2回帰Green
  - [x] フロントエンド: `OverviewBoard.tsx`/`OverviewItem.tsx` へ `@dnd-kit` 導入、`hierarchy.ts` に `resolveRootProjectId()` ヘルパー・新規`logic/dragMove.ts`（`computeDragMoveOutcome`）追加、ハイライト・Undo実装 — `feature/R-155-drag-move-frontend` `37b51e2`。新規テスト34件Green、全体1318 passed/1 failed（既知の無関係flake `useAssigneeView.test.ts`）、tsc 0
  - [x] 09番仕様書§12の全テスト項目（階層5・データ保持6・安全性5・Beaver/Y2 7・UI3）— フロント側`OverviewBoard.dragMove.test.tsx`でカバー、バックエンド側循環/テナントチェックは既存テストでカバー
  - [x] 質問事項: バックエンドのエラーメッセージ文言はフロントが汎用エラートースト表示のため個別文言依存なし、整合確認不要と判断
- [x] Phase 4.5: フロントエンドAgentからの逸脱報告のレビュー（下記参照、すべて承認）
- [x] Phase 4.6: R-156（Beaver連携バッジ）をR-155フロントエンドAgentへ継続依頼（同一ファイルのため）— `feature/R-155-drag-move-frontend` `b291dca`として完了
- [x] バックエンドマージ: `feature/R-155-drag-move-backend` を `master` へマージ（マージAgent、コミット`6b6baf3`）。全Beaver関連テストGreen
- [x] 指揮AIのdocsコミット（4件）とバックエンドマージ結果をローカルで統合しpush（`bdf527b`、コンフリクトなし、発注者承認済み）
- [x] フロントエンドマージ: `feature/R-155-drag-move-frontend`（R-155+R-156、最終`b291dca`）を`master`へマージ（マージAgent、コミット`346cc31`。コンフリクトなし、想定スコープと完全一致）
- [x] Phase 5: 全テストGreen確認（マージ後）— フロント1323 passed/1 failed(既知の無関係flake)/14 skipped、tsc 0、バックエンド`test_r155_parent_circular_guard.php` 27 passed/0 failed

### フロントエンドAgentからの逸脱・懸念事項（指揮AIレビュー待ち）

1. `useYoukanViewModel.updateItem()` の戻り値を`void`→`{success, error}`に変更（既存呼び出し元は戻り値未使用のため後方互換、全体回帰Green確認済み）。エラートースト表示に必須のため実施
2. 失敗時ロールバックは新規ロールバック機構を作らず、同じ`updateItem`で逆方向に呼び直す方式
3. 無効ドロップ先への禁止カーソル（SPEC§5「可能なら」の努力目標）は未実装。ハイライト抑制自体は実装・テスト済み
4. ハイライト色・Undoトースト文言はAgentの裁量選択（デザイン調整が必要なら指示可能）
5. アクセシビリティ代替（SPEC§10）: `DecisionDetailModal`に既存のプロジェクト選択UIがあるが、ルート案件選択のみでサブプロジェクト/work_package（parentId）選択はできない。仕様「なければ追加検討」に対し、Agentは「部分的に存在する」と判断し新規UIを追加せず報告に留めた（スコープ拡大回避を優先した妥当な判断）

- [x] 本番デプロイ・実機検証（09番仕様書§13、7項目全て✓）— `upload.ps1`実行、稼働バンドル`index-BmAS5jdl.js`。指揮AIがclaude-in-chromeでdnd-kit PointerEventを直接ディスパッチする実UI経路のドラッグを実施し、手動プロジェクト→Beaverルート案件・ルート案件→work_package「どあ」の2段階移動で`projectId`/`parentId`更新・工数保持・二重計上なし（510→540→510）・baseline非改変・再読み込み後の永続性を確認。検証データは`trash`→`destroy`で削除し原状回復済み
- [x] Y3へは進まず停止・報告（本メッセージが報告）

関連: 全体一覧Beaverバッジ表示要望はR-156として仕様化済み（本R-155のスコープ外。下記参照）

## R-156 全体一覧Beaver連携バッジ — 完了（2026-08-28）

仕様: `docs/SPEC/10_全体一覧Beaver連携バッジ.md`（正本）。新規API・DBスキーマ変更なし、既存`useBeaverIntegration`/`useWorkPackageSummary`を使う表示のみの追加。

- [x] Phase 1-3: 要望記録・現行実装調査（`ProjectRegistryScreen.tsx`のbeaver-badge・`useBeaverIntegration.ts`）・仕様確定
- [x] Phase 4: 実装（TDD）— `feature/R-155-drag-move-frontend` `b291dca`（R-155ブランチ上に継続実装）。新規テスト5件Green、全体1323 passed/1 failed（既知の無関係flake）、tsc 0
  - 既存の一部OverviewBoardテストで"Unhandled Rejection: Network unavailable in tests"ログノイズが35件増加（テスト結果自体はGreen。既存コードベースに元々あった同種ノイズと同性質。指示なしのため対応せず据え置き）
- [x] Phase 5: マージ（R-155と合わせて`346cc31`）・全テストGreen確認
- [x] 本番デプロイ・実機検証（10番仕様書§7、4項目全て✓）— DOM走査で本番上38件のバッジを確認（テスト案件・どあ×2・わく×2含む）、スクリーンショットでも視覚確認、手動プロジェクトには非表示、R-155のドラッグ操作と共存して問題なし

詳細: `docs/requests_log.md` R-155/R-156行、`docs/SPEC/09_全体一覧ドラッグでプロジェクト移動.md`、`docs/SPEC/10_全体一覧Beaver連携バッジ.md`

## Y3へは進まず停止（発注者指示、2026-08-28）

R-155/R-156完了により、全体一覧・Beaverバッジ表示・Y2負荷モデルは実運用可能な状態。Y3（プロジェクトバッファ・担当者別capacity simulation・仮配置・自動スケジューリング）は本タスクの完了を理由に自動着手しない。

## R-154 Beaver連携Y2（work_packages段階分解） — 完了（2026-08-28）

仕様: `docs/SPEC/08_Beaver連携Y2.md`（正本）。前提のY1仕様（`docs/SPEC/07_Beaver連携.md`）は無変更。

- [x] Phase 1-3: 要望記録・調査（既存capacity計算・ProjectRegistryScreen実装調査）・仕様確定
- [x] Phase 4a/4b: バックエンド・フロントエンド実装（worktree並行、TDD）
- [x] Phase 5: マージ（`444f3a8`）・全テストGreen
- [x] 本番デプロイ・実機検証（08番仕様書§13、6項目）
  - 実機検証中に二重計上バグを発見 → `fix/R-154-double-count`（`acd3588`）で修正 → `fbd1611`マージ・再デプロイ → 全6項目再検証しGreen確認
- [x] Y3への申し送り文書化（08番仕様書§14）

詳細: `docs/requests_log.md` R-154行、`docs/SPEC/06_変更履歴.md` 2026-08-27セクション

## R-153 Beaver連携Y1 — 完了（2026-08-26）

仕様: `docs/SPEC/07_Beaver連携.md`（正本）、契約: `docs/SPEC/R-153_capacity_check_api_contract.md`（確定版）

- [x] Phase 1-3: 要望記録・仕様確定
- [x] Phase 4a/4b: バックエンド・フロントエンド実装（worktree並行、TDD）
- [x] Phase 5: マージ（`e3ba29f`・`adcf344`）・全テストGreen
- [x] 本番デプロイ・.env設定（BEAVER_API_BASE/BEAVER_API_TOKEN/BEAVER_TENANT_ID）
- [x] 本番実機検証8項目（うち1件バグ検出→修正→再デプロイ→再検証で解消。1件はBeaver側データ不足で検証不能）
- [x] capacity-check API契約書を確定版化、Beaver B2開発AIへ引き渡し可能な状態

詳細: `docs/requests_log.md` R-153行、`docs/SPEC/06_変更履歴.md` 2026-08-25セクション

## 残課題（別要望として記録済み・R-153のブロッカーではない）

- 既往テスト失敗4件の棚卸し（`docs/requests.md`、R-153とは無関係、masterで同一再現確認済み）
- プロジェクト一覧の日付表示「Invalid Date」（`docs/requests.md`、2026-08-26発見）
- CORSヘッダー重複（`docs/requests.md`、2026-08-26発見）
- 旧Beaver連携要望2件は統合せず据え置き（B2/B3-Y2着手時に再評価、発注者判断2026-08-26）

## Y2完了後はY3へ進まず停止（発注者指示、2026-08-27）
