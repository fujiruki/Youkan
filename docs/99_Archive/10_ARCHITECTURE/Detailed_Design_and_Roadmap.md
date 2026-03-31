# 詳細設計と開発ロードマップ (Detailed Design & Roadmap)

## 1. アーキテクチャ設計 (Architecture)

効率的な開発と保守性のために、以下のアーキテクチャパターンを厳守する。

### 1-1. フロントエンド (Frontend): MVVM + Repository
UIロジックと描画の分離を徹底し、テスト容易性を高める。

*   **View (React Components)**:
    *   描画のみに専念。`useEffect` でのデータフェッチや複雑な計算禁止。
    *   必ず `Custom Hook (ViewModel)` を使用してデータを取得・操作する。
    *   例: `FocusQueueList` (View) -> `useFocusQueue` (ViewModel)
*   **ViewModel (Custom Hooks)**:
    *   状態管理、バリデーション、APIコールのトリガーを担当。
    *   テスト対象の核となる部分。
*   **Repository (API Layer)**:
    *   Axios等の通信処理を隠蔽。
    *   `FocusRepository.fetchQueue()`, `FocusRepository.reorder(items)`

### 1-2. バックエンド (Backend): Clean Architecture (Layered)
*   **Controller**: リクエスト受付とレスポンス返却のみ。
*   **Service/UseCase**: ビジネスロジック（例: キャパ計算、循環参照チェック）。
*   **Model**: データベース操作（SQL）。

---

## 2. 実装計画 (TDD Strategy)

手戻りを防ぐため、**「ロジックのテストを先に書き、それが通るように実装する」** スタイルを推奨。

### Priority 1: 状態モデルの基盤 (Backend TDD)
1.  **Schema**: `focus_order`, `is_intent` カラム追加。
2.  **Model Test**: `ItemModel` の CRUD テスト作成。
3.  **Controller Test**: `ItemController.reorderFocus` エンドポイントのテスト作成。
    *   正常系: 順序が保存されるか。
    *   異常系: 存在しないIDを送った場合。

### Priority 2: Focus Queue Logic (Frontend MVVM)
1.  **ViewModel Test (`useFocusQueue.test.ts`)**:
    *   初期ロード時に `focus_order` 順でソートされているか。
    *   `reorder` 関数を呼んだ時、楽観的UI更新（画面上即座に反映）が行われるか。
    *   キャパラインロジック: `dailyCapacity` を超えたアイテムに `isOverCapacity` フラグが立つか。
2.  **View Implementation**:
    *   ViewModelを使ってリストを描画。
    *   Drag & Drop ライブラリ（`dnd-kit` 推奨）の組み込み。

---

## 3. 具体的な行動計画 (Action Plan)

次のAIが実行すべき工程表。

### Step 1: データベース移行とバックエンド (Backend Phase)
*   [ ] `migrate_v19_jbwos_core.php` の作成と実行。
*   [ ] `ItemController.php` に `reorderFocus` アクションを追加。
*   [ ] `UserController.php` に `updateActiveTask` アクションを追加。

### Step 2: フロントエンド基盤 (Frontend Logic Phase)
*   [ ] `src/features/core/jbwos/types.ts` に日本語UI定義と型を追加。
*   [ ] `src/hooks/useFocusQueue.ts` (ViewModel) を作成。
    *   `items` のフェッチ、ソート、キャパ計算ロジックを実装。
    *   **TDD**: テストを書いてからロジックを埋める。

### Step 3: UI実装 (Frontend UI Phase)
*   [ ] `DashboardScreen.tsx` の改修。
    *   既存の `Grid` レイアウトを廃止し、ドキュメント通りの `Single List` へ。
    *   `DayProgressBar` コンポーネント作成（Sky Gradient）。
    *   `FocusCard` コンポーネント作成（高密度、Not Todayボタン）。
*   [ ] `SideMemo` コンポーネントの実装（スライドイン/アウト）。

### Step 4: 統合と検証 (Integration Phase)
*   [ ] スマホとPCで同時にログインし、`Active Task` の同期を確認。
*   [ ] 「Not Today」ボタンを押してInboxに戻る挙動を確認。
*   [ ] 「キャパライン」が正しい位置（例：累積480分地点）に出るか確認。

---

## 4. 決まり事・注意点 (Rules)
*   **日本語UI**: ボタン名、ラベルは全て日本語（「完了」「先送り」等）にする。
*   **Judgment Free**: 赤字のエラーメッセージは避ける。システムエラー以外は、淡々と事実を表示するのみ。
*   **One Life**: 個人・会社をデータ構造上は分けても、ロジック上は「一人の人間」として扱う。
