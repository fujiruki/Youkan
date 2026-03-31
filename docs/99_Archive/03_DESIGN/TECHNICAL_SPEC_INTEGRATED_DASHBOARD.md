# JBWOS 公私統合ダッシュボード：技術詳細設計（MVVM/TDD）

## 1. アーキテクチャ構成 (MVVM)

### Model (Data Transfer Objects & Logic)
- **`UnifiedItem`**: 既存の `Item` に `companyName`, `projectTitle` を付加したデータ構造。
- **`CapacityModel`**: 公私合算の負荷（時間）を算出する純粋なロジック。
- **`RecommendationLogic`**: 「ふんわり推し」を決定するスコアリングロジック。

### ViewModel (`useDashboardViewModel.ts`)
- **State**:
    - `items: UnifiedItem[]` (統合されたフラットリスト)
    - `capacity: { used: number, limit: number }` (全人生の負荷)
    - `timeProgress: number` (0:00〜24:00の経過率)
    - `recommendedItemId: string | null` (ふんわり推し対象)
- **Computed Properties**:
    - `filteredItems`: 現在の表示モード（すべて/個人/会社別）に応じたフィルタリング。
- **Actions**:
    - `refresh()`: 全テナントからのデータ最新化。
    - `handleDecision(id, action)`: Triage（選別）のアクション。
    - `undo()`: 直前の操作の取り消し。

### View (React Components)
- **`DashboardScreen`**: ViewModelを購読し、リストを表示。
- **`SmartItemRow`**: 1行超高密度表示を担う。テキストの濃淡（濃：タスク名、淡：属性）を制御。
- **`HeaderProgressBar`**: 24時間プログレスを表示。
- **`DecisionDetailModal` (標準コックピット)**: 複雑な操作の入り口。

---

## 2. TDD (Test-Driven Development) 戦略

実装前に、以下の核心ロジックに対するテスト（Unit Test / Logic Test）を定義し、検証する。

### テストケース A: キャパシティ合算ロジック (`capacityCalculator.test.ts`)
- [ ] テナントA(4h) + テナントB(2h) + 個人(1h) = 合計 7h と表示されること。
- [ ] `non_working_hours` が設定されている場合、`limit` が 24h から差し引かれること。

### テストケース B: ふんわり推しロジック (`recommendationEngine.test.ts`)
- [ ] 納期（Due Date）が最も近いアイテムがスコア上位に来ること。
- [ ] 以前に詳細を開いた（Touch）履歴があるアイテムを優先すること。
- [ ] 既に完了したアイテム、Pendingのアイテムはレコメンド対象外となること。

### テストケース C: 時間プログレスバー (`timeUtils.test.ts`)
- [ ] 正午(12:00)において 50% を返すこと。
- [ ] 深夜(23:59)において ほぼ 100% を返すこと。

---

## 3. 実装のキモ：超高密度リストのCSS設計

「引き算」を実現するための具体的数値：
- **Row Height**: 28px 〜 32px (現在の半分〜2/3程度)。
- **External Margin**: 2px 0 (上下)。
- **Internal Padding**: 0 8px (左右)。
- **Font-Size**: 
    - Task Title: 14px (Normal/Semi-Bold)
    - Attributes (Company/Project): 10px 〜 11px (Thin/Gray-400)
- **Visual Noise**: 
    - 枠線(border)は原則 `none`。
    - ホバー時のみ `bg-slate-50` で行を強調。

---

## 4. データ統合 (Backend)
- `ItemController::getMyItems` で `JOIN memberships` を行い、ユーザーが権限を持つすべてのテナントをループしてデータを結合。
- パフォーマンス向上のため、1クエリで `tenant_id IN (...)` を使用して一括取得。
