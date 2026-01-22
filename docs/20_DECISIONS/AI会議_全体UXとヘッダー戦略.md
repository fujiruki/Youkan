# AI会議：全体UXとヘッダー戦略（Screen Real Estate Maximization）

## 議題
**「画面の有効面積を最大化し、かつ迷わないナビゲーションをどう実現するか？」**
現状、`JBWOSHeader`（アプリ共通ヘッダー）と各画面固有のヘッダー（Dashboardヘッダー、Todayヘッダーなど）が重複し、特にモバイルにおいて貴重な垂直方向のスペースを消費している。

## 現状の構造分析 (Current State)

| 画面 (View) | App Header (`JBWOSHeader`) | 画面内ヘッダー (Context Header) | 状況 |
| :--- | :--- | :--- | :--- |
| **JBWOS (Dashboard)** | あり (Projects, Today btn, Menu) | **あり** (`⚡ Today's Decision`, Toggle) | **二重ヘッダー状態**。上部が重たい。 |
| **Today (Execution)** | あり | **あり** (戻るボタン, タイトル, TimeBar) | **二重ヘッダー**。没入感を阻害。 |
| **Planning (Future)** | あり | あり (タイトル, 閉じる) | 二重ヘッダー。 |
| **Editor / Schedule** | なし (ProjectList/Editor用) | 独自UI | 適切（没入している）。 |

## 参加者（シミュレーション）

*   **Architect (Overall)**: ナビゲーションの一貫性は大事だが、常に表示する必要はない。「コンテキスト」が全てだ。
*   **UX Researcher**: ユーザーは「今何をしているか（Execution）」と「全体を見渡す（Dashboard）」で求める情報密度が違う。
*   **Mobile Specialist**: スマホでヘッダーが2つあるのは致命的。コンテンツ領域が狭すぎる。

## 議論プロセス

### 1. Today画面（実行モード）におけるヘッダー
**Researcher**: `TodayScreen` は「実行」の場です。集中（Focus）が必要。
**Mobile**: ここで `JBWOSHeader`（Projectsに戻るボタンやメニュー）はノイズでは？
**Architect**: 同意。Today画面には独自の「戻る」ボタンが既に設置されている。
**結論**: **Today画面では `JBWOSHeader` を隠すべき（Immersive Mode）。**

### 2. Dashboard画面（JBWOS）におけるヘッダー
**Architect**: ここが一番難しい。`App Header` は「アプリ全体のナビゲーション」、`Board Header` は「ボードの操作（表示切替）」を担っている。
**Mobile**: これらを統合できませんか？
**Developer**: 技術的には可能だが、情報は多い。
- App Header: `Projects`, `Today`, `Menu`, `Help`
- Board Header: `Title`, `View Toggle`, `Project Create`, `Close`

**Design Proposal (Unified Header - Future)**:
将来的にはこれらを1つの「スーパーヘッダー」に統合すべきだが、レイアウトが複雑化する。

**Alternative (Scroll Away - Smart Header)**:
**Mobile Specialist**: スマホのブラウザのように、**「下にスクロールしたらヘッダーが隠れる」**、**「上にスクロールしたら現れる」**という挙動はどうだろう？
**Architect**: それは良い。Dashboardはリストが長いので、閲覧中は広く使いたい。

### 3. プロジェクト作成ボタンの配置
**UX**: 先ほどの議論でも出たが、Dashboardヘッダーにある `[+ Project]` は本当にそこに必要なのか？
**Architect**: 確かに「JBWOS（日々の判断）」の文脈に「プロジェクト作成」が混ざっているのは少し違和感がある。
**Proposal**: FAB（Floating Action Button）にするか、メニュー内に移動しても良いのでは？

## AI推奨戦略 (Strategy Proposal)

### Phase 1: コンテキストに応じたヘッダー制御（即効性あり）

1.  **Today画面（Execution Mode）**:
    - **Full Immersive**: `JBWOSHeader` を完全非表示にする。
    - 画面内の「放り込み箱へ戻る」ボタンだけで十分ナビゲーション可能。
    - これにより、TimeProgressBarなどがより上に表示され、タスクに集中できる。

2.  **JBWOS画面（Dashboard Mode）**:
    - **Header Consolidation (Lite)**:
        - スマホでは `JBWOSHeader` を維持しつつ、下の `Board Header` を極限まで薄くする（先ほどのアイコン化で対応済）。
    - **Scroll Behavior**:
        - 可能であれば、スクロールに伴って `JBWOSHeader` を隠す（`translate-y`）。

### Phase 2: ヘッダー構造の抜本的見直し（中期的）

- **App Headerの役割変更**:
    - 常に上部に固定するのではなく、必要な時だけ呼び出せる「ドロワーメニュー」や「ボトムナビゲーション」への移行を検討。
    - 特にモバイルでは **ボトムナビゲーション** (Board / Calendar / Today / Menu) の方が親指操作に適している。

## 今回の実装提案

**「Today画面での没入モード（ヘッダー隠し）」** をまず実装・検証しませんか？
最も滞在時間が長く、集中を要する画面でのスペース効率が劇的に改善します。
