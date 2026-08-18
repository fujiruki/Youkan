# Youkan — R-127 実装タスク

**要望**: 要判断キュー「捌く」（R-126会議 採用案B）
**ブランチ**: `feat/R-127-review-sweep`
**実装担当**: Sonnet Agent（worktree隔離）
**仕様**: `docs/SPEC/02_機能仕様.md` F-26、`03_画面設計.md` §15、`04_データ設計.md` §3.2 preferences・§3.5 meta.declined、`05_技術設計.md` R-127節
**背景**: `docs/kaigi/2026-08-18-R126新しいYoukan構想.md`

## 絶対ルール
- 指揮AIはコードを編集しない。TDD（純粋関数はRed→Green）。ステップ単位で1コミット
- 面積を奪わない・動かない（フェードのみ）・3件で止まる・評価語なし・`decisionToStatus` 経由

## ステップ
- [ ] 1. `logic/reviewQueue.ts` `buildReviewQueue` ＋ `countDeclinedThisWeek`（テスト先行）
- [ ] 2. 判断の言葉: `users.preferences.judgment_phrases` の読み書き（Repository/API/バックエンドpreferences JSON）＋ `PersonalSettingsScreen` テキストエリア
- [ ] 3. `components/Review/ReviewSweep.tsx`（右下オーバーレイ、1/2/3/Esc、後日+7日、断った=cancelled+meta.declined、3件で完了ビュー、詳細を開く→既存モーダル）
- [ ] 4. `components/Review/ReviewPrompt.tsx`（1日1回、`localStorage['youkan_review_prompt_dismissed']`）
- [ ] 5. `YoukanHeader` 全体一覧ナビに件数バッジ（0で非表示）／全体一覧フィルタ「要判断」チップ
- [ ] 6. 全テスト・tsc、`06_変更履歴.md` Impact 追記、task.md 更新、完了報告
