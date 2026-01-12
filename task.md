# タスク管理 (JBWOS Refinement)

- [x] **Phase 1: Backend Intelligence (脳の構築)** <!-- id: 101 -->
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

- [x] **Phase 2: Frontend Dumb-ification (ビューア化)** <!-- id: 107 -->
    - [x] **Repository更新**: 新APIへの移行・直接DB更新の廃止 <!-- id: 108 -->
    - [x] **Store/ViewModel更新**: クライアント側ロジックの削除 <!-- id: 109 -->
    - [x] **横メモUI実装**: 控えめなパネル・ソートなし <!-- id: 114 -->
    - [x] **新UI仕様適用 (v3.1)**: <!-- id: 118 -->
        - [x] Today: 確認ボタン・開始ボタン削除・3ゾーン厳格化 <!-- id: 1181 -->
        - [x] GDB: 棚レイアウト・縦積み・詳細ビュー分離・納期隠蔽 <!-- id: 1182 -->

- [ ] **Phase 3: Execution & Life Persistence (事実の蓄積)** <!-- id: 110 -->
    - [ ] Life/Execution ログ記録APIの実装 <!-- id: 111 -->
    - [ ] **History画面作成**: 事実ログの表示 UI <!-- id: 112 -->

- [x] **ドキュメント整理・日本語化** <!-- id: 115 -->
    - [x] `JBWOS_Defined_Master.md` (v3.1) の策定 <!-- id: 116 -->
    - [x] `docs` フォルダの整理 (アーカイブ化) <!-- id: 117 -->
    - [x] 計画書の日本語化 (`implementation_plan.md`, `task.md`) <!-- id: 119 -->

# 完了タスク (Previous Work)
- [x] **初期UIリファインメント** <!-- id: 89 -->
    - [x] 純粋GDBの実装 (判断のみ) <!-- id: 91 -->
    - [x] Today画面の作成 (Execution分離) <!-- id: 93 -->
    - [x] ナビゲーション追加 <!-- id: 95 -->
