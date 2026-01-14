# JBWOS Frozen v3 実装計画 (Phase 3: Execution & Life Persistence)

## 目的
JBWOSの第3フェーズとして、**「事実の蓄積 (Persistence)」** と **「経営判断の基盤 (Accounting Base)」** を実装する。
Vision Story で示された「夢と現実の統合」を実現するため、単なるログ機能を超え、プロジェクトごとの収支や実行時間を集計可能なデータ構造を構築する。

## 概要
- **Execution Layer**: 「やったこと」を時間（Duration）と共に記録する。
- **Project Context**: すべての活動を「プロジェクト（稼ぎ/夢）」に紐づけ、原価・粗利計算の基礎とする。
- **Life Layer**: 仕事以外の「生きた証」を簡単な操作で記録する。

---

## 2. データベース変更 (Schema Evolution)

### [NEW] `projects` テーブル
Vision Storyの実現に不可欠な「プロジェクト」エンティティを作成する。

```sql
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    client_name TEXT,             -- 顧客名（またはコンテキスト名）
    gross_profit_target INTEGER,  -- 目標粗利 (Vision: "40万円欲しい")
    status TEXT DEFAULT 'active', -- active | archived
    color TEXT,                   -- カレンダー上での識別色
    created_at INTEGER
);
```

### [MODIFY] `items` テーブル
アイテムをプロジェクトに所属させる。

- `ADD COLUMN project_id TEXT DEFAULT NULL`

### [MODIFY] `daily_logs` テーブル
単純なテキストログから、集計可能な構造化データへ進化させる。

- `ADD COLUMN project_id TEXT DEFAULT NULL`
- `ADD COLUMN item_id TEXT DEFAULT NULL`
- `ADD COLUMN duration_minutes INTEGER DEFAULT 0` -- 実績時間
- `ADD COLUMN gross_profit_share INTEGER DEFAULT 0` -- (Future) その作業が生んだ価値？一旦保留

---

## 3. バックエンド実装 (`backend/`)

#### [NEW] `ProjectController.php`
- `GET /api/projects`: プロジェクト一覧取得（External View用）。
- `POST /api/projects`: 新規プロジェクト作成。

#### [MODIFY] `LifeController.php` -> `LogController.php` (Rename & Enhance)
- **記録機能の強化**:
    - `POST /api/logs/execution`: 完了時に `duration` と `project_id` を受け取るように修正。
    - `POST /api/logs/life`: 生活ログ記録。

#### [NEW] `HistoryController.php`
- **集計機能**:
    - `GET /api/history/summary?month=2026-01`: プロジェクトごとの稼働時間、完了アイテム数を集計して返す。
    - これが「今月の粗利予測」の基礎データとなる。

---

## 4. フロントエンド実装 (`JWCADTategu.Web`)

#### [NEW] `HistoryScreen` (Internal View)
- **Concept**: 「事実の積み上げ」を確認する場所。
- **UI**:
    - タイムライン形式で、その日にやったこと（Execution & Life）を表示。
    - 「今日はこれだけやった」という肯定感を醸成するデザイン。

#### [NEW] `ProjectRegistry` (External View)
- **Concept**: プロジェクトの登録・管理画面。
- **UI**:
    - プロジェクト名、目標粗利、色の設定。
    - 「夢系プロジェクト」もここで登録する。

#### [MODIFY] `GlobalBoard` / `ItemCard`
- **Doneアクション**:
    - アイテムをDoneにした際、オプションで「何分かかった？」を入力可能にする（必須にはしない）。
    - デフォルト値（予測時間）があればそれを提示する。

---

## 5. 検証手順 (Verification)

1.  **プロジェクト作成**: 「新作キャビネット（夢）」プロジェクトを作成できること。
2.  **ログ記録**: アイテムを実行し、完了時に「60分」と記録できること。
3.  **DB確認**: `daily_logs` に `project_id` と `duration_minutes` が正しく保存されていること。
4.  **History表示**: History画面で、「新作キャビネット」の作業ログが確認できること。

### 特別検証項目
- **Vision Story Check**:
    - 「夢のプロジェクト」を作成し、カレンダーやログ上で「仕事」と同列に扱えることを確認する。
