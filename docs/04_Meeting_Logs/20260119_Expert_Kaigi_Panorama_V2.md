# 専門家会議議事録: Panorama Mode Layout Optimization

**日時**: 2026/01/19  
**場所**: Virtual Meeting Room  
**テーマ**: 「疎密の不均衡」を解消する、流体的なレイアウトへの進化  
**参加者**:
- **Antigravity (PM)**: ユーザーフィードバック（件数バグ、余白問題）を共有。
- **Leo (The Architect)**: 構造担当。Gridの限界とMasonry/Multi-columnの可能性を提示。
- **Sarah (The Therapist)**: 心理担当。色によるゾーニングと情報の連続性について発言。

---

## 1. 課題の確認

**Antigravity (PM)**:
緊急招集です。ユーザーから鋭い指摘が入りました。
1.  **「件数が少ない」**: はい、これは私のミスです。Compactモードで「もっと見る」ボタンを消したのに、内部的に5件で制限したままでした。これは即修正します。
2.  **「余白だらけになる」**: 4カラム固定だと、例えば「Inbox」が空で「Someday」が大量にある場合、画面左半分が真っ白になります。
3.  **「カラム分けは得策じゃない」**: 画面全体を一つのキャンバスとして使い、情報を隙間なく埋めてほしいという要望です。「背景色とタイトルで区切りをつける」という具体的提案もいただいています。

## 2. 解決策：Masonry vs Multi-column

**Leo (Logic)**:
ユーザーの感覚は正しい。「情報の量」は常に変動する。固定された枠（Grid Columns）に流し込むのは、コンテナ輸送のようなもので、今回のような「不定形な思考の断片」には適さない。

提案したいのは**「CSS Multi-column Layout（段組みレイアウト）」**だ。新聞や雑誌を思い出してほしい。
記事（バケット）は左上のカラムから始まり、下まで行くと**次のカラムの最上部へ折り返して続く**。
これにより、
1.  **余白ゼロ**: 全てのアイテムが隙間なく詰め込まれる。
2.  **可変カラム**: 画面幅に応じて、2カラム、3カラム、4カラムと自然に増減できる。
3.  **不均衡の解消**: Activeが少なくても、そのすぐ下に（あるいは次の列に）Preparationが続き、空間が無駄にならない。

**Sarah (Emotion)**:
素敵ね。まるで「情報の滝」みたい。
でも、どこからどこまでが「Inbox」で、どこからが「Standby」なのか、混ざってしまわないかしら？

**Leo (Logic)**:
そこでユーザーの提案だ。
各バケット（Active, Prep...）を一つの「カードブロック」として扱い、それぞれに**固有の背景色**をつける。
- **Active**: White / Clear
- **Preparation**: Muted Blue / Gray
- **Intent**: Amber / Sepia
- **Log**: Dark / Slate

これを段組みの中に流し込む（`break-inside: avoid`）。すると、色付きのブロックが画面を埋め尽くす「Masonry」風の見た目になる。

## 3. 具体的な実装方針

**Antigravity (PM)**:
なるほど。`grid-cols-4` ではなく `columns-xs` (あるいは `columns-1 md:columns-2 xl:columns-3 2xl:columns-4`) を使うわけですね。

### 新・Panorama Mode 仕様
1.  **Layout**: CSS Multi-column (`columns-*`)
    -   親コンテナに `block` を指定し、CSS columnプロパティで列数を制御。
    -   各バケット（Section）は `break-inside-avoid` で途中で千切れないようにする。
    -   全バケットを一つの親 `div` にフラットに並べる（構造上は `BucketColumn` コンポーネントを並べる形）。
2.  **Visual Coding**:
    -   **Active**: 白背景、強調ボーダー。
    -   **Preparation**: 薄いグレー背景。
    -   **Intent**: 薄いアンバー背景。
    -   **Log**: 濃いグレー背景、または縮小表示。
    -   各バケットには「小さくても分かるタイトル」をヘッダーに配置。
3.  **Bug Fix**: `BucketColumn` 内の `slice(0, 5)` 制限を、`isCompact` 時は解除する。

## 4. 結論

**Antigravity (PM)**:
この「Fluid Masonry (Multi-column)」方式でいきます。
ユーザーが言う「背景色で分類」「小さなタイトル」もしっかり組み込みます。
実装修正にかかります。
