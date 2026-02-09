# Newspaper View (全体一覧２) 仕様書

## 概要
「Newspaper View（全体一覧２）」は、新聞のような多段組レイアウト（Multi-column Layout）を採用したタスク一覧表示モードです。
プロジェクトとタスクを「読む」体験に特化しており、視認性の高い一覧性を提供します。

## インタラクション & レイアウト

### レイアウト構造
- **多段組 (Columns)**: CSS `column-count` プロパティを使用し、画面幅に合わせてアイテムを縦方向に流し込みます。
- **プロジェクトヘッダー**: プロジェクトごとの区切り文字（Header）。
- **レスポンシブ**: ユーザー設定（スライダー）により、列数（1〜5列）と文字サイズ（10px〜16px）を調整可能。

### 操作
- **クリック**: アイテムをクリックすると、詳細編集モーダルが開きます。
- **Alt + D**: クイック入力（Quick Input）または詳細表示へのショートカット。
- **右クリック**: クイックアクションメニューを表示（完了、エンゲージ、削除など）。

---

## ステータス表示と配色 (Status Colors)

従来の「受信（Inbox）」色が目立ちすぎるというフィードバックに基づき、専門家会議にて再定義された配色スキームです。
一覧性を損なわない、ノイズの少ない「Subtle & Semantic」な配色を採用します。

| ステータス | 日本語表記 | 変更前 (Loud) | 変更後 (Subtle) | 配色意図 (Intent) | Tailwind クラス案 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Inbox** | 受信 | <span style="color:orange">Orange</span> | **Blue (Cyan)** | **「清流・未処理」**<br>警告色(Orange)を廃止し、清潔感のある水色を採用。新しい情報であることを示すが、アラートではない。 | `bg-cyan-50 text-cyan-700` |
| **Pending** | 保留 | Slate | **Slate / Gray** | **「石・静止」**<br>動いていない状態。背景に沈む無彩色。 | `bg-slate-100 text-slate-500` |
| **Waiting** | 待機 | Purple | **Purple (Soft)** | **「他者・委任」**<br>自分以外がボールを持っている状態。区別はつくが主張しすぎない薄紫。 | `bg-purple-50 text-purple-700` |
| **Focus** | 集中 | Blue | **Indigo** | **「選択・意思」**<br>今日やるべきこと。知的な集中色。 | `bg-indigo-50 text-indigo-700` |
| **Engaged** | 実行中 | Amber | **Amber (Vivid)** | **「炎・活動中」**<br>現在進行形でタイマーが動いている状態。これだけは目立って良い。 | `bg-amber-100 text-amber-800` |
| **Done** | 完了 | (Opacity) | **Strikethrough** | **「無・過去」**<br>取り消し線と薄グレー化のみ。バッジは表示しない。 | `opacity-60 text-slate-400` |

---

## 技術仕様 (Technical Details)

### コンポーネント構成
- **`NewspaperBoard`**: レイアウトコンテナ。`useNewspaperItems` フックからデータを取得し、設定された `columnCount` でレンダリングします。
- **`NewspaperItem`**: 個別のアイテム表示。`em` 単位を使用し、親コンテナの `fontSize` に追従してスケーリングします。
- **`ViewControls`**: 表示設定（文字サイズ、列数）のUIおよび `localStorage` への永続化を担当します。

### データロジック (`useNewspaperItems`)
1. **収集**: Inbox, Pending, Waiting, Focus から全タスクを収集。
2. **グループ化**: プロジェクトIDごとにアイテムをグループ化。
3. **ソート**:
    1. プロジェクトなし (No Project)
    2. 会社プロジェクト (Company)
    3. 個人プロジェクト (Personal)
4. **ヘッダー生成**: プロジェクトグループの先頭に仮想ヘッダーアイテムを挿入。

### 永続化キー (`localStorage`)
- `jbwos_newspaper_fontsize`: 文字サイズ (number)
- `jbwos_newspaper_columns`: 列数 (number)
