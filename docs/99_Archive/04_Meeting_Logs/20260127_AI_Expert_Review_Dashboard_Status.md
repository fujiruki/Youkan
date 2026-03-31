# AI Expert Review Simulation: Dashboard & Status Logic

**Date**: 2026-01-27 (Session 2)
**Topic**: Deep Dive into Dashboard Usability & Status Transitions
**Goal**: Validate if the "Judgment-Free" philosophy holds up against "User Reality" (Legacy of fatigue, laziness, and chaos).

## 1. 参加エキスパート (Personas)
*   **PM**: 実装・機能性の守護者。
*   **UX**: 使い勝手と視認性の守護者。
*   **PSY (Psychologist)**: 「弱い人間（ユーザー）」の擁護者。
*   **REAL (Realist/User Proxy)**: 「ていうか、めんどくさいじゃん」と言う係。

---

## 2. 議論ログ (Dialogue)

### A. Focus Queue の「運用疲れ」問題

**REAL**: 「高密度で一覧性がある」のはいいんだけどさ、朝起きてFocusに20個タスクが残ってたら、正直見るのも嫌になってアプリ閉じると思う。ドラッグ＆ドロップで並び替え？ **その「並び替え」自体が判断コスト高い**んだよ。
**PSY**: その通り。並び替えを強制すると「Inbox化」する。つまり、「見て見ぬふり」が始まる。
**UX**: じゃあ、**"Suggested Order" (自動並び順)** がデフォルトであるべき？
**PM**: ロジックで言うと、「期限が近い」「見積が大きい/小さい」「Intentフラグ」で重み付けソートは可能。
**REAL**: でも勝手に並んといてほしい。「今日はこれだけでいいよ」って。
**UX**: 提案。**「朝の儀式（Morning Shuffle）」ボタン**はどう？ ワンクリックで、期限切れやIntentを考慮して「いい感じ」に並べ直してくれる。気に入らなければ手動で直す。
**PSY**: "Shuffle" という言葉はいい。「運」要素を感じさせ、義務感を減らす。**「AI Sort」ではなく「Shuffle」**。

### B. Status Transition の「面倒くささ」

**REAL**: タスク終わったら「Done」にするじゃん？ でも、Inboxにある「あ、これやんなくていいや」ってやつ、わざわざ「Pending」とか「Delete」にドラッグするの？
**UX**: スワイプ削除（Mobile）や、右クリックメニュー（PC）はあるけど…。
**REAL**: マウス動かすのがダルい時ある。
**UX**: **Dashboard上で「ステータス変更」を完結させる**必要があるね。
    *   Focusキューの各カードに、控えめな「完了チェックボックス」は必須。
    *   じゃあ「Pending」は？
**PM**: **"Postpone (先送り)" アクション**を簡単にすべき。「今日やらない」＝「明日以降のFocus」なのか、「いつやるかわからんPending」なのか。
**PSY**: ユーザーの心理としては「今は視界から消したい」だけ。
**UX**: **"Not Today" (今日はやらない)** ボタンを作ろう。
    *   押すと、Focusから消える。
    *   システム内部では「翌日のFocus」または「Inbox」に戻す。
    *   **「判断」を求めず、とりあえず目の前から消す機能**。これがJudgment-Free。

### C. Dashboardの「情報の圧」対策

**REAL**: 「Active Task」と「Progress Bar」と「Focus Queue」と「Inbox Input」。全部1画面にあると、情報過多でウッとならない？
**UX**: 確かに。**"Focus Mode" (集中モード)** が必要かも。
    *   作業中は「Active Task」と「Progress Bar」だけ表示。
    *   リストは見えなくする。
**PSY**: それは「現実逃避」ではなく「シングルタスクの支援」。非常に良い。
**PM**: 実装的には、スクロールでリストを隠すか、折りたたみ（Accordion）を入れるか。
**REAL**: 折りたたみがいい。リストが常に目に入ってると、Activeなタスクやってる最中に「あ、次はあれか…」ってノイズになる。
**UX**: 採用。**Focus Queueは「折りたたみ可能（Collapsible）」**にする。Active Taskがある時は、デフォルトで閉じててもいいくらい。

### D. Intent の「空気化」問題

**REAL**: Intentが大事なのはわかるけど、毎日見てたら風景になって、結局無視しない？
**PSY**: 「馴化（Habituation）」だね。脳は変わらない刺激を無視する。
**UX**: 対策として、**Intentタスクは「ランダムで1つだけ」Active Taskの横とかに "Today's Inspiration" として出す**のは？
**PM**: 「今日の格言」みたいに？
**PSY**: それくらいでいい。「全部やる」なんて無理なんだから。「今日のIntent」を1個だけ意識させる。サブリミナル効果狙い。
**REAL**: それなら邪魔にならないし、ふとした時に「あ、そうだった」と思えるかも。

---

## 3. 結論と修正方針 (Action Items)

### 1. "Not Today" button (For Focus Queue)
*   **機能**: カード上のアクション。押すと即座にリストから消える。
*   **ロジック**: 内部的には `due_date` を `+1 day` にするか、Inboxに戻す。判断を求めない。

### 2. Collapsible Focus Queue
*   **機能**: Active Task実行中は、Focusリスト全体を折りたたんで隠せるようにする。
*   **目的**: 「今」への完全没入。

### 3. Morning Shuffle
*   **機能**: ワンクリックでFocus順序を「いい感じ」にリセットする機能。
*   **目的**: 並び替えコストの削減。

### 4. Random Intent
*   **機能**: 登録されたIntentの中から、ランダムで1つだけDashboardの上部に静かに表示する。
*   **目的**: 馴化の防止と継続的な意識付け。

この方針で `Screen_Flow_and_Wireframes.md` を更新します。
