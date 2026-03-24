# Morning Planning（朝の段取り）ビュー仕様書
作成日: 2026-03-24
バージョン: 1.0 (Draft)

## 1. 背景と課題

### 1.1 現状の問題
- focusステータスのタスク（commits）の`sort_order`が全て0で順序がない
- DotLogからの通知で「どのタスクが先頭か」を判別できない
- TodayControllerは`ORDER BY items.sort_order ASC`でソートしているが、値が全て0のため実質無意味
- 既存の`reorderFocus`エンドポイントは`focus_order`カラムを更新しており、`sort_order`とは別カラム（不整合）

### 1.2 目的
一日の始まりに、今日やるタスク（focus）の順番をユーザーが自分で並べ替えるUI/UXを提供する。
「今日はこれだけある」という事実をまず提示し、ユーザーが自律的に順番を決める（Judgment-Free）。

---

## 2. 思想的位置づけ

### Judgment-Freeの原則
- システムは「この順番でやるべき」とは言わない
- 「今日focusに入っているタスクはこれだけです」と事実を提示する
- ユーザーが自分でドラッグして順番を決める
- 順番を決めた結果、一番上のタスクが「次にやるもの」として自然にFocusCardに表示される

### Stream Viewとの関係
- Morning Planningは**Stream Viewの一部機能**として実装する
- 新しいView Modeは追加しない
- FocusCardの下にある「Next Strategy」セクションの並べ替えを可能にする

---

## 3. 機能仕様

### 3.1 ドラッグ&ドロップによる並べ替え

#### 対象
- `status = 'focus'`のアイテム一覧（todayCommits + todayCandidates）
- Stream ViewのFocusCard + Next Strategyセクションが対象

#### 操作
- Next Strategyセクションの各`SmartItemRow`をドラッグ&ドロップで並べ替え可能にする
- FocusCardは常に先頭（index: 0）に固定表示。Next Strategyの順番変更でFocusCardの対象タスクも入れ替わる
- 並べ替え完了時に自動的にAPIに保存（明示的な「保存」ボタンは不要）

#### UI仕様
- ドラッグハンドルアイコン（`GripVertical`）を各行の左端に表示
- ドラッグ中のアイテムには半透明のオーバーレイスタイルを適用
- `@dnd-kit/core` + `@dnd-kit/sortable` を使用（既にdependenciesに存在）

### 3.2 並び順の永続化

#### フロントエンド → バックエンド
- 並べ替え完了時に`POST /items?action=reorder_focus`を呼び出す（既存エンドポイント）
- ペイロード: `{ items: [{ id: string, order: number }] }`

#### バックエンドの修正
**現状の不整合を解消する:**
- 既存の`reorderFocus()`は`focus_order`カラムを更新している
- TodayControllerの`getToday()`は`sort_order`でソートしている
- **解決策**: `reorderFocus()`を修正し、`sort_order`カラムを更新するように変更する
  - `sort_order`はDBスキーマに既に存在するカラム
  - `focus_order`は使用箇所が少なく、`sort_order`に統一する方が自然

#### ソート順ルール
1. `sort_order ASC`（0 = 未ソート、1 = 先頭、2 = 2番目...）
2. 同一`sort_order`の場合は`updated_at DESC`（フォールバック）

### 3.3 実行開始（isEngaged）

#### 現状維持
- FocusCardの「今日やる!」ボタンで`isEngaged: true`に設定する機能は既存
- Morning Planningでは新たな「実行開始」UIは追加しない
- 一番上のタスクがFocusCardに表示され、そこから実行開始できる（既存フロー）

### 3.4 先頭タスクの公開（DotLog連携用）

#### API応答の変更
- `getToday()`レスポンスの`commits`配列の先頭アイテムを「先頭タスク」として扱う
- sort_orderが正しく設定されることで、DotLogは`commits[0]`を参照すれば先頭タスクを取得できる

---

## 4. 技術設計

### 4.1 バックエンド変更

#### `ItemController.php` - `reorderFocus()`の修正
```php
// 変更前: focus_order を更新
$sql = "UPDATE items SET focus_order = ? WHERE id = ? AND tenant_id = ?";

// 変更後: sort_order を更新（+ 権限チェック強化）
$sql = "UPDATE items SET sort_order = ?, updated_at = ? WHERE id = ? AND (
    (tenant_id IS NULL AND created_by = ?) OR
    (tenant_id = ? AND (created_by = ? OR assigned_to = ?))
)";
```

- tenant_idがNULL（個人タスク）の場合もサポートする
- `updated_at`も同時に更新する

#### `TodayController.php` のソート順
- 現状の`ORDER BY items.sort_order ASC, items.updated_at DESC`は変更不要（正しいソート）

### 4.2 フロントエンド変更

#### 新規コンポーネント: `SortableFocusQueue`
- 場所: `src/features/core/youkan/components/Dashboard/SortableFocusQueue.tsx`
- 責務: focusタスク一覧のドラッグ&ドロップ並べ替えUI
- 使用ライブラリ: `@dnd-kit/core`, `@dnd-kit/sortable`

#### `DashboardScreen.tsx`の変更
- `remainingQueue`セクションを`SortableFocusQueue`に置き換え
- `activeFocusItem`を含む全focusアイテムの順序をドラッグで変更可能にする

#### `useFocusQueue.ts`の活用
- 既存の`reorder`関数を活用（`POST /items?action=reorder_focus`を呼び出す）
- ただし現在は`useFocusQueue`がDashboardScreenで使われていないため、統合が必要

### 4.3 データフロー

```
[ユーザーがドラッグ&ドロップ]
  ↓
[SortableFocusQueue: onDragEnd]
  ↓ 新しい配列順序を計算
[楽観的UI更新: ローカルstateを即座に反映]
  ↓
[ApiClient.request('POST', '/items?action=reorder_focus', payload)]
  ↓
[ItemController::reorderFocus() → sort_order更新]
  ↓ 失敗時
[rollback: 元の順序に戻してrefresh]
```

---

## 5. テスト計画

### 5.1 バックエンド テスト
- `reorderFocus`が`sort_order`カラムを正しく更新すること
- 権限外のアイテムの並べ替えが拒否されること
- 個人タスク（tenant_id: NULL）の並べ替えが動作すること

### 5.2 フロントエンド テスト
- ドラッグ&ドロップで配列の順序が変わること
- APIが呼ばれること
- エラー時にロールバックされること

### 5.3 統合テスト
- 並べ替え → 画面リロード → 順序が保持されていること
- DotLogから`commits[0]`で先頭タスクが取得できること

---

## 6. スコープ外（将来検討）

- 「今日の計画完了」のような確定アクション（Judgment-Freeの精神に反するため不要）
- focusタスクの上限数チェック（現状の制限をそのまま維持）
- タイムブロッキング（何時から何時まで）
- キャパシティバーのインタラクティブ化
