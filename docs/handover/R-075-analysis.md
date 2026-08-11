# R-075 Flow モーダル入力遅延 分析・修正報告

## 結論

追加報告により、xyflow を使わないガントでも `ImprovementRequestModal` の入力遅延が発生することが判明した。両画面に共通する根因は `SimpleModal.tsx:15` の全画面 `backdrop-blur-sm` である。文字入力によるモーダル再描画のたびに、背後の大規模な Flow／ガント画面へ `backdrop-filter` の再合成負荷が掛かる構成だった。

Flow には追加の増幅要因がある。エッジは `FlowScreen.tsx:236`（再生成経路は `:552`）で全件 `animated: true` となり常時 CSS animation しているため、ぼかし越しの背景自体も継続的に変化する。ガントには React Flow edge animation は存在せず、同じ原因ではない。結論は「共通根因 = SimpleModal の blur、Flow 固有増幅要因 = animated edge」であり、ガント固有の QuantityEngine 再計算や別 state 更新は確認されなかった。

React state の共有による背景再レンダー説は確認できなかった。追加した `ImprovementRequestModal.test.tsx` のレンダーカウント試験では本文へ5回 change を発火しても背後の重い画面役コンポーネントの追加レンダーは 0 回だった。`ImprovementRequestModal.tsx:135` の onChange は `setContent` のみで、画像検証・Object URL 作成は file change / paste 時だけ実行される。既存試験 `R-058-rerender-isolation.test.tsx:97` でも判断詳細タイトルへの5回 change で `SideCalendarPanel` の追加レンダーは 0 回。また Flow の keydown は window ではなく Flow wrapper に登録され（`FlowScreen.tsx:965`）、入力イベントは冒頭の `shouldIgnoreKeyEvent` で return する（`:843`）。

## 画面別再現と測定上の制約

開発サーバーは起動できたが、この実行環境には接続可能なブラウザがなく、Chrome Performance / React DevTools Profiler の実機トレースは取得できなかった。ガントでの症状は発注者の実機報告を再現情報として採用し、自動レンダーカウントとコード経路で切り分けた。

before/after のミリ秒値は未測定。自動検証で確認できた定量値は、ImprovementRequestModal で5文字入力時の背景追加レンダー 0 回、判断詳細で5文字入力時のカレンダーパネル追加レンダー 0 回、修正後は SimpleModal の backdrop-filter 0 個、かつ Flow モーダル表示中は animated edge が全件 `animation-play-state: paused` になること。

## 修正内容

- `JWCADTategu.Web/src/index.css`: `body:has([data-youkan-modal-overlay])` 配下の animated edge を一時停止。モーダルを閉じるとセレクター不成立になり自動再開。
- `DecisionDetailModal.tsx`: 判断詳細オーバーレイに `data-youkan-modal-overlay` を付与。
- `DecisionDetailModal.tsx`: レビュー追補で `backdrop-blur-sm` も削除し、暗幕 `bg-black bg-opacity-50` は維持。
- `SimpleModal.tsx`: 改善要望を含む共通モーダルのオーバーレイに同属性を付与し、共通根因の `backdrop-blur-sm` を削除。半透明背景は維持。
- `FlowModalAnimationPause.test.ts`: 両モーダルの識別属性、Flow animation 一時停止、SimpleModal が blur を使わない性能条件を固定。
- `ImprovementRequestModal.test.tsx`: 本文を5回変更しても背景画面が再レンダーされない計測試験を追加。
- `docs/SPEC/03_画面設計.md`: モーダル表示中の Flow animation 一時停止仕様を追記。
- `docs/SPEC/06_変更履歴.md`: R-075 の変更履歴を追記。

## TDD と検証結果

Red: 新規試験を先に実行し、識別属性なし／停止 CSS なしで 2/2 failure を確認。

追加 Red: ガント報告後、SimpleModal の backdrop-filter 禁止試験が 1 failure。背景レンダーカウント試験を含む残り 14 件は pass。

Green: 追加修正後、R-075 3件、ImprovementRequestModal 12件、既存 R-058 3件の合計 18/18 pass。`npm.cmd run build` も成功。

レビュー追補 Red→Green: DecisionDetailModal にも blur 禁止条件を追加し 1 failure / 2 pass を確認後、`backdrop-blur-sm` を削除して Green 化した。

追加修正後の全 frontend suite (`npm.cmd run test -- --run`) は exit 1。今回の対象試験は成功したが、既存 `useAssigneeView.test.ts:180` の日付依存試験が単独再実行でも 1 failure（7/8 pass）、`PanoramaBoard.showGroups.test.tsx` が一度だけ全体実行時に30秒 timeout、既存 `KeyboardAndButtons.test.tsx` 起因の未処理 Promise error が1件残った。追加修正後の production build は成功。

### stash による修正前比較

`git stash push -u -m "R-075修正前比較用"` で tracked / untracked の全変更を退避し、clean な元ブランチ状態で全suiteを2回実行した。

- `KeyboardAndButtons.test.tsx` 起因の `DecisionDetailModal.tsx:350` 未処理 Promise error: 2/2回再現。R-075修正前から存在する既存事象。
- `useAssigneeView.test.ts:180`: 2/2回再現。日付依存の既存事象。
- `PanoramaBoard.showGroups.test.tsx` timeout: 0/2回（両方pass）。修正あり状態でも単独実行は3/3 passであり、以前の1回は全体負荷時の非決定的フレークだったが、修正前で同じtimeoutが再現したとは断定しない。

検証後 `git stash pop` は成功し、8ファイルすべてを復元、比較用stashはdropされた。

## Git 制約

`git branch -m fix/R-075-flow-modal-input-lag` は `logs/refs/heads/worktree-agent-a35edcf2b36ad38fc` を `logs/refs/.tmp-renamed-log` へ移動できず permission denied で失敗した。一方、renameを伴わない `git checkout -b fix/R-075-flow-modal-input-lag` は成功し、指定ブランチへ切り替えた。
