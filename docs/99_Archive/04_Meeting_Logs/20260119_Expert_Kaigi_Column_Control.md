# 専門家会議議事録: Panorama Column Control UI

**日時**: 2026/01/19  
**テーマ**: ユーザーの自由度を高める「可変カラム」のUI設計  
**参加者**:
- **Antigravity (PM)**: ユーザー要望（1〜5カラム調整）の共有。
- **Leo (The Architect)**: 実装フィジビリティとTailwindのクラス生成について。
- **Sarah (The Therapist)**: 操作感と視覚的ノイズの低減。

---

## 1. 要件定義

**Antigravity (PM)**:
ユーザーからの要望です。「Panorama Modeのカラム数を調整したい。最大5カラムまで」。
現在の「画面幅に応じた自動調整」も残しつつ、ユーザーが強制的に「もっと細かく（多カラム）」「もっと大きく（少カラム）」を指定できるようにします。

## 2. UIデザインの検討

**Sarah (Emotion)**:
ヘッダーがごちゃごちゃするのは嫌ね。今は `[Focus] [Panorama]` のボタンがあるけれど、ここにさらに数字のボタン `[1][2][3][4][5]` を並べるのは美しくないわ。

**Leo (Logic)**:
同意する。機能は「Panoramaの密度調整」なので、**PanoramaモードがActiveな時だけ出現するコントローラー**であるべきだ。
選択肢は2つある。
1.  **Dropdown**: 場所を取らないが、ワンアクションで切り替えられない。
2.  **Steps / Slider**: ワンクリックで切り替え可能。「密度」を調整する感覚に近い。

**Sarah**:
スライダーがいいわ。「ズームイン・ズームアウト」の感覚で操作できるから。
左（1カラム）に行くと大きく見え、右（5カラム）に行くと俯瞰できる。直感的ね。

**Antigravity**:
では、Panoramaボタンの横に、シンプルな**Range Slider**（またはスライダー風のStepper）を配置しましょう。
ラベルはシンプルに `Columns: 3` のように現在の値を表示し、スライダーを動かすとリアルタイムに反映されるようにします。

## 3. 実装仕様

**Leo (Logic)**:
Tailwindでの実装について注意が必要だ。
`columns-[n]` クラスは動的に生成する必要があるため、JITコンパイラが認識できるようにsafelistに入れるか、完全なクラス名としてコード内に記述する必要がある。

```tsx
// 動的なクラス名の生成パターン
const columnClass = useMemo(() => {
   const classes = {
     1: 'columns-1',
     2: 'columns-2 md:columns-2', // md以上で強制
     3: 'columns-1 md:columns-2 xl:columns-3',
     4: 'columns-1 md:columns-2 xl:columns-4',
     5: 'columns-1 md:columns-3 xl:columns-5',
     // User Override logic...
   };
   // ユーザー指定がある場合は強制的にそのカラム数にするか？
   // いや、スマホで5カラムは流石に見えない。
   // 「最大カラム数」を指定する形が現実的か。
}, [userColumnCount]);
```

**Antigravity**:
ユーザーは「調整できるようにしてほしい」と言っています。つまり、PCの大画面で見ているときに「今は3列がいい」「やっぱ5列で一気に見たい」という切り替えを想定しています。
スマホ (`< md`) では流石に `columns-1` 固定で良いでしょう。PC (`md` 以上) において、ユーザー指定の `columns-N` を適用するロジックにします。

**決定事項**:
- **UI**: ヘッダー（Panoramaボタンの隣）に `<input type="range" min="1" max="5" />` を配置。
- **Label**: アイコン（Grid Icon）と現在の数値 `x3` 等を表示。
- **Logic**: 
    - スマホ: 常に `columns-1`
    - PC (`md`以上): ユーザー指定の `columns-N` を適用 (`md:columns-[N]`)。
- **Persistence**: `localStorage` に前回の設定値を保存する（ViewModel層で管理）。

## 4. 結論

**Antigravity**:
「Panorama Mode」選択時のみ、ヘッダー右側に**「カラム数スライダー」**を表示します。
直感的なズーム操作感覚で、1〜5カラムを自由に制御できるようにします。
