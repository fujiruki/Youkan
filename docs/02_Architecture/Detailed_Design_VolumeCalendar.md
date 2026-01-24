# 詳細設計書: Volume Calendar & Backwards Allocation

**作成日**: 2026-01-24
**目的**: 「早期完了のゲーム化」を実現するための「逆算割り当て」ロジックと、そのMVVM実装方針を定義する。

---

## 1. 核心コンセプト (Core Concept)

### 1.1 目的: 早期完了のゲーム化
*   **Backwards Allocation (後ろ詰め)**:
    *   タスクの作業時間を、**納期(Due Date)から現在に向かって** 遡って割り当てる。
    *   これにより、未来（納期直前）に「仕事の山（オレンジ）」が出現し、現在（手前）は「空白（緑）」となる。
    *   **ユーザーの行動変容**: 「今の緑（自由時間）」を食いつぶして、未来のオレンジを消しに行く感覚を作り出す。

### 1.2 ルール
*   **警告なし**: 容量オーバーしても赤くしない。ただ色が濃くなるだけ。
*   **判断の分離**: ここで「判断」はしない。あくまで「量の可視化」に徹する。

---

## 2. ロジック設計 (Logic)

### 2.1 Backwards Allocation Algorithm
クライアントサイド（ViewModel/Domain）で実行する計算ロジック。

**入力**:
*   `items`: アイテムのリスト（`estimated_minutes`, `due_date`, `status`）
    *   ※ `status` が `done`, `archive`, `decision_rejected` のものは除外済みであること。
*   `capacity`: 1日あたりの標準稼働時間（分）（例: 480分）
*   `holidays`: 休日リスト（オプション、今回は簡易実装として土日を考慮するか設定による）

**処理プロセス**:
対象アイテムごとに以下を実行：

1.  **残工数決定**: `remaining_minutes = item.estimated_minutes`
2.  **割り当て日ポインタ設定**: `current_date = item.due_date`
3.  **ループ処理** (`remaining_minutes > 0` の間):
    *   `current_date` が休日ならスキップ → 前日へ。
    *   その日の `allocation` = MIN(`remaining_minutes`, `capacity`)
    *   `remaining_minutes -= allocation`
    *   `daily_allocations[current_date] += allocation`
    *   `current_date` を1日前に戻す。

**例**:
*   タスクA: 16時間（960分）、納期: 金曜日
*   Capacity: 8時間（480分）
*   **結果**:
    *   金曜日: 480分
    *   木曜日: 480分
    *   水曜日: 0分（緑）

### 2.2 データプライバシー (Privacy Logic)
APIレベルでフィルタリングを行う（`Detailed_Design_Unified_Items.md`準拠）。

*   **APIレスポンス**:
    *   自社タスク: 詳細あり。
    *   他社/個人タスク:
        *   `title`: "予定あり (Private)" 等にマスク。
        *   `estimated_minutes`: **保持**（量感計算のため必須）。
        *   `due_date`: **保持**（逆算割り当てのため必須）。

---

## 3. アーキテクチャ設計 (Frontend MVVM)

### 3.1 Model (Domain)
*   **`AllocationCalculator` (Service/Utility)**:
    *   純粋関数として実装。テスト容易性を確保。
    *   `calculateAllocations(items, capacity, options) -> DailyLoadMap`

### 3.2 ViewModel (`useVolumeCalendarViewModel`)
UIの状態管理とロジックの呼び出しを担当。

*   **State**:
    *   `currentDate`: 表示中の年月。
    *   `items`: 取得したアイテムリスト。
    *   `dailyLoads`: 計算済みの「日毎の負荷量」。 `{ "2026-02-01": { minutes: 960, items: [...] } }`
    *   `isLoading`: 読み込み中。
    *   `targetMember`: 表示対象のメンバー（自分以外を見る場合）。
*   **Methods**:
    *   `loadData(year, month)`: APIからItemsを取得。
    *   `calculate()`: `items` と `targetMember.capacity` を用いて `AllocationCalculator` を実行。

### 3.3 View (`VolumeCalendarScreen`)
*   **Components**:
    *   `CalendarGrid`: カレンダー描画。
    *   `DayCell`: 日付セル。負荷量に応じた色分け（Traffic Lightではなく、JBWOS Orangeの濃淡）。
        *   Level 0 (0%): 透明/薄いグレー
        *   Level 1 (1-50%): 薄いオレンジ
        *   Level 2 (51-100%): 濃いオレンジ
        *   Level 3 (101%~): 非常に濃いオレンジ（茶色寄り）
    *   `LoadDetailModal`: セルクリック時に、その日の構成アイテムを表示。

---

## 4. API設計 (Backend)

既存の `CalendarController` を拡張または `VolumeController` を新設。
`Detailed_Design_Unified_Items.md` の `GET /calendar/load` を実装するが、
**「日毎の合計」ではなく「アイテムリスト」を返す** 形に変更する（クライアント側で柔軟な逆算ロジックを適用するため）。

### `GET /api/calendar/items`
*   **Query**:
    *   `start_date`: 範囲開始 (例: 2026-01-01)
    *   `end_date`: 範囲終了 (例: 2026-02-28)
    *   `target_user_id`: 対象メンバーID
*   **Response**: `Item[]`
    *   Privacy Masking 適用済み。

---

## 5. 実装ステップ (TDD Approach)

1.  **Logic Test**: `AllocationCalculator` の単体テスト作成（Jest/Vitest）。
    *   休日またぎ、キャパシティ超えアイテム、複数アイテム重複のケースを検証。
2.  **Logic Implementation**: `AllocationCalculator` の実装。
3.  **ViewModel Implementation**: API連携と計算ロジックの統合。Hookテスト。
4.  **View Implementation**: 分離されたコンポーネントとして実装。
