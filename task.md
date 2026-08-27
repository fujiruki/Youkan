# Youkan — 現在のタスク

前セッション（R-125〜R-152、R-144除く）は本番反映済み。R-144は仕様確定・発注者指示で実装後日（F-57）。

## R-155 全体一覧ドラッグでプロジェクト移動 — 実装中

仕様: `docs/SPEC/09_全体一覧ドラッグでプロジェクト移動.md`（正本）。原文: `docs/reference/vision/2026-08-28_全体一覧ドラッグでプロジェクト移動.md`。前提のY2仕様（`docs/SPEC/08_Beaver連携Y2.md`）は無変更・階層解釈を再利用。

- [x] Phase 1-3: 要望文書読み込み・現行実装調査（`hierarchy.ts`・`OverviewBoard.tsx`・`ItemController::update()`・`BeaverCapacityService`・`@dnd-kit`導入状況）・仕様確定
- [ ] Phase 4: 実装（TDD）
  - [ ] バックエンド: `ItemController::update()` に `parentId` 変更時の循環参照チェック追加（自分自身・子孫への移動を400拒否）
  - [ ] フロントエンド: `OverviewBoard.tsx`/`OverviewItem.tsx` へ `@dnd-kit` 導入、`hierarchy.ts` に `rootProjectIdOf()` ヘルパー追加、ハイライト・Undo実装
  - [ ] 09番仕様書§12の全テスト項目（階層5・データ保持6・安全性5・Beaver/Y2 7・UI3）
- [ ] Phase 5: マージ・全テストGreen確認
- [ ] 本番デプロイ・実機検証（09番仕様書§13、7項目）
- [ ] Y3へは進まず停止・報告

関連: 全体一覧Beaverバッジ表示要望はR-156として仕様化済み（本R-155のスコープ外。下記参照）

## R-156 全体一覧Beaver連携バッジ — 仕様化済み（R-155フロントエンド完了待ち）

仕様: `docs/SPEC/10_全体一覧Beaver連携バッジ.md`（正本）。新規API・DBスキーマ変更なし、既存`useBeaverIntegration`/`useWorkPackageSummary`を使う表示のみの追加。

- [x] Phase 1-3: 要望記録・現行実装調査（`ProjectRegistryScreen.tsx`のbeaver-badge・`useBeaverIntegration.ts`）・仕様確定
- [ ] Phase 4: 実装（TDD）— `OverviewBoard.tsx`/`OverviewItem.tsx`がR-155フロントエンドAgentと同一ファイルのため、そのAgent完了後に継続依頼する
- [ ] Phase 5: マージ・全テストGreen確認
- [ ] 本番デプロイ・実機検証（10番仕様書§7、4項目）

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
