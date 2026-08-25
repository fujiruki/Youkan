# Youkan — 現在のタスク

前セッション（R-125〜R-152、R-144除く）は本番反映済み。R-144は仕様確定・発注者指示で実装後日（F-57）。

## R-153 Beaver連携Y1（仕様: `docs/SPEC/07_Beaver連携.md` 正本）

- [x] Phase 1-3: 要望記録・仕様確定（07_Beaver連携.md、R-153_capacity_check_api_contract.md、F-58、04/06更新、台帳記録）
- [x] Phase 4a: バックエンド実装（`feature/R-153-beaver-sync-backend` `2876d01`。テーブル・同期サービス・負荷モデル・EDF・API3本。PHP新規107件Green）
- [x] Phase 4b: フロントエンド実装（`feature/R-153-beaver-ui` `3e351a8`。ProjectRegistryScreen最小統合。新規9件Green）
- [x] Phase 5: マージ（`e3ba29f`・`adcf344`、競合なし）・全テストGreen・tsc 0・ビルド成功・push済み・worktree後片付け済み
- [x] Y1終了: capacity-check API契約書を確定版に更新（403追記）

## 残タスク（発注者判断待ち）

- [ ] 本番デプロイ（`upload.ps1`）＋本番 `.env` に `BEAVER_API_BASE`/`BEAVER_API_TOKEN`/`BEAVER_TENANT_ID` を設定（トークンはBeaver側 `YOUKAN_API_TOKEN` と同値。発行・共有は発注者経由）
- [ ] 契約書 `docs/SPEC/R-153_capacity_check_api_contract.md` をBeaver AI（B2実装者）へ引き渡し
- [ ] 旧Beaver連携要望2件（requests.md 2026-06-11／2026-08-12「youkanで開く」ボタン等）のR-153への統合可否確認
- [ ] Y2以降は着手しない（発注者指示）
