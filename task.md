# Youkan — R-128 / R-129 実装タスク（並行）

## R-128 今週の残量1行と登録時の一言
**ブランチ**: `feat/R-128-week-load` ／ **担当**: Sonnet Agent（worktree）
**仕様**: `02_機能仕様.md` F-53、`03_画面設計.md` §16、`05_技術設計.md` R-128節
- [x] 1. `logic/weekLoad.ts` `calcWeekLoad`（テスト先行）
- [x] 2. `QuantityService::calcWeekLoad`（PHP、TSと同一フィクスチャで数値一致テスト）＋ `GET /quantity/week`
- [x] 3. `POST /items`・`POST /integrations/inbox`・`PATCH /items/{id}`（期限/目安変更時）応答に `week_load` 同梱
- [x] 4. `YoukanHeader` Reality ブロックを日本語1行に置換（不足時のみ赤）
- [x] 5. 登録・期限/目安変更直後の不足Toast（1回）
- [x] 6. 既存キャパ設定UIの実用性確認（不備は報告のみ）、全テスト・tsc、06 Impact追記、完了報告
  - 実用性所見: 「定休日・祝日設定（Advanced JSON）」欄はDBに保存されるが計算側から一切参照されず事実上機能しない。曜日パターン（表形式エディタ）も週の残量計算には反映されない。詳細はセッション完了報告を参照

## R-129 最遅着手日トークン（完了・2026-08-18）
**ブランチ**: `feat/R-129-latest-start` ／ **担当**: Sonnet Agent（worktree）
**仕様**: `02_機能仕様.md` F-54、`03_画面設計.md` §17、`05_技術設計.md` R-129節
- [x] 1. `logic/latestStart.ts` `getLatestStart`（テスト先行: 対象・除外・係数・期限超過は出さない）
- [x] 2. `CapacityConfig.safetyFactor` ＋ 個人設定の数値入力（既定1.5）
- [x] 3. 全体一覧 `OverviewItem`／ガント一覧タイトル列／`FlowItemNode` にトークン表示（行高さ不変、目安なしは `目安？`）
- [x] 4. 飽和ガード（赤字10件）＋ 全体一覧フィルタ「着手遅れ」
- [x] 5. 全テスト・tsc、06 Impact追記、完了報告
- マージ・デプロイは未実施（指揮AI経由待ち）

## 共通ルール
- 指揮AIはコードを編集しない。TDD。ステップ単位で1コミット。評価語禁止。マージ・デプロイは指揮AI経由

## R-131〜R-134 改善要望フォーム4件（1Agentで順に）
**ブランチ**: `feat/R-131-134-form-requests` ／ **担当**: Sonnet Agent（worktree）
- [ ] R-131 `DecisionDetailModal` Ctrl+Shift+H → 保留（テスト先行、入力欄内は無視）
- [ ] R-132 `FlowItemNode` todo配色を通常色に（テストで inbox と同一クラスを確認）
- [ ] R-133 `FlowItemNode` タイトル編集中の2回目クリックでキャレット位置（R-079回帰テスト維持）
- [ ] R-134 `ReviewPrompt` に「後で（1時間後）」＋snooze再表示＋Notification 1回、バッジtitle
- [ ] 全テスト・tsc、06 Impact追記、完了報告

## R-130 日次キャパ決定規則の一本化（完了・2026-08-18）
**ブランチ**: `fix/R-130-daily-capacity-unify` ／ **担当**: Sonnet Agent（worktree）
- [x] 1. `logic/capacity.ts` `getDailyCapacity`/`isHoliday` を F-11 の規則どおりに（曜日パターン反映）。テスト先行
- [x] 2. `QuantityEngine.calculateTotalCapacityForDate` の独自規則を削除し `getDailyCapacity` を呼ぶ（会社キャパ側の `profile.standardWeeklyPattern` 参照は現状維持）。既存テストGreen
- [x] 3. PHP `QuantityService::getDailyCapacityFromConfig`（および `calcWeekLoadForUser`）を同規則に。TS/PHP同一フィクスチャ一致テスト
- [x] 4. `PersonalSettingsScreen` の Advanced JSON 欄を削除、説明文追加
- [x] 5. 全テスト・tsc、06 Impact追記、完了報告
- [x] 6. 規則4見直し（指揮AI指示）: 「holidaysも曜日パターンも未設定なら土日は0」→「1〜3で決まらずその曜日が土日なら0」に変更。曜日パターンに平日しかない既存データでも土日は休みのまま（既知のリスクを解消）。TS/PHP両方修正・テスト追加、Red→Green
- マージ・デプロイは未実施（指揮AI経由待ち）
