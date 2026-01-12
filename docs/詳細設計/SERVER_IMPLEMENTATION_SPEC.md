# サーバーサイド 詳細設計書 (MVVM & API)

## 1. MVVMアーキテクチャへのマッピング
現行の React MVVM 構成を維持しつつ、Repository層の実装を差し替えることでサーバー連携を実現する。

### 1.1 レイヤー構造
1.  **View (UI)**: `GlobalBoard.tsx`, `ItemCard.tsx` 等
    *   変更なし。ViewModel からの状態のみを描画する。
2.  **ViewModel**: `useJBWOSViewModel.ts`
    *   変更なし。ユーザー操作（追加・削除・移動）を Repository への命令に変換する。
3.  **Repository**: `JBWOSRepository.ts`
    *   **変更あり**: `Dexie.js` (IndexedDB) への依存を排除し、`ApiClient` を経由してサーバーAPIを叩く実装へ変更する。
4.  **Infrastructure (API Client)**: `src/api/client.ts` (新規)
    *   `axios` または `fetch` をラップした HTTP クライアント。
    *   エラーハンドリング、共通ヘッダー、タイムアウト設定を集約する。

## 2. データベース・スキーマ設計 (SQLite)

### 2.1 tables
#### `items` (タスク管理)
```sql
CREATE TABLE items (
    id TEXT PRIMARY KEY, -- UUID
    title TEXT NOT NULL,
    status TEXT NOT NULL, -- 'inbox' | 'ready' | 'doing' | 'done'
    memo TEXT,
    interrupt INTEGER DEFAULT 0, -- boolean 0/1
    created_at INTEGER, -- UNIX Timestamp
    updated_at INTEGER -- UNIX Timestamp
);
```

#### `system_logs` (AIデバッグ用)
```sql
CREATE TABLE system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    level TEXT, -- 'ERROR', 'WARN', 'INFO'
    message TEXT,
    stack_trace TEXT,
    created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
```

## 3. API インターフェース仕様
Base URL: `/api/v1`

### 3.1 Items API
| Method | Endpoint | Description | Payload Ex. |
| :--- | :--- | :--- | :--- |
| **GET** | `/items` | 全アイテム取得 | - |
| **POST** | `/items` | 新規作成 | `{ "title": "...", "status": "inbox" }` |
| **PUT** | `/items/:id` | 更新 | `{ "status": "ready" }` |
| **DELETE** | `/items/:id` | 削除 | - |

### 3.2 Debug API (Secret)
ヘッダー `X-AI-Debug-Secret` が必須。

| Method | Endpoint | Description | Response |
| :--- | :--- | :--- | :--- |
| **GET** | `/debug/logs` | ログ取得 | JSON array of logs |
| **POST** | `/debug/logs` | フロントログ送信 | `{ success: true }` |

## 4. エラーハンドリング方針
AIが自律的に修正できるよう、すべてのPHPエラー（Fatal含む）は JSON レスポンスとして返却する設定(`set_error_handler`)を行う。

例:
```json
{
    "error": true,
    "message": "Undefined variable $x in ItemController.php:20",
    "trace": [...]
}
```
