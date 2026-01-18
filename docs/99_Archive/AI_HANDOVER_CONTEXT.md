# AI Handover Context - TateguDesignStudio (JBWOS)

## 1. Project Status Overview
**最終更新: 2026-01-14**

本プロジェクトは、JWCAD建具表作成Webアプリケーションに「JBWOS (Job Breakdown Structure Based Work Operating System)」という意思決定支援システムを統合するフェーズにあります。
直近の開発セッションでは、**観測性の向上 (Observability)**、**UXの改善 (Feedback)**、**データの永続性 (Persistence)**、および **量感の可視化 (Quantity Visualization)** に焦点を当てました。

### 実装済み・稼働中の主要機能
*   **JBWOS (Global Board)**: 「棚 (Shelf)」メタファーによるInbox/Project/Storageの視覚的管理。視覚的余白 (Visual Margin) を重視。
*   **Today画面**: Focus / Light / Life の3ゾーンによるタスク管理。
*   **Health Check**: ヘッダー上の青いインジケーター。PHPバックエンド/SQLiteの接続状態を可視化。
*   **Inbox Feedback**: アイテム投入時のToast通知および楽観的UI更新。
*   **Backup & Restore**: `.sqlite` ファイルのダウンロードおよびアップロードによる完全復元機能。
*   **Project Name Persistence**: 建具プロジェクト名の変更がIndexedDBに即時反映・永続化される修正。
*   **Quantity Calendar**:
    *   **Pressure Lines**: シングルクリックで、日付セルから関連アイテム（納期チップ）へSVG曲線を秒画。
    *   **Flash Items**: 関連アイテムの発光エフェクトによる因果関係の可視化。
    *   **Signs List**: ダブルクリックで詳細モーダルを表示。
*   **Debug Logging**: `localStorage.setItem('JBWOS_DEBUG', 'true')` による構造化APIログ出力。

---

## 2. Architecture & Environment

### Hybrid Environment (Vite Proxy vs Apache/PHP)
開発環境 (Localhost) と本番環境 (Production/ConoHa) でAPIのパス解決ロジックが異なります。これを `ApiClient` クラスで吸収しています。

*   **Localhost**: `verify_and_start.ps1` で起動。Viteのproxy設定により `/api` -> `localhost:8000` へ転送。
*   **Production**: `deploy.ps1` でデプロイ。`index.php` がフロントコントローラーとして機能。
    *   **重要**: Productionではアプリがサブディレクトリ (`/contents/TateguDesignStudio/`) に配置されるため、`ApiClient` は `window.location.pathname` を解析して動的に `API_BASE` (index.phpへの絶対パス) を構築しています。

### Database Migration
*   **SQLite**: `backend/jbwos.sqlite`
*   **Auto Migration**: `backend/db.php` の `initDB()` および `getDB()` 内で、カラム不足時に自動的に `ALTER TABLE` を発行するロジック (`migrate_v5_...` 等) を実装しています。DDLの手動実行は不要です。

### HTTP Method Override
本番サーバーのWAFや共有サーバーの設定により、`PUT` / `DELETE` メソッドが403/404エラーになる問題に対処済みです。
*   **Client**: `ApiClient` が `X-HTTP-Method-Override: PUT` ヘッダーを付与し、実際には `POST` で送信。
*   **Server**: `backend/index.php` がこのヘッダーを検知し、`$_SERVER['REQUEST_METHOD']` を書き換えて処理。

---

## 3. Key Features & Implementation Details

### Quantity Calendar (Interaction)
*   **Component**: `QuantityCalendar.tsx`
*   **Logic**:
    *   **Single Click (`onClick`)**: `pressureConnections` Stateを更新し、Framer MotionでSVGラインを描画。同時にチップに `ring` クラスを付与して発光させる。
    *   **Double Click (`onDoubleClick`)**: 詳細モーダル (`selectedSigns`) を開く。
    *   **SVG Layer**: `pointer-events-none` で最前面に配置し、座標計算には `getBoundingClientRect` を使用。

### Backup / Restore
*   **Frontend**: `BackupSettings.tsx` から `ApiClient.restoreDatabase(file)` を呼び出し。
*   **Backend**: `BackupController.php`。アップロードファイルを一時検証し、既存DBを `.bak` に退避してから置換する安全設計。
*   **注意**: このバックアップ対象は `jbwos.sqlite` のみです。ブラウザのIndexedDB (Dexie) に保存されている建具プロジェクトデータは含まれません。

---

## 4. UI/UX Philosophy & Rules

*   **Visual Margin (視覚的余白)**: 情報を詰め込みすぎず、ユーザーが「考えられるスペース」を残す。リストの不均等な配置や、GDBの空間設計に反映。
*   **Gentle Relief (やさしい救済)**: ユーザーの操作ミスや迷いに対し、攻撃的なエラーではなく、自然な誘導やUndo可能なフィードバック（Toast等）で応える。
*   **Quantity (量感)**: 数字ではなく「色（ヒートマップ）」や「線（圧力ライン）」で仕事量を直感的に伝える。モーダルを開く前に「なぜ忙しいのか」を感覚的に理解させる。

---

## 5. Development & Operation Guide

### Deploy Flow
1.  **Commit**: 変更をGitにコミット。
2.  **Deploy**: プロジェクトルートで `.\deploy.ps1` を実行。
    *   Frontendビルド (`npm run build`) -> アーカイブ作成 -> SCPアップロード -> 解凍 -> 権限設定 が自動で行われます。
    *   **注意**: デプロイ直後はブラウザキャッシュが強い場合があるため、動作確認時はスーパーリロード推奨。

### Debugging
*   **API Logs**: 本番環境でも以下をコンソールで実行すれば詳細ログが見れます。
    ```javascript
    localStorage.setItem('JBWOS_DEBUG', 'true')
    ```
    ログには `Status`, `Duration(ms)`, `Payload` が構造化されて表示されます。

### Verification (Smart Verification)
*   **Health Check**: 画面右上の青い丸。クリックして詳細（PHP ver, DB Item Count）が出るか。
*   **Persistence**: 建具プロジェクト名を変更し、一覧に戻って維持されているか。
*   **Interaction**: カレンダーをクリックして線が出るか。

---

## 6. Known Issues & Future Roadmap

*   **Dexie vs SQLite**: 現在、建具データ(Dexie)とJBWOSデータ(SQLite)が分離しています。将来的にはこれらを統合し、完全なサーバーサイド同期を実現する構想があります（`Server-Side Storage Discussion` 参照）。
*   **Calendar Modal**: モーダル内の「Edit」機能は未実装です。簡易表示のみ。
*   **Error Handling**: 重篤なDBエラー時のUIフォールバックはまだ簡易的です。

---
このドキュメントは、次のAIエージェントが「コンテキスト」として読み込むことで、即座にプロジェクトの深い理解を得られるように設計されています。開発開始時に必ず `docs/AI_DEVELOP_RULES/AI_DEVELOPMENT_CONSTITUTION...` と共に参照してください。
