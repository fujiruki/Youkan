# データモデル・状態遷移詳細設計書 (Data Model & State Spec)

**Target**: Internal View (JBWOS) Implementation
**Based on**: BASIC_DESIGN_JBWOS.md

---

## 1. Dexie.js Schema Definition (Update)

### 1.1 `items` Table (New)
既存の `doors` とは別に、判断対象を汎用的に扱う `items` テーブルを新設するか、または `doors` を拡張する。
今回は **Universal ID Strategy**（すべての判断対象を一元管理）を採用し、`items` テーブルを作成する。

```typescript
// db.ts definition

export interface Item {
  id: string;              // UUID
  title: string;           // 表示名（Door名、やること名）
  
  // --- JBWOS Core Properties ---
  status: 'inbox' | 'waiting' | 'ready' | 'pending' | 'done';
  statusUpdatedAt: number; // 状態変更日（"今日"の判定用）
  
  // --- Filters & Sorters ---
  dueHook?: 'today' | 'tomorrow' | 'this_week' | 'next_week' | 'someday';
  interrupt: boolean;      // 割り込みフラグ（trueならInbox最上位）
  weight: 1 | 2 | 3;       // 1:Light, 2:Medium, 3:Heavy
  
  // --- Context ---
  projectId?: string;      // 案件ID（nullなら個人タスク）
  waitingReason?: string;  // status='waiting' の場合必須
  memo?: string;           // 横メモ（One-line reasoning）
  
  // --- Reference ---
  doorId?: string;         // 建具データへの参照（ある場合）
}
```

### 1.2 `projects` Table (Update)
```typescript
export interface Project {
  id: string;
  name: string;
  // ... existing fields
}
```

---

## 2. 状態遷移ロジック (State Transitions)

### 2.1 Inbox -> Ready
- **条件**: 
    - `Ready` の件数が 2件未満であること。
- **Action**:
    - `status` = 'ready'
    - `statusUpdatedAt` = Date.now()
    - Google Calendar API: `insertEvent` (Optional/One-way)

### 2.2 Inbox -> Waiting
- **Action**:
    - `status` = 'waiting'
    - `waitingReason` = User Input (Required)

### 2.3 Ready -> Done (Stopping Event)
- **Action**:
    - `status` = 'done'
    - Check if `Ready` count became 0 -> Trigger "Nothing Day" UI.

### 2.4 Interrupt Handling (割り込み)
- **Action**:
    - `status` = 'inbox'
    - `interrupt` = true
    - `statusUpdatedAt` = Date.now() (Sort at top)

---

## 3. フック・リセットロジック (Hooks & Reset)

### 3.1 日付変更時の処理 (Daily Reset)
アプリ起動時に実行。

- **Done**: 表示から消える（フィルタのみ。削除はしない）。
- **Ready**: 昨日以前の `statusUpdatedAt` を持つアイテムは、**Inboxに戻す** か **そのまま** か？
    - **ルール**: Readyは「今日やる」場所なので、翌日には持ち越さないのが理想だが、ユーザーの手間を減らすため**「昨日から持ち越し」バッジ**を付けて維持する。
- **Due Hook**:
    - `dueHook` = 'tomorrow' のアイテム → 'today' (Inbox Top) に変更。
    - `dueHook` = 'this_week' のアイテム → 月曜日に 'today' に繰り上げ？ または週明けにInbox浮上。

---

## 4. ViewModel Interface (UseJWOSEngine)

UI層（React）には、Dexieの生操作ではなく、以下のメソッドを公開する。

```typescript
interface UseJWOSEngine {
  // Properties
  inboxItems: Item[];   // Sorted: Interrupt > Today > Normal
  readyItems: Item[];
  waitingItems: Item[];
  pendingItems: Item[];
  
  // Status Generators
  isReadyFull: boolean; // readyItems.length >= 2
  isNothingDay: boolean; // User declared "Nothing Today"
  
  // In-Place Actions
  throwIn(title: string): Promise<void>; // Add to Inbox
  moveToReady(id: string): Promise<void>; // Throws error if full
  moveToWaiting(id: string, reason: string): Promise<void>;
  moveToPending(id: string): Promise<void>;
  markAsDone(id: string): Promise<void>;
  
  // Feature Actions
  triggerInterrupt(): void; // Opens "What happened?" modal
  declareNothingDay(): void; // Clears Ready, locks Inbox
}
```
