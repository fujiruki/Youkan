# タスク管理 (JBWOS Refinement)

- [x] **フェーズ 1: Backend Intelligence (脳の構築)** <!-- id: 101 -->
    - [x] **DBスキーマ定義 (SQLite)** <!-- id: 103 -->
        - [x] `events` テーブル作成 <!-- id: 1031 -->
        - [x] `daily_logs` テーブル作成 <!-- id: 1032 -->
        - [x] `side_memos` テーブル作成 <!-- id: 1033 -->
        - [x] ItemsテーブルへのRDDカラム追加 <!-- id: 1034 -->
    - [x] **API実装 (PHP)** <!-- id: 104 -->
        - [x] `POST /api/decision/{id}/resolve` (イベント記録・RDD更新) <!-- id: 1041 -->
        - [x] `POST /api/today/commit` (Today候補確定・最大2件チェック) <!-- id: 105 -->
        - [x] `GET /api/today` (計算済みTodayビュー取得) <!-- id: 106 -->
        - [x] `GET /api/gdb` (GDB用アイテム取得・純化) <!-- id: 1061 -->
        - [x] **横メモAPI** (`GET`, `POST`, `DELETE`, `MoveToInbox`) <!-- id: 113 -->

- [x] **フェーズ 2: Frontend Dumb-ification (ビューア化)** <!-- id: 107 -->
    - [x] **Repository更新**: 新APIへの移行・直接DB更新の廃止 <!-- id: 108 -->
    - [x] **Store/ViewModel更新**: クライアント側ロジックの削除 <!-- id: 109 -->
    - [x] **横メモUI実装**: 控えめなパネル・ソートなし <!-- id: 114 -->
    - [x] **新UI仕様適用 (v3.1)**: <!-- id: 118 -->
        - [x] Today: 確認ボタン・開始ボタン削除・3ゾーン厳格化 <!-- id: 1181 -->
        - [x] GDB: 棚レイアウト・縦積み・詳細ビュー分離・納期隠蔽 <!-- id: 1182 -->

- [ ] **フェーズ 4: 未来ボード (Tomorrow Planning) & 名称変更** <!-- id: 120 -->
    - [ ] **インフラ整備** <!-- id: 121 -->
        - [ ] リネーム `JWCADTategu.Web` -> `JBWOS.Web` <!-- id: 1211 -->
    - [x] **フェーズ 1: 基盤とUI** <!-- id: 122 -->
        - [x] 休日/キャパシティ設定 (`Settings` モジュール) - 基本機能完了 <!-- id: 1221 -->
        - [ ] 祝日API連携・例外日設定（追加開発中）
        - [x] UIコンポーネント: `FutureBoard.tsx` (フリップ/遷移) <!-- id: 1222 -->
        - [x] Today画面からの遷移開始 <!-- id: 1223 -->
        - [x] キャパシティバーと在庫の山 (実データ) 表示 <!-- id: 1224 -->
        - [x] **実データ連携**: ストックとプランのStore統合 <!-- id: 1225 -->
        - [x] **ドラッグ＆ドロップ**: ストック・プラン間のアイテム移動 <!-- id: 1226 -->
        - [ ] 複数日スワイプビュー <!-- id: 1232 -->
    - [ ] **フェーズ 2: ロジックとインテリジェンス** <!-- id: 123 -->
        - [ ] 逆算ロジック (提案エンジン) <!-- id: 1231 -->

- [ ] **フェーズ 5: アーキテクチャ分離 (Core Separation)** <!-- id: 130 -->
    - [x] **フォルダ再構成** <!-- id: 131 -->
        - [x] `src/features/core` (JBWOS) の作成 <!-- id: 1311 -->
        - [x] `src/features/plugins/tategu` の作成 <!-- id: 1312 -->
    - [ ] **モジュール移行** <!-- id: 132 -->
        - [x] `jbwos` (Time/Tasks) を `core` へ移動 <!-- id: 1321 -->
        - [x] `planning` (FutureBoard) を `core` へ移動 <!-- id: 1322 -->
        - [x] `settings` を `core` へ移動 <!-- id: 1324 -->
        - [ ] Tategu固有コンポーネント(マスタデータ等)のプラグイン化 <!-- id: 1323 -->
    - [x] **建具プラグイン移行** <!-- id: 133 -->
        - [x] `components/Editor` を `plugins/tategu/editor` へ移動 <!-- id: 1331 -->
        - [x] `components/Catalog` を `plugins/tategu/catalog` へ移動 <!-- id: 1332 -->
        - [x] `JoineryScheduleScreen` & `ProjectListScreen` を `plugins/tategu/screens` へ移動 <!-- id: 1333 -->
        - [x] `domain` フォルダを `plugins/tategu/domain` へ移動 <!-- id: 1334 -->
        - [x] Tateguプラグインのインポート更新 <!-- id: 1335 -->

