# コンポーネント実装詳細設計書 (UI/UX Implementation)

**Target**: Frontend Developers
**Based on**: CONSTITUTION_UI_SPEC.md, DATA_MODEL_SPEC.md

---

## 1. ディレクトリ構造 (Directory Structure)

```
src/
  features/
    jbwos/
      components/
        GlobalBoard/
          BoardContainer.tsx
          BucketColumn.tsx
          ItemCard.tsx
          InboxFolder.tsx       // 折りたたみ制御
          GentleMessage.tsx     // 状況に応じたメッセージ
        Onboarding/
          ZenFlow.tsx           // Step 0-5 Controller
      hooks/
        useJWOSEngine.ts        // Logic implementation
      types/
        index.ts
```

---

## 2. 詳細コンポーネント仕様

### 2.1 `InboxFolder` (Durability UI)
Inboxのアイテム数に応じて表示を制御するラッパーコンポーネント。

- **Props**: `items: Item[]`
- **Render Logic**:
  1. `items`の先頭 **7件** のみを表示（`<ItemCard />`）。
  2. 8件目以降はレンダリングせず、数値のみカウント。
  3. リスト下部に `<FoldedMessage count={items.length - 7} />` を表示。
     - Text: 「他 23件のことは、今は考えなくていいです」
     - Click: 展開なし（原則）。どうしても見たい場合のみ "Peek" モードへ。

### 2.2 `GentleMessage` (Header/Footer)
ReadyカラムやInboxカラムに表示する「肯定メッセージ」コンポーネント。

- **Logic**:
  - `Ready` count == 0 && `Done` count > 0:
    - **"今日はもう、やるものはありません。"** (Hero Size)
  - `Ready` count == 1:
    - "あと1つ。それで十分です。"
  - `Inbox` count > 10:
    - "頭から出せましたね。今は整理しなくていいです。"

### 2.3 `ItemCard` (Unified Design)
建具(Door)、日常タスク(Life)、夢(Dream)を区別しない統一デザイン。

- **Appearance**:
  - Border: Thin, distinct colors only for `Interrupt` (Yellow/Orange glow).
  - Content: Title (Primary), SideMemo (Secondary, truncated).
  - Tags: Project Name (Badge), Waiting Reason (If Waiting).
- **Interactions**:
  - **Drag Source**: `dnd-kit` useDraggable.
  - **Click**: Opens "Judgment Modal" (3-choice: Ready/Waiting/Pending).
    - *Note*: Inboxでの詳細編集（期限設定など）は禁止。

### 2.4 `InterruptFab` (Floating Action Button)
Inboxカラムの右下に常駐する「割り込み」ボタン。

- **Action**:
  - Click -> Modal: "何かありましたか？" (Input field)
  - Submit -> Adds item with `interrupt: true`, forcing it to top of Inbox.

---

## 3. アニメーション仕様 (Framer Motion)

### 3.1 投入アニメーション (Throw In)
- Inboxへの追加時、アイテムが「上から落ちてくる」ようなバウンスエフェクト。
- "Stiff" spring physics.

### 3.2 完了アニメーション (Done)
- Ready -> Done 移動時、カードが光って消えるのではなく、
- **「静かに収まる」** (Opacity down, Grayscale).
- 達成感よりも「着地感（安らぎ）」を演出。

### 3.3 何もしない日 (Nothing Day)
- 画面全体を覆う「休息モード」オーバーレイ。
- 背景: 落ち着いた風景写真または単色（Dark Grey/Blue）。
- Text: "Today is for rest."

---

## 4. Onboarding Flow (Intro)

`ONBOARDING_SPEC.md` の実装。
- **State**: `localstorage.hasVisited` で判定。
- **Component**: `<ZenFlow />` が GlobalBoard の上にモーダルとして被さる。
- **Step Controller**:
  - ユーザーが「次へ」を押すまで進まない（時間制限なし）。
  - Step 2 で実際に `<ItemCard />` を生成して操作させる（Tutorial Item）。

