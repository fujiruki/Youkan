# Youkan — 現在のタスク

前セッション（R-125〜R-152、R-144除く）は本番反映済み。R-144は仕様確定・発注者指示で実装後日（F-57）。

## R-154 Beaver連携Y2（work_packages段階分解） — 仕様確定・実装中

仕様: `docs/SPEC/08_Beaver連携Y2.md`（正本）。前提のY1仕様（`docs/SPEC/07_Beaver連携.md`）は無変更。

- [x] Phase 1-3: 要望記録・調査（既存capacity計算・ProjectRegistryScreen実装調査）・仕様確定
- [ ] Phase 4a: バックエンド実装（worktree、TDD）
  - `external_work_package_links` テーブル新設（`backend/db.php ensureTables()`）
  - `BeaverSyncService`: work_packages upsert（新規/更新/missing_upstream）を案件同期に統合
  - `BeaverCapacityService`: `computeLinkLoads()` を再帰的effective_total計算（08番仕様書§6）へ拡張。既存Y1テスト・レスポンス形式は無変更で通ること
  - `IntegrationController`: `/integrations/beaver/overview` に `work_packages` 配列を後方互換追加
  - **実装前に必須確認**: `ProjectController` の一覧クエリが `is_project=1` のwork_package itemを案件一覧に混入させないか（08番仕様書§3の注記）
- [ ] Phase 4b: フロントエンド実装（worktree、TDD）
  - `useWorkPackageSummary`（または`useBeaverIntegration`拡張）・`ProjectCard`へのwork_package行追加・`missing_upstream`バッジ
  - work_package配下への子タスク作成は既存`useSubtasks`パターンを流用（新規UI追加なし）
- [ ] Phase 5: マージ・全テストGreen（08番仕様書§12）
- [ ] 本番デプロイ・実機検証（08番仕様書§13、6項目）
- [ ] Y3への申し送り文書化（08番仕様書§14に既定事項あり、実装知見を追記）

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
