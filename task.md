# Youkan — 現在のタスク

前セッション（R-125〜R-152、R-144除く）は本番反映済み。R-144は仕様確定・発注者指示で実装後日（F-57）。

## R-153 Beaver連携Y1（仕様: `docs/SPEC/07_Beaver連携.md` 正本）

- [x] Phase 1-3: 要望記録・仕様確定（07_Beaver連携.md、R-153_capacity_check_api_contract.md ドラフト、F-58、04/06更新、台帳記録）
- [ ] Phase 4a: バックエンド実装（Agent委譲、ブランチ `feature/R-153-beaver-sync-backend`）
  - [ ] テストファースト: 同期冪等性・max(基準,分解済み)・未配置負荷・除外ステータス・縮退・キャパのフロント一致フィクスチャ
  - [ ] `external_project_links`/`external_sync_state` テーブル（db.php ensureTables）
  - [ ] Beaver同期サービス（HttpClient利用、diff/full、クールダウン120秒、upsert規則§5.2）
  - [ ] 負荷モデル§6＋EDFシミュレーション§7（QuantityService拡張）
  - [ ] `POST /integrations/beaver/sync`・`GET /integrations/beaver/overview`・`POST /integrations/beaver/capacity-check`
- [ ] Phase 4b: フロントエンド実装（Agent委譲、ブランチ `feature/R-153-beaver-ui`）
  - [ ] ProjectRegistryScreen最小統合（バッジ＋結論1行＋今すぐ同期ボタン、§9）
- [ ] Phase 5: レビュー・マージ・全テストGreen・tsc
- [ ] Y1終了: capacity-check API契約書を確定版に更新し、発注者へ報告して停止（Y2に進まない）

デプロイは発注者確認後（Y1指示には含まれない）。
