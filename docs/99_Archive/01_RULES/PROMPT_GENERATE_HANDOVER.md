# PROMPT: Generate Comprehensive Handover Documentation

このプロンプトは、現在の開発セッションから次のAI開発者へ、コードや既存ドキュメントだけでは伝わりにくい「暗黙知」「最新の仕様変更」「開発のコツ」を継承するためのドキュメント生成を指示するものです。

---
## あなたへの指示

あなたはプロジェクト「TateguDesignStudio (JBWOS実装版)」のリードエンジニアです。
現在、大規模な機能追加（JBWOS, Today画面, HealthCheck, Backup/Restoreなど）が完了し、次の担当者（AI）へ引き継ぎを行うタイミングです。

以下の手順に従って、**現状の仕様・設計・運用ノウハウを網羅した引き継ぎドキュメント (`docs/AI_HANDOVER_CONTEXT.md`) を作成・更新してください。**

### 1. 情報収集と分析
まず、以下のファイルや最近の変更を（必要なら `view_file` 等で）確認し、脳内モデルを最新化してください。
- `task.md` (完了したタスク、残タスク)
- `implementation_plan.md` (直近の実装計画と変更点)
- `backend/index.php` & `backend/.htaccess` (最新のルーティング・API仕様)
- `JWCADTategu.Web/src/features/jbwos` (新しい主要機能のソースコード)
- `docs/AI_DEVELOP_RULES/` (開発憲法・運用ルール)

### 2. 「未ドキュメント化」情報の抽出
コードには書かれているが、設計書 (`docs/`) にまだ反映されていない、または分散している以下の情報を言語化してください。

*   **現在の仕様・機能セット (Specification)**
    *   JBWOS (Global Board) の役割と「視覚的余白 (Visual Margin)」の概念
    *   Today画面の「Focus / Light / Life」ゾーン分けとフロー
    *   観測性機能 (Health Check, API Logging) の詳細
    *   バックアップ・復元機能のフロー（Frontend -> API -> SQLite置換）
    *   Inboxの「トースト通知」によるUX改善の意図

*   **基本設計・詳細設計 (Architecture)**
    *   開発環境(Vite proxy) と 本番環境(PHP/Apache) のハイブリッド構成と、`ApiClient` によるパス解決ロジック (`verify_and_start.ps1` vs `deploy.ps1`)
    *   DBスキーマの「自動マイグレーション」の仕組み (`db.php` / `getDB()`)
    *   HTTPメソッドオーバーライド (`X-HTTP-Method-Override`) を採用した背景（本番環境のWAF/制限対策）

*   **UI/UXのこだわり (Design Philosophy)**
    *   「やさしい救済 (Gentle Relief)」モーダルの挙動と哲学
    *   「量感カレンダー」のヒートマップ表示ロジック
    *   ドラッグ＆ドロップの挙動（Dnd-kit）と制約

*   **開発の流れ・注意点・コツ (Development Workflow & Tips)**
    *   **デプロイ**: `deploy.ps1` の自動化範囲と、アップロード後のキャッシュ問題への対処
    *   **デバッグ**: `localStorage.setItem('JBWOS_DEBUG', 'true')` によるAPIログの出し方
    *   **検証**: `Smart_Verification` (青い点、トースト等の目視確認ポイント)
    *   **既知の罠**: 本番環境での404（絶対パス問題 - 解決済みだが再発防止のため）、SQLiteの書き込み権限

### 3. ドキュメント作成 (`docs/AI_HANDOVER_CONTEXT.md`)
分析した情報を元に、Markdown形式でドキュメントを出力してください。
見出し構成の目安:
1.  **Project Status Overview** (現在の到達点と未実装機能)
2.  **Architecture & Environment** (環境差異と解決策)
3.  **Key Features & Implementation Details** (機能ごとの重要ロジック)
4.  **UI/UX Philosophy & Rules** (デザイン原則)
5.  **Development & Operation Guide** (開発・デプロイ・デバッグ手順)
6.  **Known Issues & Future Roadmap** (とくにQuantity Calendar等のDeferred項目)

---
**出力ファイル名**: `docs/AI_HANDOVER_CONTEXT.md` (既存の場合は更新、なければ新規作成)
**言語**: 日本語
**トーン**: エンジニア同士の実務的な引き継ぎトーン（明確、論理的、かつ背景への配慮があること）
