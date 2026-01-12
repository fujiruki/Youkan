# AI Debug API ガイド (`/debug/logs`)

## 1. 概要
本APIは、開発を担当するAIエージェントが、**バックエンド（PHP/SQLite）の状態やエラーを「自らの目」で確認し、自律的にデバッグを行うための専用インターフェース**です。
通常、AIはブラウザ上のUIしか見ることができませんが、このAPIを通じてサーバーサイドのログやシステム情報に直接アクセスし、"500 Internal Server Error" 等の原因究明を迅速に行うことを目的としています。

## 2. エンドポイント仕様

### `GET /debug/logs`
サーバーの直近のエラーログやシステム情報をJSON形式で返します。

**リクエスト例:**
```bash
curl http://localhost:8000/debug/logs
```

**レスポンス例 (JSON):**
```json
{
  "php_error": [
    "[12-Jan-2026 14:00:00] PHP Fatal error:  Uncaught Error: Call to undefined function..."
  ],
  "system": {
    "php_version": "8.2.12",
    "server_software": "PHP 8.2.12 Development Server",
    "timestamp": "2026-01-12 14:15:00",
    "sqlite_path": "jbwos.sqlite"
  }
}
```

## 3. 設計思想: "Self-Correction" (自己修復)
この機能は、AI開発における **"Observability for Agents"（エージェントのための可観測性）** の概念に基づいています。

- **Direct Feedback**: AIが推測に頼らず、事実（ログ）に基づいて修正を行えるようにする。
- **Autonomy**: ユーザーにログの提示を求めなくても、AIが能動的に調査を開始できる。
- **Safety**: 読み取り専用（ReadOnly）であり、システムの状態を変更しない安全な調査手段。

## 4. AIによる活用フロー
1. ブラウザテストでエラー（500など）を検知。
2. すかさず `http://localhost:8000/debug/logs` にアクセス。
3. レスポンスのJSONを解析し、エラーメッセージ（例: "SQL Syntax Error"）を特定。
4. 原因箇所を修正し、再度テストを行う。

## 5. 技術詳細
- **Controller**: `backend/DebugController.php`
- **Routing**: `backend/index.php` (正規表現によるパスマッチング)
- **Security**: 現在は開発環境（localhost）専用として開放。本番環境にデプロイする際は `Basic Auth` またはIP制限をかけることを推奨。
