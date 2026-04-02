# Youkan

## Agent-フローView Phase1: データモデル+API
### タスク
- [x] タスク1: DBマイグレーション — item_dependenciesテーブル作成
  - [x] 1-1. マイグレーションファイル作成（backend/migrate_v27_item_dependencies.php）
  - [x] 1-2. db.phpのensureTablesにテーブル作成SQL追加
  - [x] 1-3. ローカルDBでマイグレーション実行・確認
- [x] タスク2: DependencyController — CRUD API
  - [x] 2-1. テスト作成（RED）
  - [x] 2-2. GET /dependencies 実装（アイテムIDで絞り込み可能）
  - [x] 2-3. POST /dependencies 実装（循環参照チェック含む）
  - [x] 2-4. DELETE /dependencies/:id 実装
  - [x] 2-5. router.phpにルーティング追加（index.phpに追加）
- [x] タスク3: フロントエンド型定義
  - [x] 3-1. types.tsにDependency型追加
  - [x] 3-2. APIクライアント関数追加（IDependencyRepository + DependencyRepository）
- [x] ビルド確認（tsc --noEmit + vite build）
