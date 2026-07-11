# R-050 Phase1 バックエンド実装 引き継ぎ資料

**ブランチ**: `feature/R-050-phase1-assignee-view`（基点: master `ec5dfb0`）
**対象**: 画面2「担当者別ビュー」着手前提のバックエンド2点（管理者スコープ新設／assigned_to ID空間表示バグ是正）
**会議録**: `docs/kaigi/2026-07-09-R050テナント型AI中枢設計.md`
**仕様**: `docs/SPEC/04_データ設計.md` §5.3（アクセス制御）/ §3.8（assigned_to値域整理）

---

## 1. 新設したクエリパラメータ

### `GET /items`

既存の `scope` パラメータに **`scope=team`** を追加した。

| パラメータ | 必須 | 説明 |
|:--|:--|:--|
| `scope=team` | 必須 | 管理者向け担当者別ビューを起動する |
| `assigned_to=<id>` | 必須 | 取得したい担当者のID（`u_...` 形式 or `assignees.id` の整数） |

- 対象テナントは **JWTの `currentTenantId`**（会社コンテキストでログイン中のテナント）を使う。個人モード（`currentTenantId` が空）で呼ぶと `400 Company context required for scope=team`。
- `assigned_to` を省略すると `400 assigned_to is required for scope=team`。
- 取得条件: `items.tenant_id = <currentTenantId> AND items.assigned_to = <assigned_to>`（`show_archived`/`show_trash` フィルタは既存 `filterClause` を流用）。

### `GET /today`

同じ **`scope=team` + `assigned_to=<id>`** の組を追加。指定時は、既存の「個人アイテム OR 担当者=自分 OR 作成者=自分」フィルタを丸ごと `items.tenant_id = <currentTenantId> AND items.assigned_to = <assigned_to>` に置き換える。`project_id` によるプロジェクトフォーカスとの併用は未検証（Phase1スコープ外、必要なら別途確認すること）。

### 呼び出し例

```
GET /api/items?scope=team&assigned_to=u_697b2af132f4f
GET /api/today?scope=team&assigned_to=u_697b2af132f4f
```

---

## 2. 権限判定ロジック（`BaseController::assertAdminScopeAllowed()`）

`ItemController.php` と `TodayController.php` の両方から共通で呼び出す。

1. `assigned_to === currentUserId`（本人分の指定）なら常に許可（＝誰でも自分の担当分は `scope=team` 経由でも見れる）。
2. 他者を指定する場合、**JWTペイロードの `role` は信頼しない**。都度 `SELECT role FROM memberships WHERE user_id = ? AND tenant_id = ?` を実行し、`owner` または `admin` でなければ **403** `Access Denied: Admin scope requires owner/admin role`。
3. role チェックを通過しても、指定した `assigned_to` が対象テナントに実在しなければ **404** `Assignee not found in tenant`。
   - `u_` プレフィックス → `memberships` に `user_id = assigned_to AND tenant_id = <対象テナント>` の行があるか確認。
   - それ以外 → `assignees` に `id = assigned_to AND tenant_id = <対象テナント>` の行があるか確認。

デフォルト表示（`scope=team` を指定しない通常のリクエスト）は一切変更していない。既存の可視性ルール1〜3（個人タスク／会社タスク／プロジェクトフォーカス、いずれも「創建者=自分 OR 担当者=自分」）はそのまま。

---

## 3. assigned_to ID空間解決（`BaseController::resolveAssigneeInfo()`）

`mapItemRow()` に一元化した（各コントローラの個別JOINには依存しない）。全てのコントローラ経由のアイテムレスポンスで自動的に効く。

- `u_` プレフィックス → `users` テーブルから `display_name`（なければ `email`）を解決 → `assigneeKind: 'user'`
- それ以外 → `assignees` テーブルから `name`/`color` を解決 → `assigneeKind: 'assignee'`
- どちらにも一致しない（孤児データ）→ `error_log()` に `[R-050] orphaned assigned_to (...)：<値>` を出力し、`assigneeName: null` / `assigneeColor: null` / `assigneeKind: null`（「未割当」相当）を返す。
- `assigned_to` が空（NULL/空文字）の場合は通常の未割当として、ログを出さずに全て `null` を返す。

**パフォーマンス注記**: アイテム1件ごとにDB問い合わせが1回発生する（N+1）。今回のスコープでは意図的に許容している（藤田建具店1社・実データ規模が小さいため）。将来的にデータ量が増えた場合はキャッシュ化やJOINへの巻き戻しを検討すること。

---

## 4. レスポンスJSON例

### 正常系（`u_` 形式で正しく解決される場合）

```json
{
  "id": "item_xxx",
  "title": "見積り作成",
  "assignedTo": "u_697b2af132f4f",
  "assigneeName": "藤田晴樹",
  "assigneeColor": null,
  "assigneeKind": "user",
  "tenantId": "t_697b2af180467"
}
```

### assignees由来の担当者（整数ID形式）

```json
{
  "id": "item_yyy",
  "assignedTo": "3",
  "assigneeName": "外注業者A",
  "assigneeColor": "#4f46e5",
  "assigneeKind": "assignee"
}
```

### 未割当系（孤児データ or 本当に未割当）

```json
{
  "id": "item_zzz",
  "assignedTo": "u_697b2bfb28bee",
  "assigneeName": null,
  "assigneeColor": null,
  "assigneeKind": null
}
```

### エラー系

