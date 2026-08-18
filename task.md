# Youkan — 現在のタスク（2026-08-18 後半）

## R-136 超過分パネル（完了・マージ待ち）
**ブランチ**: `feat/R-136-overdue-panel` ／ Sonnet Agent（worktree）
**仕様**: `02_機能仕様.md` F-55、`03_画面設計.md` §19、`04_データ設計.md` §3.5（meta.contacted_at）
- [x] 1. `logic/overdueGroups.ts`: 超過分抽出（R-128 `weekLoad.ts` の超過判定と同一）＋案件別グループ化＋並び（テスト先行、12件Green）
- [x] 2. `components/Review/OverduePanel.tsx`: 右下オーバーレイ、ブロック／行、納期入力（SmartDateInput、Enter）、「連絡した」トグル（テスト10件Green）
- [x] 3. `YoukanHeader` 週負荷1行をクリック可能に→パネル開閉（ReviewSweepと排他）
- [x] 4. 全テスト（184ファイル/1188テストGreen、既知許容の2 unhandled error除く）・tsc（エラーなし）、06 Impact記載済み、完了報告済み（マージ・デプロイは未実施）

## R-137 youkan_user 残存参照の整理
**ブランチ**: `fix/R-137-youkan-user-localstorage` ／ Sonnet Agent（worktree）
- [ ] 各箇所を `useAuth().user`（or 既存prop）に置換、回帰テスト、全テスト・tsc、06 Impact、完了報告

## R-125補遺 本番データ移行（デプロイAgent）
- [ ] 本番 `status='confirmed'` 2件を `focus` へ（事前に対象を一覧化して記録、UPDATE後に件数0確認）

## 掃除
- [ ] `.claude/worktrees/` のマージ済みworktree/ブランチ削除（`git worktree prune` 含む）
