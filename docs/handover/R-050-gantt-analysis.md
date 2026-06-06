# R-050 ガントビュー無限スクロール感の分析

**日付**: 2026-06-06
**担当 Agent**: feature/R-050-gantt-infinite-scroll
**ベース実装**: R-042-Y2（IntersectionObserver sentinel）/ R-042-Y3（スケルトン UI）

---

## 1. ユーザー指摘（2026-06-06 ヒアリング）

> 「表示されてる件数が全部じゃないなー、スクロールで続きがロードされていくとかがないなーと思う。」

期待値: ガントで端までスクロールすると自動で続きが読み込まれる「無限スクロール感」。

---

## 2. R-042-Y2 で実装した現状の sentinel 配置

`RyokanGanttView.tsx` の Body スクロールコンテナ内に以下の構造で配置されている:

```tsx
<div ref={effectiveScrollRef} className="flex-1 overflow-auto overflow-x-auto relative min-h-0">
    <div ref={setBeforeRef}  className="absolute top-0 bottom-0 left-0  w-px ... z-0" />
    <div ref={setAfterRef}   className="absolute top-0 bottom-0 right-0 w-px ... z-0" />
    <div className="min-w-max pb-32 relative">
        {/* 本体（横スクロールするのはこの中身） */}
    </div>
</div>
```

`RyokanTimelineView.tsx` の横向き表示時も同様（`absolute top-0 right-0/left-0`）。
`RyokanGridView.tsx` だけは縦スクロール本体の前後にインラインで `h-px w-full` の sentinel を置いており構造的に正しい。

---

## 3. lazy load が「不発に見える」根本原因

### 原因 A: sentinel が「スクロールコンテンツ末端」ではなく「コンテナビューポート」に貼り付いている

`position: absolute` + `left-0` / `right-0` は **コンテナ（`position: relative`）の box** を基準にする。これはスクロール量に追従せず、常にビューポート（コンテナ内の見えている枠）の左右端に貼り付く。

その結果、IntersectionObserver の判定は:

- `lazy-sentinel-before`: 常にコンテナ左端 = **マウント直後に交差済み** → 1 回 fire してその後静まる
- `lazy-sentinel-after`: 常にコンテナ右端 = **常に交差状態**（右端から離れない）。
  しかし `rootMargin: 200px` 内に**最初から入っている**ので、初回 1 回 fire したらユーザーが横スクロールしても再 fire されない。

つまりユーザーがどれだけ横スクロールしても sentinel が "末端に到達した" イベントは発火しない。R-042-Y1 の月キャッシュロジックは正しく動くが、**呼ばれない**。

### 原因 B: 「もう何も来ない」と思える UI 上の理由

- 6/24 12:00 にロード成功しても、ガント本体は colWidth=24px の細かいセルなので、3 ヶ月分（≒90 列 = 2160px）追加されたことが視覚的にわかりにくい
- ロード中スケルトンも左右の縦長帯（w-24）なのでヘッダー追従でない限り見落とす
- 「読み込み済み範囲: ±6 ヶ月」「+3 ヶ月読み込み中…」のような明示ステータスが**どこにも出ていない**
- ユーザー操作で「もっと読み込む」を **明示発火するボタンも無い**

### 原因 C: gantt は本体 Body だけでなく Header もスクロール同期している

R-042-Y2 の sentinel は Body 側にしか置かれていないが、Header と Body はスクロール同期しているので機能上は問題ない。ただ Body sentinel が原因 A で壊れているのでまず A の解決が必要。

---

## 4. 修正方針

### sentinel 構造の修正

- `absolute` 配置をやめ、**スクロールコンテンツ（`min-w-max` の子）の先頭・末尾にインライン**で sentinel を配置する
- sentinel は横スクロール本体に沿って動くので、ユーザーが右にスクロールしていくと自然に viewport へ近づき → IntersectionObserver が fire する
- `rootMargin: '200px'` のままで OK（R-042-Y2 採用値）

### ステータス表示

- ガントの上部ステータスバー（Body 上端に sticky）に「読み込み済み範囲: YYYY-MM 〜 YYYY-MM」を常時表示
- `isLoadingMore=true` のときは「+3 ヶ月読み込み中…」を強調表示

### 「もっと読み込む」ボタン

- ステータスバー内に **前へ / 後ろへ** の 2 つボタンを配置
- ユーザー意思で明示的に追加読み込みできる退路。sentinel 不発時の保険になる

### 上限ガード

- ロード済み月数が 24 ヶ月（±12 ヶ月）を超えたら警告メッセージを表示し、ボタンも disable
- `loadedRange` から月数を算出して判定

---

## 5. 実装ファイル

- `RyokanGanttView.tsx`: sentinel 配置の修正＋ステータスバー＋「もっと読み込む」ボタン
- `RyokanCalendar.tsx`: `loadedRange` を `RyokanGanttView` まで素通しする
- 既存テスト (`RyokanGanttView.lazyLoadSentinel.test.tsx`) は data-testid の存在のみ確認しているため壊れない見込み
- 新規テスト: 「もっと読み込むボタン押下で onLoadMore が呼ばれる」スパイテスト

---

## 6. スコープ外（R-046-Y1 等で別 Agent 担当）

- R-046-Y1: CSS / Tailwind 整理
- R-049: テスト棚卸し
- グリッド/タイムラインの sentinel 修正は本タスクのスコープ外（同じ問題は残るが、ユーザー指摘は「ガント」に限定されているため次回タスクで対応）

---

## 7. 参考

- R-042 議事録: `secretary/notes/2026-06-04-会議-R041-R042仕様確定.md`
- 関連実装: `useLazyLoadSentinel.ts`（R-042-Y2 で新設）/ `useExternalEvents.ts`（R-042-Y1 で範囲拡張）
