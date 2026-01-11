# UI Design Guideline

**Project**: Tategu Design Studio
**Version**: 1.0
**Based on**: AI Meeting (2026-01-10)

---

## 1. Design Philosophy

**"User-First Density"**
プロフェッショナルな業務効率（情報の網羅性・入力速度）と、クライアントへの提案力（美しさ・直感性）を両立させる。
状況に応じて、UIの情報密度（Density）を動的に切り替えるアプローチを採用する。

---

## 2. Layout Strategy (レイアウト戦略)

### 2.1 3-Pane Desktop Layout
Webサイトのような縦スクロール前提のレイアウトではなく、1画面に全ての情報を収める「デスクトップアプリ」型のレイアウトを採用する。

1.  **Left Sidebar (Controls)**: 入力・設定パネル。
2.  **Center Stage (Canvas)**: 建具プレビュー。最も広い領域を確保。
3.  **Right Panel (Data)**: 見積り・プロパティ・リスト（必要に応じて表示/非表示）。

### 2.2 Density Modes (密度モード)

| Feature | Design Mode (Comfort) | Production Mode (Compact) |
| :--- | :--- | :--- |
| **Padding** | 広め (16px - 24px) | 極小 (4px - 8px) |
| **Font Size** | 標準〜大きめ (14px - 16px) | 小さめ・高密度 (12px - 13px) |
| **Input Height** | タッチしやすい (40px - 48px) | 情報を詰め込む (24px - 32px) |
| **Labels** | アイコン＋テキスト、説明的 | テキストのみ、略語許容 |
| **Information** | 形状・色・テクスチャに集中 | 全ての寸法・パラーメータを表示 |

---

## 3. Aesthetic Principles (視覚的原則)

### 3.1 "Functional Glassmorphism"
モダンで美しい「すりガラス表現」を採用するが、可読性を損なわないように調整する。
*   背景: 濃い色（Dark Modeベース）で高級感を演出。
*   パネル: 半透明の黒/グレー + ぼかし + 細いボーダー。
*   文字色: 白または高輝度グレー（コントラスト比 4.5:1以上確保）。

### 3.2 Visual Hierarchy
*   **Primary Action**: 保存、エクスポート等は「アクセントカラー（例: ゴールド/アンバー）」で強調。
*   **Secondary Action**: 枠線のみ、または控えめな色。
*   **Selected State**: 明確な「光るような」ハイライト効果。

---

## 4. Interaction & Usability (操作性)

### 4.1 Keyboard First
マウスを使わずに主要なパラメータ変更ができるようにする。
*   **Tab Flow**: 上から下へ、左から右へ、論理的な順序でフォーカス移動。
*   **Numeric Inputs**: フォーカス時に全選択状態にする（即座に上書き可能に）。

### 4.2 "No Wasted Space"
*   **Collapsible Panels**: サイドバーや詳細パネルは折りたたみ可能にし、プレビュー領域を最大化できるようにする。
*   **Overlay Tools**: 頻繁に使うツール（ズーム、表示切替）はCanvas上に半透明で重ねて配置する。

---

## 5. Catalog UI (カタログ画面)

*   **Card Layout**: 密度を高めたグリッド表示。
*   **Standardization**: サムネイルのアスペクト比を統一。
*   **Quick Actions**: カード上のホバーメニューで「複製」「編集」「削除」へ即座にアクセス。

---

## 6. Implementation Notes (実装への反映)

*   Tailwind CSS のクラスを条件付きで切り替えるヘルパー関数の作成 (`cn` utility 等)。
*   `useDensity` フックの作成。
*   `tabIndex` の適切な管理。
