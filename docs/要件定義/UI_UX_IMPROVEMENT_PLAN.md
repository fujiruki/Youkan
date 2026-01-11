# UI/UX Improvement Plan: Door Design System

## 1. Expert Roundtable Discussion (議事録)

**参加者**:
*   **👨‍🎨 UI/UX Designer (UD)**: ユーザー体験の最適化担当。
*   **📐 Architect (DA)**: 設計士。意匠と直感的操作を重視。
*   **🔨 Joinery Owner (JO)**: 建具店経営者。現場の正確さと利益確保（積算）を重視。
*   **💻 System Engineer (SE)**: システム実装・保守性担当。
*   **📢 Marketer (MK)**: 将来の一般公開・普及を見据えた視点。

---

### テーマ: 「プロも納得し、素人も使えるUIとは？」

**MK (Marketer)**:
「将来的に一般公開するというビジョン、最高ですね。ただ、今の画面は『入力項目が多すぎる』のが懸念点です。素人が見たら『見付？見込？』で離脱しますよ。」

**JO (Joinery Owner)**:
「いやいや、そこを省いてもらっちゃ困る。我々プロは数ミリ単位で仕事してるんだ。『見付』が太くなれば原価も上がるし、デザインも野暮ったくなる。今の『詳細積算パネル』は情報の透明性があって非常に良い。これは絶対に必要だ。」

**DA (Architect)**:
「両者の言い分はわかる。今は左側に数値入力、右側に積算表、真ん中にプレビューだよね？
**『モード』を分けたらどうだろう？**
最初は『形を決める』ことに集中させる。余計な数字は見せない。形が決まってから、『見積もり』を見る。思考のフェーズが違うんだよ。」

**UD (UI/UX Designer)**:
「賛成です。**『Design Mode (形状モード)』** と **『Estimation Mode (積算モード)』** の明確な分離ですね。
*   **Design Mode**: プレビューを最大化。入力は『幅・高さ』と『デザインパターン（中桟の本数など）』だけ。
*   **Estimation Mode**: 今の画面構成。詳細な寸法やマージンを入力する。」

**SE (System Engineer)**:
「技術的には可能です。ただ、`ESTIMATION_LOGIC.md` にある通り、裏側では常に計算が走っています。Design Mode で数値を隠している間も、デフォルト値（例：見付30mm、ホゾ30mm）で計算し続ける必要がありますね。」

**JO**:
「それでいい。ただ、プロとしては『Design Mode』でも、**『今いくらくらいか？』** はチラッと見たい。合計金額だけ右上に常に表示しておいてくれ。」

**DA**:
「直感的な操作も欲しいね。今は左のサイドバーで『中桟：1本』と入れないといけないけど、**プレビュー画面の絵をクリックして、『＋』ボタンで桟を増やせたり** できないかな？」

**SE**:
「Canvas上のインタラクションですね。実装コストは高いですが、UXとしては最高です。まずはサイドバーのスライダーやボタンで即座に反映される形（Webアプリの強み）を強化しましょう。」

**MK**:
「一般公開時は『Estimation Mode』をボタン一つで非表示にすればいいだけですね。そうすれば『おしゃれな建具シミュレーター』としてリリースできます。」

---

## 2. 具体的なUI/UX改善案 (Concrete Proposals)

### A. 画面レイアウトの刷新: "Dual Phase Interface"

画面を「デザイン」と「エンジニアリング（積算）」の2つのフェーズに分割せず、**シームレスに行き来できるレイアウト**にします。

### C. Detailed UI Element Map (Element Placement)

Based on the 5-round expert discussion, the following layout is defined:

#### 1. Header (Command Center)
*   **Left**: `[< Home]` Icon + `[Door Name]` (Click-to-Edit Text)
*   **Center**: `[Design | Pro]` Toggle Switch (Segmented Control)
*   **Right**: `[¥ Price Display]` (Big/Gold) + `[SAVE]` (Primary Button)

#### 2. Left Sidebar (Input Controls)
*   **Top (Always Visible)**: `[Basic Dimensions]` Accordion (Width/Height/Depth)
*   **Middle (Mode Dependent)**:
    *   **Design Mode**: `[Structure & Style]` - Sliders for Rail Count, Kumiko Patterns.
    *   **Pro Mode**: `[Detailed Specs]` - Numeric inputs for Stile/Rail Widths, Margins, Hozo.
*   **Bottom**: `[Settings]` Link (App Config)

#### 3. Preview Area (Canvas)
*   **Top-Left Overlay**: `[Toolbar]` (Dims Toggle [📏], Texture Toggle [🪵])
*   **Interaction (v2 Future Feature)**:
    *   Click part -> Scroll sidebar to focus.
    *   *Note: In v1, this will be View-Only.*

#### 4. Right Panel (Pro Mode Only)
*   **Content**: `[Estimation Grid]` (Current Implementation)
*   **Footer**: `[Unit Price Input]` + `[Markup Input]`

### B. 操作フローの最適化

1.  **テンプレートから開始**:
    *   いきなり0から作らせず、「框戸」「ガラス戸」「格子戸」などのプリセットを選ばせる。
2.  **スライダーで直感操作**:
    *   桟の本数や位置は、数値入力だけでなくスライダーでも動かせるようにし、「動く楽しさ」を提供する。
3.  **リアルタイム積算**:
    *   スライダーを動かすたびに、右上の金額がパラパラと変わるアニメーションを入れる（「高い木材を使っている」実感を持たせる）。

---

## 3. 実装ロードマップ (System Improvements)

このUIを実現するために必要なシステム改修：

1.  **UI State Management**:
    *   `viewMode` ('design' | 'engineering') のステート管理。
    *   各パネルの表示/非表示制御。
2.  **Interactive Preview**:
    *   Canvas上のクリック判定ロジックの実装 (`GeometryGenerator` にHit判定用情報の出力追加)。
3.  **Preset System**:
    *   `DoorDimensions` のプリセット集 (`Templates.ts`) の作成。

---

## 4. 承認依頼 (Conclusion)

**結論**:
まずは **「View Modeの切り替え（デザイン集中 vs 詳細積算）」** を実装し、プロと素人の両方のユースケースに対応できる基盤を作ります。

この方向性で、次のタスクとして **「ヘッダーへのモード切替実装」と「サイドバーの再構成」** を進めてよろしいでしょうか？
