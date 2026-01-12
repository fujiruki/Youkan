# システム改良実装計画 (JBWOS Refinement Plan)

## 概要
現在のMVP実装を「憲法」および「システム定義書 (v3.1)」に適合させるための改修計画。
現在は見た目が分離されている（GDB/Today）だけで、論理的にはバックエンドの知能が欠如しており、フロントエンドが過剰に賢い状態である。これを是正する。

## 現状のギャップと違反

### 1. [違反] バックエンドの「判断」ロジック欠如
- **現状**: バックエンドは単純なCRUD（Itemsテーブルのみ）。
- **あるべき姿**: バックエンドがRDD計算、Today候補選出、イベント永続化を行う（`API境界設計`準拠）。
- **リスク**: フロントエンドへのロジック流出により、「判断疲れ」ロジックがUIに混入する。

### 2. [欠落] イベント駆動アーキテクチャ
- **現状**: 直接的な状態変更（UI -> DB更新）。
- **あるべき姿**: UI -> イベント発火 (`DecisionConfirmed`) -> ハンドラ -> 状態更新。
- **仕様**: `イベント駆動設計_最終固定.md`

### 3. [不完全] 実行と生活の永続化
- **現状**: LifeはLocalStorageで揮発。Executionはステータスフラグのみ。
- **あるべき姿**: Life/Executionは `history`（または専用ログテーブル）に記録され、「静かな歴史」として残る必要がある。

---

## 段階的実装計画

### Phase 1: Backend Intelligence (脳の構築)
**目標**: ロジックをフロントエンドからバックエンドへ移動し、専用APIを提供する。

1.  **DBスキーマ更新 (SQLite)**
    - `events` テーブル追加 (id, type, payload, created_at)。
    - Itemsテーブルに `rdd_calculation` カラム/テーブル追加。
    - `daily_logs` テーブル追加 (History用)。
    - **[NEW] `side_memos` テーブル追加** (id, content, created_at)。

2.  **API実装 (PHP)**
    - `POST /api/decision/{id}/resolve`: イベントを記録し、RDD更新をトリガー。
    - `POST /api/today/commit`: Today候補を確定（サーバー側で最大2件チェック）。
    - `GET /api/today`: Todayの*計算済み*ビューを返す (Commit + Execution + Life)。
    - `GET /api/gdb`: GDBに必要なアイテム*だけ*を返す。
    - **[NEW] 横メモ API**:
        - `POST /api/memo`: 作成。
        - `GET /api/memos`: リスト取得（作成順、検索・フィルタなし）。
        - `DELETE /api/memo/{id}`: 即時削除。
        - `POST /api/memo/{id}/move-to-inbox`: Inboxへの移動。

### Phase 2: Frontend Dumb-ification (ビューア化 & 楽観的UI)
**目標**: UIはサーバーを正解としつつ、**楽観的更新 (Optimistic UI)** により体感速度を維持する。

1.  **Repository更新**:
    - ステータス変更のための直接DB更新を停止。
    - 新しい意思表示API (`resolve`, `commit`) を使用。
2.  **Store/ViewModel更新**:
    - クライアント側での「最大2件」チェックを削除（サーバーが拒否すべき）。
    - ステータスフィルタリングロジックを削除（APIがフィルタ済）。
3.  **イベントストリーム接続**:
    - (MVPではポーリング等で対応) 状態更新を反映。
4.  **[NEW] 横メモUI実装**:
    - **入口**: ヘッダーまたはToday隅の控えめなボタン。
    - **表示**: 単純なテキストリスト。日時なし、ソートなし。
    - **操作**: 「Inboxへ移動」または「削除」。編集なし。

#### [NEW] UI仕様の適用 (v3.1準拠)
- **TodayScreen**:
    - レイアウト: 縦3ゾーン構成。
    - Zone 1 (Commit): 最大2件。アクションは**「確認 (OK)」のみ**（承認ではない）。
    - Zone 2 (Execution): 実行中ブロック。**「開始」ボタンなし**（表示＝実行中）。アクションは「中断」「完了」のみ。
    - Zone 3 (Life): 独立したchecklist。
- **GDB (GlobalBoard)**:
    - レイアウト: **「棚」スタイル**（横カンバンではない）。
    - セクション: 今ここ(Active)、保留(Hold)、ログ(Log)。
    - レスポンシブ: PCは多段カラム（棚）、SPは縦一列（集中）。
    - **判断詳細ビュー**:
        - 一覧から分離したモーダル/画面。
        - **納期・RDDはここでのみ表示する**。
        - アクション: Yes / Hold / No。

### Phase 3: Execution & Life Refinement (事実の蓄積)
**目標**: 「生きた事実」を永続化する。

1.  **Life API**:
    - `POST /api/life/{id}/check`: 生活活動を `daily_logs` に記録。
2.  **Execution Block Logic**:
    - `POST /api/execution/{id}/start`: `daily_logs` に開始をマーク。
    - `POST /api/execution/{id}/pause`: 中断をマーク。
3.  **History UI**:
    - `daily_logs` から取得して表示する `HistoryScreen.tsx` の実装。

---

## 次のアクション
**Phase 1: Backend Intelligence** を開始する。
1.  スキーマ定義 (SQL)。
2.  `Resolve` および `Today` APIの実装。
