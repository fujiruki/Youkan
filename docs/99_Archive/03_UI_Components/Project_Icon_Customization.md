# Project Icon Customization (プロジェクトアイコンカスタマイズ)

## 目的
プラグインごとに固有のアイコンを設定できるようにし、ユーザーがプロジェクト一覧で視覚的に区別できるようにします。

## 実装概要
- **アイコンリソース**: `src/assets/icons/` に SVG/PNG を配置。
- **メタデータ**: `Project` インターフェースに `iconPath?: string` を追加。
- **UI**: `ProjectCreationDialog.tsx` にアイコン選択ドロップダウンを追加。
- **保存**: `iconPath` を DB（SQLite） の `projects` テーブルにカラム追加し、API (`POST /api/project`) で受け取る。
- **表示**: `ProjectListScreen.tsx` で `iconPath` があれば `<img src={iconPath} ...>` を表示、無ければデフォルトアイコン。

## 手順
1. `src/assets/icons/` に必要なアイコン画像を追加（例: `tategu.svg`, `furniture.svg`).
2. `src/features/core/jbwos/types.ts` の `Project` 型に `iconPath?: string` を追記。
3. `backend/migrate_v6_add_project_icon.php`（新規マイグレーション）で `projects` テーブルに `icon_path TEXT NULL` カラムを追加。
4. `ProjectCreationDialog.tsx` に `<select>` またはアイコンギャラリーコンポーネントを実装し、選択したパスを `iconPath` として送信。
5. `ProjectListScreen.tsx` で `iconPath` が存在すれば `<img src={iconPath}>` を表示。
6. テストケースを追加し、アイコンが正しく保存・表示されることを検証。

## テスト戦略
- **ユニットテスト**: `ProjectCreationDialog.test.tsx` でアイコン選択が `iconPath` に反映されるか確認。
- **統合テスト**: API エンドポイント `/api/project` に `iconPath` を含むリクエストを送り、DB に正しく保存されるか検証。
- **E2Eテスト**: プロジェクト作成フローを通し、一覧画面でアイコンが表示されることを確認。

> [!NOTE]
> アイコンはプロジェクトごとに 1 つだけ設定可能です。複数設定は将来的に拡張可能ですが、現在はシンプルに保ちます。