- [ ] **フェーズ 3: Execution & Life Persistence (事実の蓄積)** <!-- id: 110 -->
    - [x] **バックエンド実装** <!-- id: 1101 -->
        - [x] DBマイグレーション (Projects, Logs, Items) <!-- id: 1102 -->
        - [x] API: Projects (CRUD with Target/Color) <!-- id: 1103 -->
        - [x] API: Logs (Life & Execution) <!-- id: 1104 -->
        - [x] API: History (Summary & Timeline) <!-- id: 1105 -->
    - [x] Life/Execution ログ記録APIの実装 <!-- id: 111 -->
    - [x] **History画面作成**: 事実ログの表示 UI <!-- id: 112 -->
    - [x] **Project Registry画面作成**: プロジェクト管理 UI <!-- id: 113 -->
    - [x] **起動スクリプトの修正**: verify_and_start.ps1の堅牢化
    - [x] **ドキュメント再構成**: 整理とDOCS_OPS作成 <!-- id: 114 -->

- [ ] **フェーズ 3.5: セキュリティ強化 (ポストレビュー)** <!-- id: 120 -->
    - [ ] **Backend Security**: ItemController/ProjectControllerのクエリスコープ修正 <!-- id: 1201 -->
    - [x] **会社設定機能の実装** (Company Settings) <!-- id: 1204 -->
        - [x] Frontend: 設定画面のタブ化とUI実装 <!-- id: 12041 -->
        - [x] Frontend: プラグイン管理UIとFeature Flagロジック <!-- id: 12043 -->
        - [x] Backend: Tenantsテーブル拡張 (Configカラム) <!-- id: 12042 -->
    - [x] **ユーザー登録機能の実装** (Registration) <!-- id: 1205 -->
        - [x] Environment: デバッグデータ更新・ブランチ作成 <!-- id: 12050 -->
        - [x] Backend: AuthController拡張 (Type分岐) <!-- id: 12051 -->
        - [x] Frontend: 登録ポータル画面 (3 Entrances) <!-- id: 12052 -->
        - [x] Frontend: 個人事業主登録フォーム <!-- id: 12053 -->
    - [ ] **Manager Capacity View**: 量感のみ取得するAPIの実装 <!-- id: 1202 -->
    - [ ] **Security Verification**: アクセス権限の自動テスト <!-- id: 1203 -->

- [ ] **フェーズ 4.0: 量感カレンダー (Volume Calendar)** <!-- id: 160 -->
    - [x] **詳細設計**: ロジックとMVVM構成の定義 (`Detailed_Design_VolumeCalendar.md`)
    - [x] **Backend**: `memberships` テーブル拡張 (`is_core`, `capacity`) <!-- id: 161 -->
    - [x] **Backend**: `TenantController` API更新 (GET/PUT) <!-- id: 162 -->
    - [x] **Backend**: `CalendarController` API拡張 (GET) <!-- id: 162.5 -->
    - [x] **Frontend**: メンバー設定画面 (主力チェック・キャパ設定) <!-- id: 163 -->
    - [x] **Frontend Logic**: `AllocationCalculator` (TDD) <!-- id: 165 -->
    - [ ] **Frontend UI**: `VolumeCalendar` 画面実装 (MVVM) <!-- id: 164 -->

