# 詳細設計書: Unified Item Architecture (統合アイテム構造)

**作成日**: 2026-01-24
**目的**: 「タスク」と「プロジェクト」、そして「個人」と「会社」をシームレスに統合するための技術詳細定義。

---

## 1. データベース設計 (Schema Design)

### 基本方針
*   `projects` テーブルを廃止し、すべて `items` テーブルに統合する。
*   `project_type` カラムにより、そのアイテムが「タスク」なのか「プロジェクト（箱）」なのかを区別する。
*   **JSONカラム (`meta`)** を活用し、プロジェクト特有のプロパティ（見積設定、DXF設定など）を柔軟に格納する。

### Items テーブル更新定義

| カラム名 | 型 | 説明 | 備考 |
| :--- | :--- | :--- | :--- |
| `id` | TEXT | UUID (PK) | 変更なし |
| `tenant_id` | TEXT | 所属会社ID | **NULL = 個人タスク (Personal)** |
| `project_type` | TEXT | アイテムの種類 | `NULL`=タスク, `general`=一般PJ, `manufacturing`=製造業PJ |
| `assigned_to` | TEXT | 担当者User ID | **Grab機能の主役**。`create_user` (起案者) とは区別する。 |
| `created_by` | TEXT | 作成者User ID | |
| `parent_id` | TEXT | 親アイテムID | プロジェクト > タスク の階層構造を表現 |
| `title` | TEXT | タイトル | プロジェクト名とタスク名の共通項。2026/02のリファクタリングにより `name` から統合。 |
| `status` | TEXT | ステータス | `inbox`, `confirmed`, `today_commit`, `done` 等 |
| `meta` | TEXT | **JSON** | 拡張属性（後述） |
| `estimated_minutes` | INT | 見積時間 | |
| `created_at` | INT | 作成日時 | |
| `updated_at` | INT | 更新日時 | |

### Meta JSON 構造例

**製造業プロジェクト (`project_type: 'manufacturing'`) の場合:**
```json
{
  "client": "A工務店",
  "site_address": "東京都...",
  "gross_profit_target": 30, // 粗利率目標
  "dxf_config": { ... },     // CAD変換設定
  "color": "blue"            // UI表示色
}
```

---

## 2. APIロジック設計 (Backend)

### A. ProjectController の役割変更
これまでは `projects` テーブルを読んでいたが、今後は `items` テーブルを「フィルタリング」して返す役割になる。

*   **`GET /projects`**:
    *   Query: `WHERE tenant_id = ? AND project_type IS NOT NULL`
    *   (Company Mode): 指定された `tenant_id` の全プロジェクトを返す。
    *   (Personal Mode): `tenant_id IS NULL AND project_type IS NOT NULL AND created_by = Me` を返す。

### B. ItemController と Grab機能
*   **`PUT /items/{id}/assign` (Grab API)**:
    *   Payload: `{ "userId": "me" }`
    *   Logic: `assigned_to` を更新。
    *   Log: "User X grabbed task Y".

### C. Load Calendar (量感カレンダー)
*   **`GET /calendar/load`**:
    *   **入力**: `targetUserId`, `viewerTenantId` (閲覧者のコンテキスト)
    *   **ロジック**:
        1.  `assigned_to = targetUserId` の全アイテムを取得（完了未・Archive以外）。
        2.  アイテムごとにループ：
            *   IF `item.tenant_id == viewerTenantId`: 詳細をそのまま返す。
            *   ELSE (個人タスク or 他社タスク): タイトルを「予定あり (Private)」に置換し、時間（`estimated_minutes`）だけ残して返す。
        3.  日付ごとに時間を合計し、Heatmap用データを生成。

---

## 3. UI/UX 実装計画 (Frontend)

### A. サイドメニュー (Navigation)
フラット構造に変更。

```
- Dashboard (Unified)
- Today (Unified)
- Calendar (Load / Unified)
-----
[Projects]
- 🏠 個人: キッチン棚作り
- 🏢 A社: S邸新築工事
- 🏢 A社: K邸リフォーム
```

### B. ダッシュボード (Today)
*   **混在表示**: `useTodayProjects` フックを作成し、個人と所属会社のプロジェクトを並列取得。
*   **アイコン区別**:
    *   `item.tenant_id === null` → 🏠 アイコン
    *   `item.tenant_id !== null` → 🏢 アイコン

### C. プロジェクト詳細画面 (Project Detail)
*   **未割当タスクの表示**:
    *   Filter: `assigned_to` が `NULL` のタスクを「未割当(Unassigned)」セクションに表示。
*   **Grabボタン**:
    *   未割当タスクの横に「挙手（Grab）」ボタンを設置。

---

## 4. 移行手順 (Migration Step)

1.  **Backup**: 現在の `jbwos.sqlite` をバックアップ。
2.  **Schema Change**: `items` テーブルにカラム追加。
3.  **Data Migration**:
    *   既存の `projects` テーブルのレコードを読み出し、`items` テーブルに `project_type='general'` としてINSERT。
    *   子タスクの `parent_id` リンクが切れないように注意（UUIDならそのまま維持可能）。
4.  **Cleanup**: `projects` テーブル削除。

---

## 5. 今後の拡張性
この構造にすることで、「タスクをプロジェクトに昇格」機能は以下のSQL一発で実現できる。

```sql
UPDATE items SET project_type = 'general' WHERE id = ?
```

これで「着手したら大事になった」案件もスムーズに管理移行できる。
