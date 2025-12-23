# システム詳細設計・仕様策定会議議事録

**参加者**
*   **👨‍🎨 設計士**: ユーザー代表。機能要件を提示。
*   **🦁 起業家**: ビジネス視点。スピードとリスク管理。
*   **💻 エンジニア**: 技術選定。保守性とコストの番人。
*   **🧠 UI/UXデザイナー**: 使い勝手。
*   **💰 投資家**: 費用対効果（ROI）、将来性、出口戦略。

**ゴール**
*   コスト極小化 (Zero Running Cost)
*   法的リスク最小化 (Zero Liability)
*   高メンテナンス性 (High Maintainability)
*   具体的仕様と優先順位の決定

---

## Round 1: コストと法的リスクの排除 (Local-First Architecture)

**💰 投資家**: 単刀直入に聞くが、ランニングコストはどうなってる？ユーザーが増えたらサーバー代で赤字なんて笑えないぞ。
**💻 エンジニア**: そこで **「完全ローカルファースト (Local-First)」** アーキテクチャを提案します。
*   **サーバー**: なし。ロジックは全てブラウザ（JavaScript）で動きます。
*   **DB**: なし。ブラウザの `IndexedDB` にデータを保存します。
*   **ホスティング**: GitHub Pages (無料)。
*   **コスト**: ドメイン代以外、実質**0円**です。

**🦁 起業家**: サーバーがないってことは、顧客データも預からないってことか？
**💻 エンジニア**: その通りです。
**🦁 起業家**: それはいい！ **「情報漏洩リスク」** がそもそも存在しない。個人情報保護法やGDPRの対応コストもほぼ不要だ。
**👨‍🎨 設計士**: でも、PC買い替えたらデータ消えるのは困るよ。
**💻 エンジニア**: **「JSONファイルへのエクスポート/インポート」** 機能を提供します。バックアップはユーザー自身の責任でPCやGoogle Driveに保存してもらいます。
**🧠 UI/UX**: 「データはあなたのPCの中にだけあります。安心してください」というメッセージは、今の時代逆に信頼につながりますね。

## Round 2: メンテナンス性と技術選定

**💻 エンジニア**: 保守性を高めるため、以下のスタックにします。
*   **Language**: **TypeScript** (厳格な型定義でバグを防ぐ)。
*   **Framework**: **React + Vite** (高速、エコシステムが巨大、情報が多い)。
*   **State**: **MVVM pattern** (LogicとUIの分離)。
*   **Storage**: **Dexie.js** (IndexedDBをSQLライクに扱えるラッパー)。
*   **Styling**: **Tailwind CSS** (CSSファイル管理からの解放)。

**💰 投資家**: 枯れた技術か？
**💻 エンジニア**: 枯れてはいませんが、デファクトスタンダードです。採用もしやすく、AI（Antigravity）も最も得意とする領域です。開発速度が段違いです。
**👨‍🎨 設計士**: 動作は軽いのか？
**💻 エンジニア**: サーバー通信がないので、画面遷移や計算は**爆速**です。

## Round 3: 具体的な仕様 (Spec Definition)

### 3.1 画面・機能構成
**🧠 UI/UX**: 以下の4画面構成で行きましょう。

1.  **Dashboard (Home)**
    *   案件一覧（カード表示）。
    *   最終更新日時、サムネイル表示。
    *   [新規作成] [インポート] ボタン。
2.  **Gallery (Template Selection)**
    *   カテゴリ分け（フラッシュ、框、障子）。
    *   ビジュアル選択。
3.  **Editor (Workspace)**
    *   左：パラメータ入力（アコーディオン式：基本/詳細）。
    *   中：Canvasプレビュー（リアルタイム）。
    *   右/下：アクション類（JWCADコピー、保存、画像保存）。
4.  **Settings / Pro Unlock**
    *   デフォルト設定。
    *   Pro版ロック解除（パスワード入力）。

### 3.2 外部連携仕様 (JWCAD)
**👨‍🎨 設計士**: 一番大事なところだ。
**💻 エンジニア**:
*   **テキストコピー**: クリップボードに `.jww` 互換テキストを書き込む機能。
*   **ファイル保存**: `.txt` (JWCAD外部変形形式) または `.jww` ファイル生成。
*   **画像保存**: 提案書用に `.png` でDLできる機能も地味に需要ありますよね？
**👨‍🎨 設計士**: ある。図面に貼りたいときがある。

## Round 4: 優先順位 (Priority & Roadmap)

**🦁 起業家**: 2ヶ月で収益化だ。無駄な機能は削れ。
**💰 投資家**: ユーザーが「これは価値がある」と思う順に並べろ。

**Phase 1: Minimum Valuable Product (2 weeks)**
*   **Core**: TypeScriptによる計算ロジック移植。
*   **UI**: ギャラリー → エディタ → プレビューの基本動線。
*   **Export**: JWCAD用テキストのクリップボードコピー（これが動かないと話にならない）。
*   **Hosting**: GitHub Pagesでの公開。

**Phase 2: Persistence & Usability (2 weeks)**
*   **DB**: Dexie.js導入、案件データの保存。
*   **UI Polish**: Tailwindによる「売れる」デザインの実装。
*   **Image**: プレビュー画像のPNG保存（SNSマーケティング機能と兼ねる）。

**Phase 3: Monetization & Refine (2 weeks)**
*   **Estimator**: 原価計算ロジック＋Proロック画面。
*   **Settings**: デフォルト値設定。
*   **Release**: Note/Gumroadでの販売開始。

---

## 結論：システム設計方針

1.  **Architecture**: **Local-First Web App** (No Server, No Database Cost, No Privacy Risk).
2.  **Tech Stack**: Vite + React + TS + Tailwind + Dexie.js.
3.  **Data Strategy**: IndexedDB for local storage + JSON Export for backup.
4.  **Monetization**: Client-side simple locking mechanism (Password based).

この設計で、**「金がかからず、法的リスクがなく、メンテしやすい」** システムを構築します。
