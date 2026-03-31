# 詳細設計：製造業統合とコンテキスト管理

このドキュメントでは、製造業プラグインと個人/会社のコンテキスト管理の実装に向けた、詳細な技術設計を定義します。
**※本フェーズでは実装は行わず、設計の確定のみを目的とします。**

## 1. データベース設計 (Schema)

### [NEW] `company_members` テーブル
会社の主力メンバーと、その日次キャパシティ（稼働可能時間）を管理します。

```sql
CREATE TABLE company_members (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    daily_capacity_minutes INTEGER DEFAULT 480, -- 1日あたりの標準稼働時間 (例: 8時間)
    is_core_member BOOLEAN DEFAULT TRUE, -- 主力メンバーフラグ
    FOREIGN KEY(tenant_id) REFERENCES tenants(id)
);
```

## 2. 会社量感カレンダーの計算ロジック

### キャパシティ (Capacity)
- **定義**: その日に出勤予定の「主力メンバー」の `daily_capacity_minutes` の合計。
- **計算方法**: `SELECT SUM(daily_capacity_minutes) FROM company_members WHERE tenant_id = ? AND is_core_member = TRUE`

### 予約状況 (Occupancy / Reservation)
- **定義**: その日に納期が設定されている `manufacturing_items` の製作時間 (`fab_minutes`) の合計。
- **計算方法**: `SELECT SUM(fab_minutes) FROM manufacturing_items mi JOIN items i ON mi.item_id = i.id WHERE i.tenant_id = ? AND i.due_date = ?`

### 混雑度 (Fullness Percentage)
- `(予約状況 / キャパシティ) * 100` (%) を、量感カレンダーの各日付セルに視覚的（色の濃さやバー）に反映します。

### Service Layer (Business Logic)
- **`ManufacturingSyncService`**:
    - アイテム更新時の双方向同期ロジック。
    - 製作物の納期変更時に、関連する現場作業の納期をチェック・警告する機能。
- **`ItemAutomationService`**:
    - プロジェクト作成時や成果物登録時のアイテム自動生成（Factoryパターン）。

### ViewModel (Presentation Logic)
- **`ProjectListViewModel`**:
    - `switchTab(tab: 'personal' | 'company')`: タブ切り替えとデータ取得。
    - `filteredProjects`: 選択中のタブと会社IDに基づいたプロジェクトリスト。
    - `createNewProject(data: MfgProjectInput)`: コンテキストに応じた新規作成処理。
- **`DashboardViewModel`**:
    - `dailyTotalFabricationTime`: 今日やるアイテムの製作時間合計。
    - `dailyTotalSiteTime`: 今日やるアイテムの現場時間合計。
    - `toggleStatusGrouping()`: 状態分類のON/OFF切り替え。

## 3. TDD 戦略 (Testing)

以下の具体的なテストケースを定義し、期待される動作をコード実装前に確定させます。

### テストケース例
1. **[会社ID継承]**:
   - `GIVEN` 会社ID 'A' を持つプロジェクトがある
   - `WHEN` そのプロジェクトにサブタスクを追加する
   - `THEN` 新しいサブタスクの会社IDは自動的に 'A' に設定される
2. **[予実集計初期化]**:
   - `GIVEN` 製造業項目を新規作成する
   - `THEN` 予定時間 (estimated) が実績時間 (actual) の初期値としてコピーされる
3. **[双方向同期]**:
   - `GIVEN` 製造業項目の納期を '2026-02-01' に変更する
   - `THEN` 紐付く `items` レコードの `due_date` も '2026-02-01' に自動更新される

## 4. UI/UX 設計案
- **コンテキスト・アウェア・モーダル**:
    - `activeContext` (Personal/Company) を監視し、表示を切り替える。
    - **製造業プラグイン特有**: 元請け、現場名、メモ、画像のアップロードフィールドを表示。
- **ソートセレクター**:
    - ヘッダー付近に「表示設定」メニューを配置。
