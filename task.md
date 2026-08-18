# Youkan — R-128 / R-129 実装タスク（並行）

## R-128 今週の残量1行と登録時の一言
**ブランチ**: `feat/R-128-week-load` ／ **担当**: Sonnet Agent（worktree）
**仕様**: `02_機能仕様.md` F-27、`03_画面設計.md` §16、`05_技術設計.md` R-128節
- [x] 1. `logic/weekLoad.ts` `calcWeekLoad`（テスト先行）
- [x] 2. `QuantityService::calcWeekLoad`（PHP、TSと同一フィクスチャで数値一致テスト）＋ `GET /quantity/week`
- [x] 3. `POST /items`・`POST /integrations/inbox`・`PATCH /items/{id}`（期限/目安変更時）応答に `week_load` 同梱
- [x] 4. `YoukanHeader` Reality ブロックを日本語1行に置換（不足時のみ赤）
- [x] 5. 登録・期限/目安変更直後の不足Toast（1回）
- [x] 6. 既存キャパ設定UIの実用性確認（不備は報告のみ）、全テスト・tsc、06 Impact追記、完了報告
  - 実用性所見: 「定休日・祝日設定（Advanced JSON）」欄はDBに保存されるが計算側から一切参照されず事実上機能しない。曜日パターン（表形式エディタ）も週の残量計算には反映されない。詳細はセッション完了報告を参照

## R-129 最遅着手日トークン
**ブランチ**: `feat/R-129-latest-start` ／ **担当**: Sonnet Agent（worktree）
**仕様**: `02_機能仕様.md` F-28、`03_画面設計.md` §17、`05_技術設計.md` R-129節
- [ ] 1. `logic/latestStart.ts` `getLatestStart`（テスト先行: 対象・除外・係数・期限超過は出さない）
- [ ] 2. `CapacityConfig.safetyFactor` ＋ 個人設定の数値入力（既定1.5）
- [ ] 3. 全体一覧 `OverviewItem`／ガント一覧タイトル列／`FlowItemNode` にトークン表示（行高さ不変、目安なしは `目安？`）
- [ ] 4. 飽和ガード（赤字10件）＋ 全体一覧フィルタ「着手遅れ」
- [ ] 5. 全テスト・tsc、06 Impact追記、完了報告

## 共通ルール
- 指揮AIはコードを編集しない。TDD。ステップ単位で1コミット。評価語禁止。マージ・デプロイは指揮AI経由