- [ ] **フェーズ 4.5: デザインと物語 (User Nuance)** <!-- id: 140 -->
    - [ ] **AI会議**: 明日の計画のストーリーとユーザーフロー <!-- id: 1401 -->
        - [ ] ストーリードキュメント作成 (`docs/design/Story_TomorrowPlanning.md`)
    - [ ] **ストーリーに基づくUI改善** <!-- id: 1402 -->
    - [ ] UI: 詳細な見積入力 (スクロール可能な日時 + 数値入力) <!-- id: 1403 -->
    - [ ] UI: モバイル用横メモ (スライドボタン) <!-- id: 1404 -->

- [ ] **メンテナンス: ロジック修正とテスト** <!-- id: 150 -->
    - [x] **Today画面ロジック** <!-- id: 151 --> ※ 2026-01-18 検証済み
        - [x] Fix: "Commit to Today" -> 閉じる/保存の挙動 <!-- id: 1511 -->
        - [x] Fix: "Complete" ボタンの挙動 (GDB/Log/Return?) <!-- id: 1512 --> - Today画面に留まり次タスク切り替え
        - [x] Fix: Today -> GDB -> Back ナビゲーションの一貫性 <!-- id: 1513 --> - 状態保持を確認
        - [x] **テスト追加**: Commit/Complete/Navigationの挙動検証 <!-- id: 1514 --> - ブラウザテスト実施
    - [x] **データ永続化** <!-- id: 152 -->
        - [x] Fix: 閉じる際の保存 (詳細モーダル) 全フィールド (見積等) <!-- id: 1521 -->
    - [x] **カレンダー表示** <!-- id: 153 -->
        - [x] Fix: 複数日背景色の描画 <!-- id: 1531 -->
    - [x] **API Resilience** <!-- id: 154 -->
        - [x] Fix: Backend接続 (Port 8000 & Proxy Config) <!-- id: 1541 -->

        - [x] Test: JBWOSRepository 単体テスト (Vitest) <!-- id: 1542 -->
    - [x] **Bug Fix**: プロジェクトフォーカス時のアイテム所属不具合
        - [x] Frontend: `App.tsx` / `DashboardScreen.tsx` での `tenantId` 伝搬
        - [x] Backend: `ProjectController` / `ItemController` の camelCase 対応と自動継承ロジック
        - [x] Fix: プロジェクトフォーカス作成時のタスク所属表示 (Backend JOIN不足対応)

- [ ] **フェーズ 5: Haruki Status Model Refactoring (思想の統一)** <!-- id: 170 -->
    - [x] **定義**: `STATUS_MODEL_HARUKI.md` の策定 <!-- id: 171 -->
    - [ ] **マイグレーション計画**: DB/Frontendの移行設計 (`implementation_plan_migration.md`) <!-- id: 172 -->
    - [x] **マイグレーション計画**: DB/Frontendの移行設計 (`implementation_plan_migration.md`) <!-- id: 172 -->
    - [x] **Frontend**: `types.ts` の厳格化 (5 Statuses) <!-- id: 173 -->
    - [x] **Backend**: DBマイグレーションスクリプト作成 & 実行 <!-- id: 174 -->
    - [x] **UI修正**: JBWOS / Today / FutureBoard のロジック更新 <!-- id: 175 -->

- [x] **ドキュメント整理・日本語化** <!-- id: 115 -->
    - [x] `JBWOS_Defined_Master.md` (v3.1) の策定 <!-- id: 116 -->
    - [x] API 500エラーの調査と特定 (ItemController.php での ManufacturingSyncService 読み込み漏れ)
- [x] 修正計画の策定 (implementation_plan.md)
- [x] ItemController.php の修正: `require_once` の追加
- [x] ItemController.php の修正: `UPDATE` クエリの `NULL` 安全化
- [x] ブラウザサブエージェントによる動作検証
- [x] 完了報告の作成 (walkthrough.md)
    - [x] `docs` フォルダの整理 (アーカイブ化) <!-- id: 117 -->
    - [x] 計画書の日本語化 (`implementation_plan.md`, `task.md`) <!-- id: 119 -->

# 完了タスク (Previous Work)
- [x] **初期UIリファインメント** <!-- id: 89 -->
    - [x] 純粋GDBの実装 (判断のみ) <!-- id: 91 -->
    - [x] Today画面の作成 (Execution分離) <!-- id: 93 -->
    - [x] ナビゲーション追加 <!-- id: 95 -->
