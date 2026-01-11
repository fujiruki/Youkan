# JBWOS Onboarding Specification: The "Judgment Experience"

## 1. Core Philosophy
The onboarding process is **NOT** a tutorial or a feature walkthrough.
It is an **"Experience of Relief" (判断が終わる感覚の体験)**.

### Principles
1.  **Don't Explain**: Minimize text. No definitions. No "Welcome".
2.  **Don't Let Them Choose**: No menus. No settings. Linear path.
3.  **Don't Let Them Think**: The goal is to show them they *don't* have to think.

---

## 2. The 3-Minute Flow (Script)

### Step 0: The Empty State (0:00-0:10)
**Screen**: Global Decision Board (Inbox/Waiting/Ready/Pending).
**State**: Completely empty. No tutorial overlays yet.
**Concept**: "It is okay to have nothing."

### Step 1: The Philosophy Declaration (0:10-0:30)
*Action: Auto-trigger LP Modal (Full screen).*

**Text**:
> このツールは
> あなたを「時間管理」から解放し、
> 「判断を終わらせる」ための道具です。
>
> 予定を完璧に立てなくていい。
> 今、考えられないことは、考えなくていい。

**Button**: **[よく分からないけど、はじめる]**

### Step 2: The Inbox Revelation (0:30-1:00)
**Screen**: Focus on Inbox.
**Text (Modal/Tooltip)**:
> Inboxとは
> **「今は考えられないものを放り込む場所」**です。
>
> 思いついた瞬間に、判断しなくていい。
> 迷ったら、ここに入れてください。

**Interaction**: Highlight the **[+ 放り込む]** button.

### Step 3: The First Input (Optional) (1:00-1:30)
**Screen**: Input field active.
**Text**:
> 今、頭に浮かんでいることはありますか？
> (なければ、何もなくて大丈夫です)

*Action A: User submits text.* -> Proceed to Step 4.
*Action B: User closes/cancels.* -> Proceed to Step 5 (End).

### Step 4: The Judgment Event (1:30-2:00)
**Screen**: Darken background (Spotlight effect on the item).
**Text**:
> 今日は、これをやりますか？

**UI Elements (Two Choices Only)**:
1. **[今日はやらない]** (Secondary) -> Stays in Inbox.
2. **[向き合う]** (Primary) -> Moves to Ready.

### Step 5: The "Ready" Constraint & End (2:00-2:30)
*Action: From Step 4 or Step 3 (Skip).*

**Text (If Ready has item)**:
> 今日やることは、1つで十分です。

**Text (If Inbox only)**:
> 今は、これ以上決めなくていい。

**Text (If Empty)**:
> 今日は、もう十分です。

**Exit**:
- User lands on the **Global Decision Board** (Home).

### Step 4: The Overwhelm (2:00-2:30)
**Screen**: Return to input prompts.
**Text**:
> もう1つ、気になることはありますか？

*Action: User inputs another item.*
*Result*: Item enters Inbox.

**Text**:
> 今は、これ以上決めなくていい

**Concept**: Teaching that it's okay to leave things in Inbox.

### Step 5: The End (2:30-3:00)
**Screen**: Clean state.
**Text (Bottom Corner)**:
> 今日は、もう十分です。

**UI Elements**:
- Button: **[閉じる]**

**Exit**:
- User lands on the **Global Decision Board** (Home).
- The state they created (1 Ready, 1 Inbox) is preserved.

---

## 3. Implementation Requirements

### Technical
- **State Persistence**: The onboarding data MUST persist to the actual `IndexedDB`.
- **Route**: `/onboarding` (Redirects here if DB is empty or flag is not set).
- **Animation**: Use `framer-motion` for slow, calming transitions.

### Visual Style
- **Zen Mode**: No sidebar, no heavy chrome.
- **Typography**: Large, serif or clean sans-serif. High readability.
- **Color**: Monochromatic with accent only on the "Action" button.

## 4. Anti-Patterns (Forbidden)
- ❌ "Next" buttons (Flow should be natural).
- ❌ Tooltips explaining features.
- ❌ "Congratulations!" or Confetti (This is serious work, not a game).
- ❌ Asking for Project Names or Deadlines.
