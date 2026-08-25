# Youkan — 現在のタスク

前セッション（R-125〜R-152、R-144除く）は本番反映済み。R-144は仕様確定・発注者指示で実装後日（F-57）。

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

## 次はY2以降だが、発注者指示によりここで停止（Y2には進まない）