```json
// 非管理者が他者を指定
{ "error": "Access Denied: Admin scope requires owner/admin role" }  // HTTP 403

// 対象テナントに存在しないユーザー/担当者を指定
{ "error": "Assignee not found in tenant" }  // HTTP 404

// 個人モード（テナント未選択）で scope=team
{ "error": "Company context required for scope=team" }  // HTTP 400
```

---

## 5. 次のフロント実装Agentへの注意点

1. **`assigneeKind` は今回追加した新フィールド**。既存の `assigneeName`/`assigneeColor` は挙動そのままだが、値の解決元が変わった（以前は各SQLの `LEFT JOIN assignees` のみに依存しており `u_` 形式は常に `NULL` だったバグを修正済み）。フロント側で `assignedTo` の形式を独自判定していた箇所があれば `assigneeKind` に置き換えを検討すること。
2. **`scope=team` は必ず `assigned_to` とセットで渡すこと**。片方だけでは動かない（`ItemController` は400、`TodayController` は `assigned_to` がなければ従来のデフォルトスコープにフォールバックする＝黙って無視される点に注意）。
3. **管理者UIの表示制御はフロント側の責務のまま**。バックエンドは403/404を返すだけで、「管理者なら担当者チップを出す」といったUI分岐はフロントで行うこと（`GET /tenant/members` のレスポンスにある `role` を使う）。
4. 個人タスク（`tenant_id IS NULL`）は `scope=team` の対象外。担当者別ビューは会社コンテキスト限定である前提を崩さないこと。
5. `assigneeKind: 'assignee'` の担当者（`assignees` テーブル由来、外注等）は `scope=team&assigned_to=<整数ID>` でも同様に一覧取得できるが、権限チェックの「本人指定」判定（`assigned_to === currentUserId`）は文字列比較のため、整数IDが `currentUserId`（`u_...`形式）と一致することはない＝assignees由来の担当者を指定する場合は常に owner/admin 権限が必要になる。これは意図した挙動（assigneesは社内ユーザーではなく外注等の想定のため）。
6. 孤児データの実数調査（本番SQLiteの棚卸し）は本タスクでは実施していない。会議録の「次に確かめるべきこと」に記載の通り、別途 `SELECT assigned_to, COUNT(*) FROM items WHERE tenant_id IS NOT NULL GROUP BY assigned_to` 相当の集計を推奨する。

---

## 6. 変更ファイル

- `backend/BaseController.php`: `resolveAssigneeInfo()` / `assertAdminScopeAllowed()` を新設、`mapItemRow()` に組み込み
- `backend/ItemController.php`: `scope=team` ルーティング追加、`getMyItems()` に `team` 分岐を追加
- `backend/TodayController.php`: `getToday()` に `scope=team` 分岐を追加
- `backend/tests/test_admin_scope_assignee_view.php`: 新規TDDテスト（5ケース）

## 7. テスト結果概要

- 新規テスト: `php backend/tests/test_admin_scope_assignee_view.php` → Red確認後、実装後は 7 assertion 全てPASS（SUCCESS）
- 既存backendテスト: `test_cascade_operations.php`(47 passed) / `test_someday_status.php`(15 passed) / `test_today_sort_order.php`(3 passed) / `test_calendar_routing.php`(7 passed) / `test_created_at_mapping.php`(8 passed) / `test_project_title_fallback.php`(6 passed) / `test_reorder_focus_sort_order.php`(2 passed) いずれも回帰なし
- `feature_dashboard_scope.php` / `test_real_project_title_join.php`(1 failed) / `test_completed_at.php`(database is locked) は master（本ブランチ着手前）でも同一の挙動・失敗であることを `git stash` 比較で確認済み。本タスクの変更に起因しない既存の問題
- フロントエンドvitest: `npm.cmd run test -- --run` → 705 passed / 14 skipped / 0 failed（1件の unhandled error は `DecisionDetailModal` 関連の既存非同期テストで、本タスクの変更対象外）

---

## 8. Phase1完了状況とデプロイ判断への申し送り（2026-07-10時点）

以下がすべてmasterへマージ・push済み。

1. 本ドキュメントのバックエンド実装: `feature/R-050-phase1-assignee-view` ブランチ、マージコミット `322caf1`
2. フロントエンド実装（担当者別ビュー画面 `AssigneeViewScreen`）: `feature/R-050-phase1-assignee-view-ui` ブランチ、マージコミット `67e2586`
3. 実機検証（claude-in-chromeでブラウザ操作）で発見したバグ修正: `fix/R-050-phase1-tenant-account-admin-scope` ブランチ、マージコミット `ce65aa2`
   - 症状: 会社アカウント（テナント自身ログイン、`account_type=tenant`）で管理者スコープ切替が403になる
   - 原因: `BaseController::assertAdminScopeAllowed()` が `memberships` テーブルを `user_id=currentUserId` で検索するが、会社アカウントログイン時は `currentUserId` がテナントID自身で `memberships` に行がないため
   - 修正後、会社アカウント・ユーザーアカウント両方で200を確認、テナント分離（他テナントのID指定で404）も維持されていることを確認済み

これにより担当者別ビュー（画面2）はエンドツーエンドで動作する状態になっている。

**未実施事項**: 本番デプロイ（`upload.ps1`）はまだ実施していない。次回セッションで本番デプロイを判断する際は、上記3コミットがすべてmasterに含まれていること（`git log --oneline` で確認可能）を前提に、`docs/request_log.md` R-050エントリと `docs/SPEC/06_変更履歴.md`（2026-07-10エントリ）を最終状態の参照元とすること。
