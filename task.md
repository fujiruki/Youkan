# Youkan — R-125 実装タスク

**要望**: 状態`todo`（後日着手）追加・pending付帯情報（`pending_condition`/`review_date`）・`decision_hold`の`pending`統合
**ブランチ**: `feat/R-125-todo-status-pending-review`
**実装担当**: Sonnet Agent（worktree隔離）
**仕様**: `docs/SPEC/04_データ設計.md` §3.1/§4.1/§4.4/§4.4.1/§4.6、`03_画面設計.md` §3.2.1/§6.1.3、`05_技術設計.md`「todo状態・pending付帯情報の技術仕様（R-125）」、`02_機能仕様.md` F-02
**背景資料**: `docs/reference/vision/2026-08-18_youkan-status-design-discussion_chatgpt.md`

## 絶対ルール
- 指揮AIはコードを編集しない。実装・テスト・コミットはAgent
- TDD: 状態列挙・decisionToStatus・シェルフ分類・再確認判定はテストを先に書きRedを確認してから実装
- ステップ単位で1コミット。`npm.cmd run test -- --run` と `npx tsc --noEmit` を通してから完了報告

## ステップ

### 1. 型・ロジック（フロント）
- [x] `types.ts` `JudgmentStatus` に `todo` 追加、`Item` に `pendingCondition`/`reviewDate` 追加
- [x] `decisionResolution.ts`: `Decision` に `later` 追加、`later→todo`
- [x] `statusUtils.ts`: `STATUS_META.todo`（「後日着手」）、`isReviewDue(item, today)` 純粋関数
- [x] Repository層 snake/camel 変換に `pending_condition`/`review_date`（`BaseController::mapItemRow`でキャメルケース化。フロント→バックエンドはcamelCaseのまま`updateEntity`が受理するため追加変換不要）

### 2. バックエンド
- [x] `db.php` マイグレーション: `pending_condition`/`review_date` カラム追加、`UPDATE items SET status='pending' WHERE status='decision_hold'`
- [x] `ItemController.php` の許可カラム・更新に2フィールド追加
- [x] `DecisionController.php`: `later→todo`、`hold→pending`（`decision_hold`書き込み廃止）
- [x] `GdbController.php`/`CalendarController.php`/`TodayController.php` の status リストに `todo` 追加、`decision_hold` を `pending` 同等に（CalendarController/TodayControllerは既存ロジックが todo を自然に正しく扱うため無変更。詳細は完了報告の確認事項参照）

### 3. 表示・操作（全画面）
- [x] `getGdbShelf`（Cloud/Local両Repository）に `todo` バケット、`decision_hold`→`intent`
- [x] 状況把握: 「後日着手」バケット（Inboxの次）。Pendingバケットで再確認対象を先頭＋バッジ
- [x] 登録と集中: 左カラムに「後日着手」セクション（Inbox直下）。Pendingセクションで再確認対象を先頭＋バッジ
- [x] `DecisionDetailModal`: 「後日着手」ボタン、pending/inbox時に「何待ち？」「再確認日」欄、状態切替ボタン群に todo
- [x] 右クリックメニュー（`buildItemContextMenuActions`）・フローノード色（`FlowItemNode`）・ガント・カレンダー・全体一覧フィルタに todo
- [x] `QuantityEngine`: 今日のキャパから todo 除外、日付別集計は含む（除外はViewModelのitems合成側で実施。QuantityEngine自体は無変更、回帰テストで担保）
- [x] `hierarchy.ts` 等の状態ハードコード箇所の洗い出し（R-124のImpact一覧を起点に grep）

### 4. 検証・完了
- [x] 全テスト Green、tsc エラーなし
- [x] `docs/SPEC/06_変更履歴.md` R-125 の Impact に実装ファイル一覧を追記
- [x] 完了報告（変更ファイル・テスト結果・未解決事項）→ 指揮AIがレビュー → マージ → `/deploy`
