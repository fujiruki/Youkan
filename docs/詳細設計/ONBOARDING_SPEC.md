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

### Step 0: The First Question (0:00-0:20)
**Screen**: Clean, centered input. No header, no footer.
**Text**:
> 今、頭に浮かんでいる
> やるべきこと・気になることを
> 1つ、放り込んでください

**UI Elements**:
- Input Field (Focus active)
- Button: **[今は考えない]** (Primary Action)

**Rules**:
- DO NOT use the words "Task", "TODO", "Register".
- No limit on character count, but keep it simple.

### Step 1: The Inbox Revelation (0:20-0:50)
*Action: User submits text.*

**Screen**: The item appears alone in a vast, empty space.
**Text (Fade in)**:
> いま決めなくていいものは
> ここに置いて大丈夫です

**Concept**: First introduction of "Inbox" context, but without defining it.
**Interaction**: Pause for 3 seconds, then proceed automatically.

### Step 2: The Judgment Event (0:50-1:30)
**Screen**: Darken background (Spotlight effect).
**Text**:
> 今日は、これをやりますか？

**UI Elements (Two Choices Only)**:
1. **[今日はやらない]** (Secondary) -> Stays in Inbox.
2. **[向き合う]** (Primary) -> Moves to Ready.

**Rules**:
- No "Pending", no "Delete". Just Yes/No for *Today*.

### Step 3: The "Ready" Constraint (1:30-2:00)
*Action: User selects [向き合う].*

**Screen**: Item moves to a "Ready" area.
**Text**:
> 今日やることは、1つで十分です

**Concept**: Implicitly teaching the "Max limits" without explaining the rule.

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
