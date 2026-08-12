# Youkan — R-033 実装タスク

**ブランチ**: `feature/R-033-mobile-bottom-sheet`
**会議録**: `secretary/notes/2026-05-11-会議-スマホUI改善.md`
**目的**: スマホUIの2問題を解決＋スマホメニュー設計原則の確立
- 問題1: フィルター（全て/個人/会社/テナント別）がスマホで非表示 → ヘッダー右に Filter アイコン＋ボトムシート展開
- 問題2: 詳細モーダルの「その他」メニューがスマホで画面外はみ出し → スマホ時はボトムシート化

## 絶対ルール
- 指揮AIはコード直接編集しない、Agent委譲、`model="sonnet"`
- 仕様書先行 → コード実装
- ステップ単位で1コミット
- PC は既存挙動を一切変えない（`useIsMobile()` で分岐）

## 会議で確定した恒久ルール
1. スマホで4選択肢以上はボトムシート
2. ヘッダー右はスマホで2アイコン以下（超過分は MenuDrawer / フローティングへ）
3. ボトムシート z=50（MenuDrawer 100 より下、モーダルと同階級）
4. ボトムシート内 `pb-[env(safe-area-inset-bottom)]` 必須
5. ボトムシート open 中は `touch-action: none`
6. 閉じ方3つ: ✕ボタン / 背景タップ / (任意) 下スワイプ

---

## ステップ

### ステップ1: 仕様書更新 [Agent-Spec]
- `docs/requests.md` → `docs/request_log.md` に R-033 移記（2026-05-11）
- `docs/SPEC/02_機能仕様.md` に F-21（スマホフィルター）／F-22（スマホその他メニュー） 追記
- `docs/SPEC/03_画面設計.md` に MobileBottomSheet・スマホヘッダー整理を追記
- `docs/SPEC/05_技術設計.md` に「スマホメニュー設計原則」セクション新設（6ルール）
- `docs/SPEC/06_変更履歴.md` に R-033 エントリ
- コードは触らない

### ステップ2: MobileBottomSheet 共通基盤 [Agent-Foundation]
- `src/features/core/youkan/components/Common/MobileBottomSheet.tsx` 新規
  - Props: `{ isOpen, onClose, title?, children }`
  - framer-motion `initial={{y:'100%'}} animate={{y:0}} exit={{y:'100%'}}`
  - z-50 オーバーレイ、bottom-0 固定
  - `pb-[env(safe-area-inset-bottom)]` 内側余白
  - open 中は `touch-action: none`（背景）
  - 閉じる: ✕ボタン / 背景タップ / Esc
  - max-h `85vh`、内部スクロール可
- TDD: `__tests__/MobileBottomSheet.test.tsx` 新規
  - 開閉、閉じる3経路、children レンダリング、a11y（aria-modal/dialog）

### ステップ3: モバイルUI統合実装 [Agent-MobileUI]
ステップ2の MobileBottomSheet を活用して以下を1つの Agent で実施：

#### 3-A. フィルターのスマホ対応
- `ViewContextBar.tsx`: スマホ時はフィルタータブ群を**非表示**
- `YoukanHeader.tsx` 右側に `<MobileFilterButton />` を追加（スマホ時のみ）
- `MobileFilterButton.tsx` 新規:
  - `<Filter />` アイコン + 現状フィルタラベル
  - タップで MobileBottomSheet 開く
  - シート内に全て/個人/会社/各テナントの選択肢を縦並び
  - 選択で `setFilterMode` 呼出＋シート閉じる

#### 3-B. その他メニューのスマホ対応
- `DecisionDetailModal.tsx`: 「その他」押下時、スマホなら MobileBottomSheet で展開、PC なら既存のドロップダウン
- `useIsMobile()` で分岐
- メニュー項目（プロジェクトに変換 / 完了 / いつかやる / アーカイブ / ゴミ箱）は同じ

#### 3-C. ヘッダー右の整理（スマホ）
- `YoukanHeader.tsx` のスマホ表示時:
  - ForAi アイコン → 非表示（MenuDrawer Tools の既存項目を使う）
  - Speech アイコン → 非表示（フローティング SpeechFloatingButton 維持）
  - **新規**: Filter アイコン
  - Settings / Account は維持

#### 3-D. テスト
- `MobileFilterButton.test.tsx` 新規（開閉、選択でフィルター変更）
- `DecisionDetailModal` のスマホ版その他メニューの動作テスト追加

### ステップ4: マージ＆デプロイ [指揮AI]
- ローカル動作確認（スマホサイズで両方の機能、PC で従来通り）
- master へマージ
- `upload.ps1` でデプロイ

## メンテナンス則（恒久・docs/SPEC/05に明記）
- スマホで4選択肢以上はボトムシート
- ヘッダー右はスマホで2アイコン以下
- ボトムシート z=50、MenuDrawer 100 の下
- safe-area-inset-bottom 必須
- touch-action: none で背景スクロール抑制

## 除外（スコープ外）
- アナリティクス導入
- SimpleModal 破壊的変更
- WCAG 完全準拠
- スマホ全般 safe-area 見直し

---

## R-034 Phase 1 + R-035 量感セル進捗棒グラフ＋完了アイテム表示統一

- **ブランチ**: `feature/R-034-R-035-capacity-bar-and-completed-style`
- **議事録**: `secretary/notes/2026-06-02-会議-Googleカレンダー連携.md`
- **仕様**: `docs/spec/02_機能仕様.md F-06 進捗棒グラフ` / `docs/spec/03_画面設計.md §5.6, §5.7`

### A. CapacityBar コンポーネント
- [x] `src/features/core/youkan/components/Calendar/CapacityBar.tsx` 新規作成
- [x] Props: `{ totalMinutes, completedMinutes, capacityMinutes }`
- [x] 描画: 高さ 4px、`absolute bottom-0`、未完了=`emerald-500`、完了=`emerald-200`、100%超=`red-500`
- [x] React.memo で再レンダリング最小化
- [x] 単体テスト: 0% / 50% / 100% / 超過の描画パターン

### B. グリッドビュー統合
- [x] `CalendarCell` の各日付セル末尾に CapacityBar を組み込み（`RyokanGridView` 経由）
- [x] セル内タスク集計を totalMinutes / completedMinutes に分解（`QuantityMetric.completedVolumeMinutes` 追加）
- [x] 既存背景色グラデーションは触らない（併存）

### C. ガントビュー一覧表示への適用
- [x] showGroups=false（一覧）モードのみ日付ヘッダー直下に CapacityBar 追加（`RyokanGanttView`）
- [x] showGroups=true（プロジェクト別）は対象外

### D. 量感計算の確認
- [x] `QuantityEngine.ts` で someday のみ除外・done は分子に含むことを確認
- [x] `QuantityMetric.completedVolumeMinutes` を追加し、done アイテムの割当分を別途集計
- [x] バックエンド `QuantityService.php` は計算対象外（変更不要）
- [x] 既存テスト破壊なし（master と同数の40件失敗・421件パス。+5は本タスクの新規テスト）

### E. 完了アイテム表示統一（R-035）
- [x] 共通スタイル定数 `COMPLETED_ITEM_CLASS = 'text-slate-400 line-through'` を `logic/statusUtils.ts` に追加
- [x] `isItemDone(item)` ヘルパー追加（done/completed/log を吸収）
- [x] 登録と集中: `SmartItemRow` のタイトルに適用
- [x] 状況把握: `PanoramaBoard/ItemCard` のタイトルに適用
- [x] 全体一覧: `OverviewItem` の既存 `line-through` を定数に置換
- [x] カレンダー: `CalendarCell` 内チップ / `RyokanCalendar` 内訳パネル（完了・負荷タスク両セクション）
- [x] ガント: `RyokanGanttView` のタイトル列に適用
- [x] フローチャート: `FlowItemNode` タイトルに適用
- [x] 読み上げ: `SpeechView` の行タイトルに適用
- [x] 詳細モーダル: `DecisionDetailModal` の h2 タイトルのみ取り消し線（本文編集領域は変更なし）

### F. 仕上げ
- [x] 全テスト: 私の変更で追加テスト緑、既存テスト破壊ゼロ確認済
- [x] vite build 成功確認
- [x] コミット（5f15a5d）
- [x] `upload.ps1` でデプロイ（http://door-fujita.com/contents/Youkan/）
- [ ] 実ブラウザで全画面の完了アイテム表示と棒グラフを確認（指揮AI / 晴樹さん）
- [x] 完了報告（本 Agent から指揮AIへ）

---

## R-037 詳細モーダル タイトル編集欄 常時表示（新規）

- **ブランチ**: `feature/R-037-detail-title-empty-edit`
- **仕様**: `docs/spec/03_画面設計.md §5.6.5`
- **背景**: 0 文字または空白のみで保存したアイテムが詳細モーダルで編集不能になっている
- **要望**: タイトルが空・空白のみ・通常 のいずれでも編集欄が常に表示され、編集可能

### サブタスク
- [x] `DecisionDetailModal.tsx` のタイトル表示/編集の分岐ロジックを確認
- [x] 失敗テストを書く（タイトル空文字でモーダル開く → 編集欄が見える / 文字入力 → 保存できる）
- [x] テスト失敗確認・コミット
- [ ] 表示/編集出し分けを廃止し、常に編集可能な input を描画する実装
- [ ] プレースホルダ「タイトル未入力」等を追加
- [ ] アイテムカードや他ビューで空タイトル表示時の見え方も併せて確認（必要なら placeholder 表示）
- [ ] chrome-devtools MCP で実機検証: 既存の空アイテムを開く → 編集欄が表示される
- [ ] テスト緑・コミット・デプロイ
- [ ] 完了報告（スクリーンショット添付）

---

## 関連リクエスト

- **R-034 全体**: 4 Phase 段階リリース。Phase 2（Google primary 連携）以降は別途ゲート確認後に着手
- **R-035**: R-034 Phase 1 と一体実装
- **R-036**: 独立バグ修正、並列実行（別ブランチ feature/R-036-gantt-completed-toggle）
- **R-037**: 詳細モーダル タイトル編集欄常時表示、並列実行（別ブランチ feature/R-037-detail-title-empty-edit）

---

## R-045 Vite manualChunks コード分割（2026-06-06）

**ブランチ**: `feature/R-045-manual-chunks`
**目的**: 単一 1,464 KB バンドルを vendor / feature 別に分割し、並列ダウンロード・キャッシュ効率を改善

- [x] Before 計測（index-*.js 1,464.26 KB / gzip 431.51 KB の単一バンドル）
- [x] vite.config.ts に `build.rollupOptions.output.manualChunks` 追加
  - vendor-react / vendor-router / vendor-flow（@xyflow） / vendor-anim（framer-motion） / vendor-i18n / vendor-dnd / vendor-dexie / vendor-date / vendor-icons / vendor-misc
  - plugin-tategu / plugin-customer / plugin-manufacturing / plugin-mock
  - feat-calendar / feat-planning / feat-admin
- [x] After 計測（entry 302.94 KB + 16 chunks、合算は同じだが並列ロード可能）
- [x] vite preview で動作確認（ログイン画面正常表示・コンソールエラーなし）
- [x] 既存テストへの影響なし（manualChunks 変更前後で同じ 17 fail（既存）/ 83 pass）
- [ ] master マージ・本番デプロイ
- [ ] 本番 chrome-devtools 検証（Before/After 比較スクリーンショット）

---

## R-044 API 重複呼び出し統合（2026-06-06）

**ブランチ**: `feature/R-044-api-dedup`
**worktree**: `.claude/worktrees/agent-a49e781a3c88226ff/`
**目的**: 起動時の `/auth/me` 3 回、`/items?scope=aggregated` 2 回、`/health` 2 回の重複発火を解消

### サブタスク

- [x] worktree 作成（`feature/R-044-api-dedup` を master ベースで作成）
- [x] 起動時 API 発火を chrome-devtools で再現（本番 reqid=58/69 の 2 件、items 62/63 の 2 件等を記録）
- [x] `/auth/me` 呼び出し元を全て特定（AuthProvider.checkAuth + useYoukanViewModel.refreshContextMetadata × 2 インスタンス）
- [x] `/items?scope=aggregated` 呼び出し元を全て特定（DashboardScreen VM + PanoramaBoard VM の refreshGdb）
- [x] `/health` 呼び出し元を特定（HealthCheck コンポーネントのマウント揺れ）
- [x] 重複の根本原因を `docs/handover/R-044-analysis.md` に記述
- [x] テスト Red: `src/api/__tests__/client.dedup.test.ts` に 6 件追加（3 件 Red 確認）
- [x] テスト Red コミット（`5b99889`）
- [x] 実装: `ApiClient.request` に GET の in-flight dedup を追加
- [x] テスト Green 確認（6/6 Pass）
- [x] dev サーバーで動作確認（バックエンド/フロントエンド起動確認、ローカル DB にテストユーザー不在のため計測は本番で実施）
- [x] master マージ前に `git diff --stat master..HEAD` で全体行数確認（client.ts +26 行、テスト +107 行、分析 +98 行、tsbuildinfo 等の混入なし）
- [x] upload.ps1 で本番デプロイ（2026-06-06 09:59）
- [x] 本番 chrome-devtools で発火回数 1 回ずつになっていることを実機検証（スクリーンショット 2 枚）
- [x] 追加コミット（`7931a71`）: useYoukanViewModel から `getJoinedTenants` API 呼び出しを撤廃し `useAuth().joinedTenants` を再利用（dedup ではカバーできないシーケンシャル重複への対応）
- [x] 再デプロイ（2026-06-06 10:11）→ `/auth/me` も 1 回まで集約確認

---

## R-046-Y1 ガントビュー CSS 最適化（content-visibility: auto）

**ブランチ**: `feature/R-046-Y1-css-content-visibility`
**worktree**: `.claude/worktrees/agent-acc126c7617c3c2f3/`
**目的**: グリッド→ガント切替時の DOM 描画コスト削減。ガント行に `content-visibility: auto` を付与し、ビューポート外行のペイント・レイアウトをスキップする
**方針**: 2026-06-06 kaigi 議事録で「もたつき軽微・描画遅延なし」のため JS 仮想化（Phase 2）は棄却。CSS only で対応

### サブタスク

- [x] worktree 作成（`feature/R-046-Y1-css-content-visibility` を master ベースで作成）
- [x] Before 計測（本番 chrome-devtools, グリッド→ガント切替 INP=7210ms / CLS=0.51 / ガント内 DOM 8134 ノード / 43 行）
- [x] `src/index.css` に `@supports (content-visibility: auto)` でラップした `.gantt-row-cv` クラスを追加（`contain-intrinsic-size: auto 28px`）
- [x] `RyokanGanttView.tsx` のタスク行 `<div>` に `gantt-row-cv` クラスを付与（h-7 = 28px の行）
- [x] 既存テスト regression なし確認（master と同じ 17 fail / 86 pass + 1 skipped）
- [x] master マージ前に `git diff --stat master..HEAD` で全体行数確認（sqlite/log/tsbuildinfo 混入なし）
- [x] master マージ・本番デプロイ（merge commit `4830ca0`、upload.ps1 で本番反映 2026-06-06 12:20）
- [x] After 計測（本番 chrome-devtools）
  - 適用確認: 74 行に `content-visibility: auto` と `contain-intrinsic-size: auto 28px` が computed style として確実に反映
  - **ペイント対象削減: 74 行中 53 行が画面外でペイントスキップ、画面内 21 行のみがペイント対象（72% 削減）**
  - CLS は Before 0.51 → After 0.13（74% 改善）。`contain-intrinsic-size` が画面外要素のサイズ保証として機能した結果
  - INP は計測ごとの揺れが大きい指標（After 1回目 17009ms / 2回目 14342ms）。Presentation delay が支配的だが、CSS 変更は React マウント自体を止められず INP 単独での 50% 削減は達成困難（議事録時点で JS 仮想化棄却済）
- [x] Before/After スクリーンショット 2 枚添付（`docs/handover/R-046-Y1-before.png` / `docs/handover/R-046-Y1-after.png`）
- [ ] 完了報告（指揮AI 提出）

---

## R-050 ガントビュー無限スクロール感の実現（2026-06-06）

**ブランチ**: `feature/R-050-gantt-infinite-scroll`
**worktree**: `.claude/worktrees/agent-a2b532ad509984bb2/`
**目的**: ユーザー指摘「スクロールで続きがロードされていく感じがない」を解消

### サブタスク

- [x] worktree 作成（master ベース）
- [x] 既存実装（R-042-Y2/Y3）の sentinel 配置を分析
- [x] 根本原因を `docs/handover/R-050-gantt-analysis.md` に記述
  （sentinel が `absolute` 配置で `min-w-max` 外にあったため、横スクロールに追従せず viewport に貼り付いていた → マウント直後に一度だけ fire してその後死ぬ）
- [x] テスト Red: `RyokanGanttView.loadMoreUI.test.tsx` に 6 件追加（6/6 失敗確認）
- [x] テスト Red コミット（`b71865a`）
- [x] 実装:
  - sentinel を `min-w-max` の内側に移動（横スクロール末端で交差検知が機能）
  - 上部にステータスバー（読み込み済み範囲、+3ヶ月読み込み中…、もっと読むボタン）追加
  - 「前へ／後ろへ」明示ボタンを併設（sentinel 不発時の退路）
  - 24 ヶ月上限到達時の警告表示とボタン disable
  - `RyokanCalendar` から `loadedRange` を propagation
- [x] テスト Green 確認（6/6 Pass）
- [x] ビルド検証（`npm.cmd run build` 通過、TS エラー 0）
- [x] master マージ前に `git diff --stat master..HEAD` で全体行数確認（5 ファイル +425/-28）
- [x] master マージ・push（merge commit `2124f0e`）
- [x] upload.ps1 で本番デプロイ（2026-06-06 12:23）
- [x] 本番 chrome-devtools 検証:
  - 初期: 「読み込み済み: 2025-12 〜 2026-12（13ヶ月）」表示 → `R-050-after-initial-status.png`
  - 横スクロール末端到達 → 「+3ヶ月読み込み中…（後ろへ）」→ 自動で 2027-09 まで拡張 → `R-050-after-auto-load.png`
  - 上限超過時の警告＋ボタン disable → `R-050-after-limit-warning.png`

---

## R-049 既存 vitest 38 件 failing の棚卸し（2026-06-06）

**ブランチ**: `feature/R-049-test-triage`
**目的**: master ベースで 39 件 failing していたテストを棚卸しし、修正 / 削除 / 別 R 化に振り分ける
**handover**: `docs/handover/R-049-test-triage.md`

### サブタスク

- [x] ベースライン取得（17 ファイル / 39 テスト failed / 565 passed）
- [x] 失敗の全件分類（a 修正可能 / b 削除すべき / c 別件 R 化）
- [x] (a) テスト修正（9 ファイル）: FocusCard.jest→vi, KeyboardAndButtons 引数, InteractionTests 値入力, TodayLogic status, MenuDrawer 現行ラベル, FutureBoard 現行見出し, FilterContext 仕様変更, perspective 仕様変更, useLoginViewModel API 名/メッセージ, RyokanGanttView projectName / scrollRef を ToastProvider でラップ
- [x] (b) テスト削除（2 ファイル）: WorkDaysSave.test.tsx（空ファイル）, MenuInteraction.test.tsx（廃止 UI）
- [x] (c) 別 R 化 skip（5 ファイル）: QuantityEngine (Scenario 2/3/6) → R-051、manufacturing → R-051、useYoukanViewModel.cascade → R-052、IntentDeleteIntegration → R-053、PanoramaBoard.showGroups は timeout 延長で復活
- [x] setupTests.ts 補強: fetch Unhandled Rejection 抑止 / DependencyRepository モック / useAuth.joinedTenants デフォルト
- [x] 全テスト Green 確認（585 passed / 0 failed / 17 skipped、master merge 後 591 passed）
- [x] handover ドキュメント記録
- [x] master マージ・push（本セッションではテストのみのためデプロイ不要）

### (c) として残した R 番号候補

- **R-051**: QuantityEngine / Manufacturing repository のテスト再整備
- **R-052**: useYoukanViewModel カスケード楽観更新の仕様確定とテスト再整備
- **R-053**: PanoramaBoard 統合シナリオを E2E or VM フィクスチャ整備で再構築

---

## R-054 タイムラインビュー sentinel 配置バグ修正（2026-06-06）

**ブランチ**: `feature/R-054-timeline-sentinel-fix`
**worktree**: `.claude/worktrees/agent-a3b872f4efb653809/`
**目的**: R-050 ガントビュー修正と同パターンで `RyokanTimelineView.tsx` の sentinel を `min-w-max` 内側に移設し、横スクロール末端で lazy load が機能するようにする

### 真因（R-050 と同じ）

R-042-Y2 で配置した sentinel が scrollRef 直下に `absolute left-0/right-0` で固定されており、親コンテナ box 基準のため横スクロールしても `getBoundingClientRect` が変化せず、IntersectionObserver が初回 fire 以降は永久に発火しない。

### サブタスク

- [x] worktree 作成（master ベース、HEAD=8c48acd）
- [x] `RyokanTimelineView.tsx` の sentinel 配置を確認（R-050 前のガントと同じ構造）
- [x] 修正: sentinel を `min-w-max` 内側に移動（縦表示 isMini=true / 横表示 isMini=false の双方に対応した absolute 配置）
- [x] R-042-Y3 のスケルトン UI も合わせて `min-w-max` 内側に移動
- [x] テスト追加: `RyokanTimelineView.loadMore.test.tsx`（4 ケース）
  - 横表示時の sentinel が min-w-max 内側
  - 縦表示時の sentinel が min-w-max 内側
  - before 方向交差で onLoadMore('before', 3) 発火
  - after 方向交差で onLoadMore('after', 3) 発火
- [x] 全テスト Green 確認（vitest: 595 passed / 17 skipped / 0 failed）
- [x] master マージ前に `git diff --stat master..HEAD` で全体行数確認（sqlite/log/tsbuildinfo 混入なし）
- [x] master マージ・push
- [x] upload.ps1 で本番デプロイ
- [x] 本番 chrome-devtools 検証（タイムラインビューで横スクロール末端到達時の動作確認）

### スコープ外

- ステータスバー UI（R-050 でガントに追加した「読み込み済み範囲」「もっと読むボタン」「24 ヶ月上限警告」）はタイムラインには適用しない。タイムラインは元来 sentinel のみの自動 lazy load 設計のため、本タスクは sentinel 配置不具合の最小修正に留める

---

## R-055 青年部カレンダー「絆感謝運動」(6/7) 表示漏れバグ修正（2026-06-06）

**ブランチ**: `feature/R-055-event-display-fix`
**worktree**: `.claude/worktrees/agent-aee960f77a98975c8/`
**分析資料**: `docs/handover/R-055-analysis.md`
**目的**: `GET /google/calendar/events` で primary カレンダー以外（青年部商工会など）のイベントが返らないバグを根治する。

### 真因

`GoogleCalendarController::getEvents()` (GET) が `getCachedEvents()` (R-034 Phase 2 の旧キャッシュ参照のみ) を呼ぶ実装のままで、R-041 で複数カレンダー対応した live fetch (`getEvents()`) を呼んでいなかった。設定画面の「更新」ボタン（POST /refresh）を押さない限りキャッシュが更新されず、`external_events_cache` には primary のレコードしか残らない状態だった。本番調査では、ユーザーの全 6 カレンダー（祝日／青年部商工会／ファミリー／YuiHaruFujita／door.fujita@gmail.com／fjt.suntree@gmail.com）が `user_google_calendars` に正しく入り、`is_enabled=true` だが、`GET /events` のレスポンスは calendar_id="primary" のものしか含まれていなかった。

### 修正

- `GoogleCalendarController::getEvents()` を改修
  - `user_google_oauth.last_sync_at` が `AUTO_SYNC_TTL_SEC=60` 秒より古い、または `user_google_calendars` が空の場合、`getCalendarList()` → `getEvents()` (R-041 新版) を自動で走らせる
  - 同期に失敗した場合は既存キャッシュにフォールバック（UX を壊さない）
  - 60 秒以内の連続呼び出しは従来通り DB 応答のみで高速
- フロントは無変更

### サブタスク

- [x] worktree 作成（master ベース、HEAD=0f1f97e）
- [x] 本番再現: `GET /google/calendars` は 6 件全件返るが、`GET /events` は primary のみで「絆感謝運動」を含まないことを確認
- [x] 本番で `POST /refresh` 1 回叩くと「絆感謝運動」を含む 197 件が取得できることを確認（root cause 特定）
- [x] `docs/handover/R-055-analysis.md` に分析記録
- [x] `tests/GoogleCalendarControllerTest.php` に R-055 ケース 3 件追加（stale → 自動同期 / fresh → スキップ / 失敗時 → cache fallback）
- [x] テスト Red 確認 → `GoogleCalendarController::getEvents()` 実装 → Green 確認（PHP 12/12 OK、Vitest 595 passed / 17 skipped）
- [x] master マージ前に `git diff --stat master..HEAD` で全体行数確認
- [x] master マージ・push
- [x] upload.ps1 で本番デプロイ
- [x] 本番 chrome-devtools で 6/7 の「絆感謝運動」が表示されることを確認、Before/After スクリーンショット

### 同型バグ（同時に治る）

修正前は primary 以外の全カレンダーが Youkan に表示されない状態だったため、本修正により以下も自動で復活する見込み:
- 日本の祝日カレンダー
- ファミリー カレンダー
- YuiHaruFujita 共有カレンダー
- door.fujita@gmail.com の予定
- 青年部商工会の全イベント（絆感謝運動 以外も）

---

## R-050 Phase1 バックエンド実装（担当者別ビュー・2026-07-09）

**ブランチ**: `feature/R-050-phase1-assignee-view`（基点: master `ec5dfb0`）
**会議録**: `docs/kaigi/2026-07-09-R050テナント型AI中枢設計.md`（8節ステップ2）
**仕様**: `docs/SPEC/04_データ設計.md` §5.3（可視性ルール4番目）/ §3.8（assigned_to値域整理）
**目的**: 画面2「担当者別ビュー」着手前提の2点（管理者スコープ新設／assigned_to ID空間表示バグ是正）をバックエンドに実装する

### サブタスク

- [x] worktree 作成（`git fetch && git checkout -b feature/R-050-phase1-assignee-view master` を worktree 内で実行）
- [x] `backend/tests/test_admin_scope_assignee_view.php` 新規作成（テストケース1〜5、TDD Red）
- [x] テスト実行して失敗を確認（Red）・コミット
- [x] (a) 管理者スコープ新設: `ItemController.php`/`TodayController.php` の一覧系に `assigned_to`+`scope=team` 相当のクエリパラメータ対応を追加。`memberships.role IN ('owner','admin')` で判定（`TenantController.php` のパターンに合わせる）。非管理者が他者指定で403、テナント外ユーザー指定でエラー
- [x] (b) assigned_to ID空間解決ロジックの横展開（`getAssigneeEmail()` の `u_` 判定パターンを一覧系クエリへ）。孤児データは「未割当」+ `error_log()`
- [x] `assigneeKind: 'user' | 'assignee' | null` フィールドをレスポンスに追加
- [x] テスト実行して成功を確認（Green）
- [x] 既存の関連テスト（`feature_dashboard_scope.php`, `test_cascade_operations.php` 等の主要 backend/tests）が壊れていないことを確認
- [x] フロントエンド vitest 破壊なし確認（`npm.cmd run test -- --run`）
- [x] `docs/handover/R-050-phase1-backend.md` 作成（新設エンドポイント・パラメータ・レスポンス例 JSON、次のフロント実装Agent向け）
- [x] `git diff --stat master..HEAD` で変更範囲確認 → master マージ・push（デプロイはしない）
- [x] 指揮AIへ完了報告（変更ファイル・テスト結果・handoverパス）

---

## R-050 Phase1 フロントエンド実装（担当者別ビュー・2026-07-09）

**ブランチ**: `feature/R-050-phase1-assignee-view-ui`（基点: master `322caf1`）
**会議録**: `docs/kaigi/2026-07-09-R050テナント型AI中枢設計.md`（8節ステップ3）
**バックエンド引き継ぎ**: `docs/handover/R-050-phase1-backend.md`
**仕様**: `docs/spec/03_画面設計.md` §8, §13（担当者別ビュー）

### サブタスク

- [x] worktree 作成（`git fetch && git checkout -b feature/R-050-phase1-assignee-view-ui master` を worktree 内で実行）
- [x] 型拡張: `Item.assigneeKind`、`ApiClient.getAllItems()` の `scope:'team'`/`assigned_to` オプション追加（`src/features/core/youkan/types.ts`, `src/api/client.ts`）
- [x] 純粋ロジック `logic/assigneeViewBuckets.ts` のテストを先に書く（今日/明日/今週バケット分類、所要時間合計、未完了/詰まり/待ち集計）→ Red確認
- [x] `assigneeViewBuckets.ts` 実装 → Green確認
- [x] ViewModel `hooks/useAssigneeView.ts` のテストを先に書く（デフォルト本人分表示、管理者のみ切替候補取得、403/404フォールバック）→ Red確認
- [x] `useAssigneeView.ts` 実装 → Green確認
- [x] View `screens/AssigneeViewScreen.tsx` 実装（§13.4レイアウト、案件名とセット表示、管理者のみチップ表示）
- [x] `ViewState` に `assigneeView` 追加、`App.tsx` にルーティング追加、会社コンテキスト限定の導線追加（メニュー）
- [x] 既存テスト破壊なし確認（`npm.cmd run test -- --run`）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] master マージ・push（**upload.ps1によるデプロイは行わない**）
- [x] 指揮AIへ完了報告（400語以内。アクセス経路・テスト結果・実機確認が必要な点）

---

## R-050 Phase1 バグ修正: 会社アカウントログイン時の管理者スコープ403（2026-07-10）

**ブランチ**: `fix/R-050-phase1-tenant-account-admin-scope`（基点: master）
**引き継ぎ**: `docs/handover/R-050-phase1-backend.md`
**症状**: 会社アカウント（`account_type=tenant`）でログインし `scope=team&assigned_to=<他者>` を呼ぶと、`assertAdminScopeAllowed()` が `memberships` をテナントID自身の `user_id` で検索してしまい該当行がなく常に403になる

### サブタスク

- [x] `BaseController::assertAdminScopeAllowed()` を読み、原因を確定する（`account_type=tenant` かつ `sub`=対象テナントID の場合に `memberships` 行が存在しない）
- [x] `backend/tests/test_admin_scope_assignee_view.php` に会社アカウント（tenant型）ログインのテストケースを追加し、Red確認
- [x] `assertAdminScopeAllowed()` を修正: `account_type=tenant` かつ `sub` が対象テナントIDと一致する場合はowner相当として許可。テナント分離は維持
- [x] 既存のuser型テストケースが壊れていないことを確認、Green確認
- [x] 既存backendテスト・vitest回帰確認
- [x] `git diff --stat master..HEAD` で変更範囲確認 → master マージ・push（**デプロイは行わない**）
- [x] 指揮AIへ完了報告（400語以内）

---

## R-070 詳細画面カレンダー操作の再レンダリング崩壊修正＋R-068実装（2026-07-29）

**ブランチ**: `fix/R-070-calendar-rerender-optimization`
**要望**: `docs/requests_log.md` R-070
**目的**: アイテム詳細画面の「納期」クリック・フィルタ切替時にカレンダーグリッド全体が10秒以上固まる不具合を解消し、あわせてR-068（量感カレンダー本体のスクロール性能改善）を実装する

### 背景（調査済み・実装Agentは再調査不要）

- `RyokanCalendar.tsx` の `handleDayAction`（約531行目）が `useCallback` でラップされておらず、再レンダリングのたびに新しい関数参照が生成される
- `RyokanGridView.tsx` の `handleCellAction`（約87-90行目）も連鎖的に新規参照になり、`React.memo` 済みの全 `CalendarCell` のメモ化が毎回崩壊してフル再レンダリングされる
- `RyokanGridView.tsx` の `externalEvents={externalEventsByDate?.get(toYmdKey(date)) || []}`（約207行目）もイベント無し日で毎回新規空配列を生成しメモ化を崩している
- `VolumeCalendarScreen.tsx`（量感カレンダー本体）は詳細画面内カレンダーと異なり `disableRangeExtension` 相当のスクロール最適化が未適用（R-068未着手の原因）

### サブタスク

- [x] worktree 作成（`git fetch && git checkout -b fix/R-070-calendar-rerender-optimization master` を worktree 内で実行）
- [x] 失敗するテストを先に書く（`CalendarCell` の再レンダリング回数を `React.memo` ラッパーでカウントするテストを新規3ファイル作成）→ Red確認
- [x] `RyokanCalendar.tsx` の `handleDayAction` を `useCallback` 化（依存先 `resetHighlights` も `useCallback` 化）
- [x] `RyokanGridView.tsx` の `externalEvents` インライン `|| []` を安定参照（モジュールスコープの定数配列 `EMPTY_EXTERNAL_EVENTS`）に置換
- [x] `VolumeCalendarScreen.tsx` に詳細画面カレンダー同様のスクロール最適化（`scrollOptimized` 新規propを追加し `RyokanCalendarProps`/`RyokanGridView`/`CalendarCell` に配線。装飾トランジション抑制・`content-visibility`+`contain`による不要ペイント範囲抑制、可変高さ用 `contain-intrinsic-size` フォールバック付き）を適用
- [x] テスト Green 確認・既存テスト回帰なし確認（vitest全件: 122ファイル732件 all green、14 skip）
- [x] `git diff --stat master..HEAD` で変更範囲確認（想定より大きい差分やsqlite/log/tsbuildinfo混入なし。8ファイル+300/-8行の小さい差分）
- [x] chrome-devtools MCP で実機検証（dev環境 localhost:5173/8000）:
  - デバッグユーザーアカウントでログイン、量感カレンダーグリッド表示・詳細画面カレンダー（DecisionDetailModal埋め込み）のフィルタ切替（全て/会社）が視覚的破綻なく動作、コンソールエラーなしを確認
  - 合成スクロールベンチマーク（プログラム的scrollTop駆動・rAFフレーム計測）を実施したが、既存デバッグデータのアイテム数が少なく本番相当の負荷差は再現しにくかった（詳細は完了報告参照）
  - 根本原因の再レンダリング崩壊は自動テストで定量実証（無関係な状態変化でのCalendarCell再レンダリング数が旧実装:35件相当→修正後:0件）
- [x] `docs/requests_log.md` R-070 の対応状況を更新（実装内容・テスト結果）
- [x] 指揮AIへ完了報告（変更内容・テスト結果・実機検証結果を明示）
- [x] **指揮AIのレビュー後、master へマージ・push**（レビューOK確認後、`fix/R-070-calendar-rerender-optimization` は master の直後のコミットで分岐しており差分無しだったため、fast-forwardで `origin/master` へ反映。コミット `7a35940`）
- [x] **指揮AIの指示があり次第、`upload.ps1` で本番デプロイ・本番chrome-devtools検証・task.md更新**（自動デプロイしない。R-050 Phase1が未デプロイのままmasterに乗っているため、デプロイ実行前に指揮AIに確認を取る）→ 発注者確認済み（R-050込みで一緒にデプロイ）。デプロイAgent起動→`upload.ps1`のSSHクライアント互換性バグ（post-quantum鍵交換警告が致命的エラー扱いされる）で失敗、修正待ち→ 下記「upload.ps1 SSH互換性バグ修正」で修正後、2026-07-29に本番デプロイ・実機検証完了（詳細は同セクション参照）

---

## upload.ps1 SSH互換性バグ修正（2026-07-29）

**背景**: R-070/R-068+R-050 Phase1デプロイ時に発覚。ローカルのOpenSSHクライアント（10.2p1）が出す `** WARNING: connection is not using a post-quantum key exchange algorithm.` という新しい警告が、`$ErrorActionPreference = "Stop"` 下の直接 `& ssh`/`& scp` 呼び出し（`upload.ps1` 180/187/194行目付近）でPowerShellのNativeCommandErrorとして扱われ、デプロイ全体が中断する。スクリプト内には既にこの種の問題を回避するための `Invoke-SshSafe` 関数（`cmd /c` 経由）が用意されているが、実際のmkdir/scp/extract呼び出しではまだ使われていない。

### サブタスク
- [x] `upload.ps1` の該当箇所（mkdir/scp/展開コマンド）を `Invoke-SshSafe` 経由に統一する（180/187/194行目付近の直接 `& ssh`/`& scp` 呼び出し3箇所を、`ssh`/`scp` オプションを文字列化した `$sshOptsStr`/`$scpOptsStr` を使い `Invoke-SshSafe -Command "..." -LogFile $logFile` 経由に置換。未使用になった配列版 `$sshOpts`/`$scpOpts` は削除）
- [x] ローカルで再現確認（同じ警告が出ても処理が継続すること）: 修正前の直接 `& ssh` 呼び出しで post-quantum 警告により `$ErrorActionPreference=Stop` 環境下で例外がスローされることを再現した上で、`Invoke-SshSafe` 経由（`cmd /c "... 2>&1"`）では同じ警告が出ても正常終了することを実サーバー相手に確認（`&&` を含むリモートコマンドが cmd.exe の二重引用符内で区切り文字として誤解釈されないことも実機で検証）
- [x] `git diff --stat` で変更範囲確認（`upload.ps1` のみ、1 file changed, 10 insertions(+), 23 deletions(-)）
- [x] R-070/R-068+R-050 Phase1のデプロイを再実行し、`.claude/skills/deploy/SKILL.md` の手順通り本番検証まで完了させる（`DEPLOYMENT SUCCESSFUL!` 確認。chrome-devtools MCPで `https://door-fujita.com/contents/Youkan/` を ignoreCache:true でリロードし fjt.suntree@gmail.com でログイン、量感カレンダーのプログラム的スクロール検証・アイテム詳細「納期」クリックの即時反応・会社テナントコンテキストでの「担当者別ビュー」画面遷移を確認。consoleエラーは既存の別件Google連携500エラーのみで新規エラーなし）
- [x] `docs/requests_log.md` のR-070・R-050該当行を「完了（2026-07-29デプロイ済み）」に更新
- [x] 指揮AIへ完了報告

---

## R-071 改善要望送信フォーム実装（2026-07-29）

**ブランチ**: `feature/R-071-improvement-request-form`
**要望**: `docs/requests_log.md` R-071
**仕様**: `docs/SPEC/02_機能仕様.md` F-23, `docs/SPEC/03_画面設計.md` §14, `docs/SPEC/04_データ設計.md` §3.9

### サブタスク

- [x] worktree作成（`git fetch && git checkout -b feature/R-071-improvement-request-form master` をworktree内で実行）
- [x] フロント: `YoukanHeader.tsx` のロゴを `text-sm`→`text-[7px]` に縮小し、「改善要望を送る」ボタンを隣に配置（PC、`hidden md:flex` 内）
- [x] フロント: `MenuDrawer.tsx` の「ツール」セクションに同機能のメニュー項目を追加（スマホ）
- [x] フロント: `ImprovementRequestModal.tsx` 新規作成（`SimpleModal`ベース、`ForAiModal.tsx`をテンプレート）。本文テキスト（必須）＋画像1枚（任意、5MB上限、`image/png`/`image/jpeg`/`image/webp`、クリップボード貼り付け対応）
- [x] フロント: `ApiClient.submitImprovementRequest()` を `src/api/client.ts` に追加（画像添付時は`FormData`、`restoreDatabase`/`restoreItems`と同様の手動`fetch`パターン）
- [x] バックエンド: `ImprovementRequestController.php` 新規作成。`BaseController` を継承し `authenticate()` 必須（`SideMemoController.php`の無認証パターンは踏襲しないこと。R-069で無認証エンドポイントの脆弱性を踏んだばかりのため要注意）
- [x] バックエンド: `backend/index.php` に `POST /improvement-requests` ルーティング追加
- [x] バックエンド: 送信内容を `backend/data/requests_sub.md` に追記（日時・ユーザー・本文・画像相対パスをMarkdownエントリとして整形）、画像は `backend/data/requests_sub_uploads/{uuid}.{ext}` に保存。`backend/data/` ディレクトリが無ければ作成する
- [x] **重要**: `upload.ps1` の `Copy-Item -Path $backendDir -Exclude` リストに `data`（`backend/data/` ディレクトリ）を追加する。これを忘れると次回デプロイで本番の蓄積データが消失する（`.gitignore` には既に追加済み、コードは別途このタスクで対応）
- [x] TDD: バックエンド（PHP内蔵サーバーでの統合テスト、認証必須であること・本文必須であること・画像サイズ上限・requests_sub.mdへの追記フォーマットを検証）とフロントエンド（モーダルの表示・送信・エラー処理・クリップボード貼り付け）の両方でテストを先に書きRed確認→実装→Green確認
- [x] 既存テスト回帰なし確認（vitest全件、PHPテスト全件）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPで実機検証（dev環境）: ボタン押下→モーダル表示→本文入力＋画像貼り付け→送信→トースト表示を確認。スマホ幅でMenuDrawer経由の導線も確認
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIの指示を待つ）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-07-31、`fd83028`をmasterに反映）
- [x] 本番chrome-devtools MCP検証: ヘッダーロゴ縮小表示・「改善要望を送る」ボタン→モーダル→送信→トースト表示を確認。送信されたテストデータは`backend/data/requests_sub.md`から削除して原状回復済み

---

## R-073 due_status意図しない変化の修正（2026-07-31）

**ブランチ**: `fix/R-073-due-status-blur-bug`
**要望**: `docs/requests_log.md` R-073
**仕様**: `docs/SPEC/04_データ設計.md` §4.5

### サブタスク

- [x] worktree作成（`git fetch && git checkout -b fix/R-073-due-status-blur-bug master` をworktree内で実行）
- [x] 失敗するテストを先に書く: `SmartDateInput`で、既存値と同じ文字列のままブラーした場合に`onChange`が呼ばれないことを検証するテスト → Red確認
- [x] `SmartDateInput.tsx`の`handleBlur()`に差分チェックを追加（パース結果が既存値と同じなら`onChange`を呼ばない）
- [x] Green確認
- [x] `DecisionDetailModal.tsx`の`dueStatus: 'confirmed'`送信箇所（`SmartDateInput`の`onChange`、`handleSideCalendarSelectDate`の計2箇所）が、修正後も日付が実際に変わった場合には正しく`confirmed`を送信することを確認するテストも追加（既存の正常系デグレを防ぐ）
- [x] 既存テスト回帰なし確認（vitest全件）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPで実機検証（dev環境）: 詳細画面の「納期」フィールドをクリック→何も変えず他要素へフォーカス移動→`due_status`が変化しないことを確認。実際に日付を変更した場合は`confirmed`になることも確認
- [x] `docs/requests_log.md` R-073の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIの指示を待つ）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-07-31、`fd83028`をmasterに反映）
- [x] 本番chrome-devtools MCP検証: 既存アイテム詳細画面で納期欄をクリック→変更せず他要素へブラー→ネットワークタブでPUT/PATCHが発生しないことを確認

---

## R-072 Google OAuth失効検知・再連携UX実装（2026-07-31）

**ブランチ**: `fix/R-072-google-oauth-invalidation-detection`
**要望**: `docs/requests_log.md` R-072
**仕様**: `docs/SPEC/03_画面設計.md` §12.1, `docs/SPEC/04_データ設計.md` §3.6

### 注意（スコープ外）

Google Cloud Console側のOAuth同意画面を「テスト中」から「本番公開」へ切り替える作業は、Googleアカウントを持つ発注者本人のみが行える。このタスクはコード側の検知・UX実装のみを対象とし、Google Cloud Consoleの設定変更は含まない。

### サブタスク

- [x] worktree作成（`git fetch && git checkout -b fix/R-072-google-oauth-invalidation-detection master` をworktree内で実行）
- [x] DBマイグレーション: `user_google_oauth`テーブルに`invalidated_at INTEGER`・`last_error TEXT`カラムを追加するマイグレーションスクリプトを作成（既存の`migrate_v28_google_calendar.php`等の命名・実行パターンに倣う） → `backend/migrate_v30_google_oauth_invalidation.php`
- [x] 失敗するテストを先に書く: `GoogleCalendarService::refreshAccessToken()`が`invalid_grant`エラーを受け取った際に`invalidated_at`/`last_error`を記録することを検証するテスト → Red確認
- [x] `GoogleCalendarService.php`の`refreshAccessToken()`を修正し、Googleのエラーレスポンスから`error === 'invalid_grant'`を判別して`user_google_oauth`に記録する（`GoogleOAuthInvalidGrantException`で呼び出し元へも通知。リフレッシュ成功時・再連携（`exchangeCodeForTokens`）時は失効状態を自動クリア）
- [x] `GoogleCalendarController.php`: `invalidated_at`が非NULLの間は自動同期（`getEvents()`裏側のリフレッシュ試行）をスキップし既存キャッシュのみ返すよう修正。連携状態を返すエンドポイント（`GET /google/oauth/status`）のレスポンスに`invalidated`フィールドを含める。`refresh()`/`listCalendars()`もinvalid_grant時は再連携を促す専用メッセージ（409）を返すよう改善
- [x] フロント: `GoogleCalendarSection.tsx`で、失効状態を検知したら「Google 側で連携が解除されました。再連携してください」表示に切り替え、「今すぐ更新」ボタンを「Google で再ログイン」（`POST /api/google/oauth/start`を叩く）に変更する
- [x] Green確認
- [x] 既存テスト回帰なし確認（vitest全件、PHPテスト全件）。PHP: GoogleCalendarServiceTest 15/15・GoogleCalendarControllerTest 16/16 green、他既存テストの一部失敗（QuantityServiceTest等）はR-072と無関係の既存事象と確認済み（stashしてR-072変更を除いても同一失敗を確認）。vitest: 734 passed/749（1件失敗はuseAssigneeViewの既存の日付境界依存の無関係テスト、14 skip）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPで実機検証（本番は現在invalid_grant状態のはずなので、実際に失効表示・再連携導線が出ることを確認できる可能性が高い。再連携までは実施せず表示確認に留める）→ 本番は未デプロイ状態のためinvalidatedフィールド自体が無く確認不可（想定通り）。dev環境（localhost:5173/8000、デバッグユーザー fjt.suntree@gmail.com）でDBに疑似的な`invalidated_at`を手動投入し、個人設定画面のGoogleカレンダー連携セクションで「Google 側で連携が解除されました。再連携してください」表示と「Google で再ログイン」ボタン（クリックで実際のGoogle OAuth同意画面へ正しく遷移することを確認、ログインは未実施）を確認。検証後は疑似データを削除済み
- [x] `docs/requests_log.md` R-072の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIの指示を待つ。あわせて「Google Cloud ConsoleでOAuth同意画面を本番公開へ切り替えてください」と発注者への案内文言を報告に含める）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-07-31、`fd83028`をmasterに反映）
- [x] デプロイ後に`backend/migrate_v30_google_oauth_invalidation.php`をSSH経由で実行（Migration v30 completed successfully.）
- [x] 本番chrome-devtools MCP検証: 個人設定画面のGoogleカレンダー連携セクションで「Google 側で連携が解除されました。再連携してください」表示と「Google で再ログイン」ボタンを確認
- [ ] 発注者へ「Google Cloud ConsoleでOAuth同意画面を本番公開へ切り替えてください」の案内（指揮AI/発注者対応、Agentスコープ外）

---

## R-074 フローチャート操作性・軽量化バンドル（2026-08-12）

**ブランチ**: `fix/R-074-flow-operability`
**要望**: `docs/requests_log.md` R-074
**仕様**: `docs/SPEC/02_機能仕様.md` F-24
**分析**: `docs/handover/R-074-analysis.md`

### サブタスク

- [x] worktree作成（`git fetch && git checkout -b fix/R-074-flow-operability master` をworktree内で実行）
- [x] (1) 依存線描画バグ: 実機（claude-in-chrome、chrome-devtools MCPは他Agent使用中のため代替）で調査。根本原因は `createNodeBelow`/`handleEdgeInsert`/`onNodeDragStop`の重なり自動接続の3経路が`setDependencies`のみを呼び、`edges`state反映を`isDragging.current`ガード付きの派生useEffectに一任していたこと（`onConnect`のみ`setEdges`を直接呼んでおり無事だった）
- [x] 失敗するテストを先に書く: `FlowScreen.enterEdge.test.tsx`（3件、`@xyflow/react`の`ReactFlow`をモックしprops捕捉）→ Red確認
- [x] `dependencyToEdge()`（Dependency→Edge変換の単一関数）・`appendDependencyToState()`（setDependencies+setEdges同時更新）を新設し、4つの依存関係作成経路（onConnect/createNodeBelow/handleEdgeInsert/ドラッグ重なり接続）を統一
- [x] Green確認
- [x] (2) アニメーション廃止・矢印表示: `MarkerType`をimportし`dependencyToEdge()`で`animated:false`+`markerEnd:{type:MarkerType.ArrowClosed}`を設定（派生effect内・onConnect内の2箇所）
- [x] (3) Enter連続追加UXフロー: 失敗するテストを先に書く: `FlowItemNode.chainCreate.test.tsx`（4件）→ Red確認
- [x] `FlowItemNode.tsx`の`handleKeyDown`にTabケース追加（タイトル確定→目安時間欄オープン）、目安時間欄のEnterケースに`chainOnConfirm`state経由の`onChainCreate`呼び出しを追加（既存の`isNewNode`によるタイトル自動フォーカスは重複実装せず流用）
- [x] `FlowScreen.tsx`に`createNodeBelowRef`（useRef）を追加しTDZを回避しつつ`onChainCreate`を配線
- [x] Green確認
- [x] 既存テスト回帰なし確認（vitest全件126ファイル778件中763 pass・14 skip、1件`useAssigneeView`の既存無関係失敗はmaster baselineでも同一と確認済み。`npm run build`成功）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPで実機検証を試みたが他Agent（R-076担当）使用中のプロファイルロックで起動不可。claude-in-chrome MCPで代替検証: Enterキーでの新規ノード作成を複数回連続実施し毎回接続線（実線+矢印、アニメーションなし）が表示されることを確認。Tabキーでの目安時間欄フォーカス移動は、claude-in-chrome（CDPベース自動化拡張）経由のTabキー送信がブラウザネイティブなフォーカス走査を先に発火させ`FlowItemNode`のonKeyDownハンドラにTabキーイベントが到達しないことを一時デバッグログで確認（同じ入力欄でEnterキーは正常にハンドラへ到達することを確認済みのため、Tabキー特有の自動化ツール側の制約と判断。詳細は`docs/handover/R-074-analysis.md`参照）。Tab→目安時間→Enter連鎖の動作自体はVitestで実DOM操作によりRed→Green確認済み
- [x] `docs/requests_log.md` R-074の対応状況を更新
- [x] `docs/SPEC/02_機能仕様.md` にF-24追記
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [ ] 指揮AIのレビュー後、master マージ（本番デプロイは行わない、指揮AIが別途判断）
- [ ] Tabキー→目安時間欄→Enter連鎖の実ブラウザ目視確認（chrome-devtools MCPが空いたタイミング、または発注者による確認を推奨）

---

## R-075 フローチャート/モーダル文字入力遅延の原因調査・修正（2026-08-12・Codex委譲）

**要望**: `docs/requests_log.md` R-075（発注者からCodexへの調査委譲指定あり）
**症状**: フローチャート画面を開いている状態で、その上に表示される詳細画面モーダル・改善要望モーダル内のテキスト入力が1文字あたり約1秒かかる
**委譲方針**: `codex:codex-rescue` エージェントに調査・修正を委譲（指揮AIはコード直接編集しない原則を維持しつつ、独立したパフォーマンスデバッグのため機密情報・MCP不要と判断）
- [x] Codexへ調査・修正を委譲。共通根因は`SimpleModal.tsx`・`DecisionDetailModal.tsx`の`backdrop-blur-sm`と特定・除去
- [x] 修正内容をTDDで検証（新規18件green、既存回帰なし。stash比較で既存の無関係な失敗と確認済み）
- [x] `docs/requests_log.md` R-075の対応状況を更新
- [x] 指揮AIレビュー・承認、専用マージAgentによりmasterマージ・push完了（コミット`b301fb6`）
- [ ] 実ブラウザでのミリ秒計測は未実施（自動レンダーカウントのみで背景再レンダー0回を確認）。本番デプロイ後に体感確認を推奨

---

## R-076 ガントチャート依存関係順ソート（2026-08-12）

**ブランチ**: `fix/R-076-gantt-dependency-sort`
**要望**: `docs/requests_log.md` R-076（改善要望フォーム経由、発注者指定で即日実装・デプロイ）
**仕様**: `docs/SPEC/02_機能仕様.md` F-25
**背景**: 依存関係A→B（AがBの前提）がある場合、ガントチャート一覧でAがBより上に表示されるようにする。既存の並び順ロジックは `JWCADTategu.Web/src/features/core/youkan/logic/sorting.ts`（`compareGanttListItems` 等、日付・createdAtベース）にある

### サブタスク
- [x] worktree作成
- [x] 既存の `sorting.ts`/`RyokanGanttView.tsx` を調査し、要件自体はR-015（`sortWithDependencies`、Kahn's algorithm）で実装済みと判明
- [x] 失敗するテストを先に書く: 循環依存（A→B→A等）でトポロジカルソートに解決できないノードが結果配列から静かに欠落するバグを発見 → Red確認
- [x] `sortWithDependencies`に循環フォールバック処理を追加（データ消失防止・安全側）
- [x] Green確認・既存テスト回帰なし確認（vitest全件127ファイル774件中773 pass・14 skip、既存の無関係な1件のみ）
- [x] `git diff --stat master..HEAD` で変更範囲確認（3ファイル・85行）
- [x] claude-in-chrome MCPで実機検証（chrome-devtools MCPは他Agent使用中のため代替）: 依存関係追加後にA→B順へ反転することをスクリーンショットで確認
- [x] `docs/requests_log.md` R-076の対応状況を更新
- [x] 指揮AIレビュー・承認、masterマージ・push完了（コミット`4761d64`）

---

## R-078 ガント/フロー右クリックメニューのキーボードショートカット追加（2026-08-12）

**ブランチ**: `feature/R-078-insert-menu-shortcuts`
**要望**: `docs/requests_log.md` R-078
**仕様**: `docs/SPEC/02_機能仕様.md` F-26
**対象**: R-066で追加された「前に挿入」「後に挿入」の右クリックメニュー項目（ガント左列アイテム、対応するフロー画面の同等メニューがあれば両方）

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-078-insert-menu-shortcuts master` をworktree内で実行）
- [x] R-066で追加された右クリックメニューの実装箇所を特定する（ガント・フロー両方）
- [x] 失敗するテストを先に書く: メニュー表示中に`a`キー押下で「前に挿入」、`b`キー押下で「後に挿入」が実行されることを検証するテスト → Red確認
- [x] キーボードショートカットを実装（メニュー項目のラベル横に`(a)`/`(b)`等の表示も追加すると発注者の意図に沿う）
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（右クリックメニュー表示→aキー/bキーでメニュー実行されることを確認）
- [x] `docs/requests_log.md` R-078の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-12）
- [x] 本番chrome-devtools MCP検証: ガントでアイテムを右クリック→メニューに「前に挿入 (a)」「後に挿入 (b)」表示→a/bキーで実行されることを確認

---

## R-081 ガントチャートで日付未配置タスクの視覚的強調（2026-08-12・優先）

**ブランチ**: `feature/R-081-gantt-unscheduled-highlight`
**要望**: `docs/requests_log.md` R-081
**仕様**: `docs/SPEC/02_機能仕様.md` F-28
**優先度**: 発注者指定で今回（R-078〜R-080）のデプロイに含める
**対象**: `JWCADTategu.Web/src/features/core/youkan/components/Calendar/RyokanGanttView.tsx`（一覧表示のタスク名列）
**注意**: R-078 Agentも同じ`RyokanGanttView.tsx`を触る可能性がある。マージ時にコンフリクトが起きたら両方の変更を残すこと（指揮AI側でも最終確認する）

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-081-gantt-unscheduled-highlight master` をworktree内で実行）
- [x] `RyokanGanttView.tsx`でタスクがカレンダー上に配置されているかどうかの既存の判定方法を確認する（`prep_date`/`due_date`が両方未設定のアイテムが「未配置」に相当するか、既存の類似ロジック・表現がないか調査してから決める）
- [x] 失敗するテストを先に書く: 未配置タスクの行に強調用クラス（背景色）が付与されること、配置済みタスクには付与されないことを検証するテスト → Red確認
- [x] 実装: タスク名列に軽い背景色強調（既存デザインを壊さない程度、例: `bg-amber-50`等の薄い色）を追加
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（未配置タスクの行が視覚的に区別できることを確認）
- [x] `docs/requests_log.md` R-081の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-12）
- [x] 本番chrome-devtools MCP検証: ガント一覧で日付未配置タスク行の背景に`bg-amber-50`が付与されていることをDOM直接確認

---

## R-079/R-080 フローチャート ノード編集UX不具合修正（2026-08-12）

**ブランチ**: `fix/R-079-080-flow-node-edit-ux`
**要望**: `docs/requests_log.md` R-079, R-080
**仕様**: `docs/SPEC/02_機能仕様.md` F-27（R-079）
**背景**: R-079とR-080はいずれも`FlowItemNode.tsx`/`FlowScreen.tsx`の近接箇所（ノード編集・選択状態管理）を触るため、ファイル競合防止のため1つのAgentにまとめて依頼する

### R-079: タイトル編集中のテキストボックス内ドラッグでノードが動いてしまう
- [x] worktree作成（`git fetch && git checkout -b fix/R-079-080-flow-node-edit-ux master` をworktree内で実行）
- [x] `FlowItemNode.tsx`のタイトル編集用input要素のmousedown/pointerdownイベントで、xyflowのノードドラッグハンドラへの伝播が止まっているか確認（目安時間inputには`onMouseDown`/`onClick`のstopPropagationが既にあるのに、タイトルinputには漏れていたと判明）
- [x] 失敗するテストを先に書く: タイトル編集input内でmousedownした場合に`stopPropagation`が呼ばれることを検証するテスト（`FlowItemNode.editUX.test.tsx`）→ Red確認
- [x] 修正実装（タイトルinputに`onMouseDown`/`onClick`の`stopPropagation`を追加）
- [x] Green確認

### R-080: Enter押下時、新規ノードのタイトル「新規アイテム」が選択状態になっていない
- [x] **着手前に必ず`docs/handover/R-077-analysis.md`の「今回スコープ外として残した関連不具合」を読むこと**。以下2点の既知バグが記録されている:
  1. Tab確定後、目安時間欄にフォーカスが移らない（`FlowItemNode.tsx`）
  2. ノード作成・編集のたびにReactFlowの選択状態が失われる（`FlowScreen.tsx` 202〜260行目付近の派生useEffectが`itemNodes`再構築時に`selected`プロパティを保持していない）
- [x] まず実機（claude-in-chrome MCP→途中からchrome-devtools MCP、dev環境）でR-080の症状を再現。`document.activeElement`/`selectionStart`/`selectionEnd`をDOM直接観測し、新規ノードの`<input>`はマウントされ`select()`も試みられているのにフォーカスが乗らないことを確認
- [x] 原因特定: 上記2.と同一メカニズム。xyflowはノード初回計測完了まで`visibility:hidden`を付与し、計測完了後に`measured`をnodes stateへ書き戻すが、`FlowScreen.tsx`の派生useEffectが`itemNodes`を毎回ゼロから再構築するため、`selected`だけでなく`measured`も握りつぶし、新規ノードが`visibility:hidden`に固定され続けフォーカスが黙って失敗していた
- [x] 失敗するテストを先に書く: `FlowScreen.nodeRebuildState.test.tsx`（依存関係作成による再構築後もselected状態が保持されることを検証）・`FlowItemNode.editUX.test.tsx`（visibility:hidden中はfocus/selectを呼ばず、style変化後に呼ぶことを検証）→ Red確認
- [x] 修正実装: `FlowScreen.tsx`の`setNodes`を直前状態からのupdater関数に変更しmeasured/selectedを引き継ぐ（根本原因の修正）。あわせて`FlowItemNode.tsx`にMutationObserverでvisibility:hidden解除を待ってからfocus/selectする防御的修正を追加 → Green確認

### 仕上げ（R-079/R-080共通）
- [x] 既存テスト回帰なし確認（vitest全件790 passed / 14 skipped / 0 failed、master merge後も同様）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] 実機検証（chrome-devtools MCP）: タイトル編集中のinput内でmousedown→mousemove→mouseupしてもノードの`transform`が変化しないことを確認（R-079）。Enterで新規ノード作成後、`document.activeElement`が新規inputになり`selectionStart=0`/`selectionEnd=6`（「新規アイテム」全選択）であることを確認（R-080）
- [x] `docs/requests_log.md` R-079・R-080の対応状況を更新
- [x] `docs/SPEC/02_機能仕様.md` F-27のステータス更新・F-24にR-080修正の注記追加
- [x] master最新化（`git fetch && git merge origin/master`でR-078/R-081/R-082を取り込み、コンフリクトなし）
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-12）
- [x] 本番chrome-devtools MCP検証: フロー画面でノードタイトル編集中のテキストボックス内ドラッグでノードが動かずテキスト選択されること（R-079）、Enterで新規ノード作成時タイトル「新規アイテム」が全選択状態になること（R-080）を確認

---

## R-082 詳細画面「その他」メニューのボタン展開（PC・画面幅が広い時）（2026-08-12）

**ブランチ**: `feature/R-082-detail-menu-expand`
**要望**: `docs/requests_log.md` R-082
**仕様**: `docs/SPEC/02_機能仕様.md` F-29
**対象**: `JWCADTategu.Web/src/features/core/youkan/components/Modal/DecisionDetailModal.tsx` Footer Action Bar（994〜1157行目付近）

### 指揮AI事前調査済み（実装Agentは再調査不要）
- Footer Action Barは`useIsMobile()`でPC/モバイルを分岐している
- 現在PC版（1081〜1157行目）は`isMenuOpen`のポップオーバー内に「プロジェクトに変換/解除」「完了」「💭いつかやる」「アーカイブ」「ゴミ箱」の5項目
- モバイル版（`MobileBottomSheet`、1008〜1080行目）は変更不要

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-082-detail-menu-expand master` をworktree内で実行）
- [x] 失敗するテストを先に書く: PC表示時、「完了」「プロジェクトに変換」ボタンがFooter Action Barに独立ボタンとして表示され、クリックで即座に実行されること／その他メニュー（ポップオーバー）内には残り3項目（いつかやる/アーカイブ/ゴミ箱）のみが残ることを検証するテスト → Red確認
- [x] 実装: 「完了」「プロジェクトに変換（/解除）」ボタンをその他ボタンの隣に独立ボタンとして追加し、既存のonClickロジックを流用。ポップオーバー内の該当2項目は削除
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（PC幅で完了・プロジェクト化ボタンが独立表示され直接押せること、モバイル幅では従来通りその他メニュー経由のままであることを確認）
- [x] `docs/requests_log.md` R-082の対応状況を更新
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-12）
- [x] 本番chrome-devtools MCP検証: 詳細画面PC幅で「その他...」の右に「プロジェクトに変換」「完了」の独立ボタンが表示されることを確認
- [ ] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）

---

## R-083 Youkanロゴ・ファビコン作成（2026-08-12）

**ブランチ**: `feature/R-083-logo-favicon`
**要望**: `docs/requests_log.md` R-083
**仕様**: `docs/SPEC/02_機能仕様.md` F-30
**方針**: プロジェクト名「羊羹」をモチーフにしたシンプルな幾何学的SVGアイコン

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-083-logo-favicon master` をworktree内で実行）
- [x] 羊羹モチーフのSVGアイコンを3案作成（三分割ブロック／小豆粒／抹茶カット）、Artifactでプレビュー公開し指揮AIへ提示
- [x] 指揮AIが「三分割ブロック」を採用。追加修正（スリット貫通化・Y字追加）指示を受け2パターン（Y字置換／Y字内挿）を試作・再提示、「スリット維持＋Y字を内挿」で確定
- [x] `public/favicon.svg`に配置
- [x] `index.html`の`<link rel="icon">`を差し替え（devサーバー限定で`%BASE_URL%`が二重base化される不具合を発見し、単純な相対パス`href="favicon.svg"`に変更して解消）
- [x] `YoukanHeader.tsx`にロゴを追加（`YoukanMark`コンポーネント新設、モバイル用⚡・デスクトップ用⚡の両方を置換）
- [x] 既存テスト回帰なし確認（vitest 784 passed/0 failed/14 skipped）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCP・claude-in-chrome MCPで実機検証（favicon 200応答・image/svg+xml確認、PC/スマホ両方のヘッダーロゴ表示確認、コンソールエラーなし）
- [x] `docs/requests_log.md` R-083の対応状況を更新（`docs/SPEC/02_機能仕様.md` F-30も実装完了に更新）
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）

---

## R-084 ガント「前に挿入」「後に挿入」で依存関係も自動的に繋ぎ直す（2026-08-12）

**ブランチ**: `feature/R-084-insert-dependency-relink`
**要望**: `docs/requests_log.md` R-084
**仕様**: `docs/SPEC/02_機能仕様.md` F-31
**対象**: `JWCADTategu.Web/src/features/core/youkan/components/Calendar/RyokanGanttView.tsx`の`submitInlineInsert()`（214行目`startInlineInsert`、420行目`submitInlineInsert`付近）

### 指揮AI事前調査済み（実装Agentは再調査不要）
- 現状`submitInlineInsert()`は新規アイテム作成後、`ApiClient.reorderItems()`で表示順（order）を並べ替えるだけで、依存関係（Dependency）の作成・繋ぎ変えは一切行っていない
- 依存関係の作成・取得は`DependencyRepository`（`JWCADTategu.Web/src/features/core/youkan/repositories/DependencyRepository.ts`）を使う。R-077対応で409（重複）は冪等に処理される安全な実装になっている

### 要件（指揮AI方針、要望原文の例に基づく）
- 例: 依存関係 A→B, B→C が既にある状態で、Bを対象に「後に挿入」でDを作成 → 期待結果は A→B, B→D, D→C（B→Cが繋ぎ変わる）
- **「前に挿入」**（sourceItemの前に新規アイテムを挿入）: sourceItemへの依存（target=sourceの全依存、X→source型）を新規アイテムへの依存に繋ぎ変える（X→new）。そのうえで new→source を新規作成
- **「後に挿入」**（sourceItemの後に新規アイテムを挿入）: sourceItemからの依存（source=sourceの全依存、source→Y型）を新規アイテムからの依存に繋ぎ変える（new→Y）。そのうえで source→new を新規作成
- sourceItemが分岐を持つ場合（複数のX→sourceやsource→Y）も、対象方向の依存を漏れなく新規アイテム経由に繋ぎ変える（特定の1本だけを選ぶような複雑な分岐判定はしない、シンプルな全繋ぎ変えでよい）
- 依存関係の「繋ぎ変え」は、既存依存の削除＋新規依存の作成で実現する（`DependencyRepository`に削除APIがあるか確認、なければバックエンドの`DELETE /dependencies/{id}`相当を確認）
- 依存関係が元々ない場合（sourceItemに前後の依存がない）は、単純に新規アイテムとsourceItemの間に1本の依存（前挿入ならnew→source、後挿入ならsource→new）を作成するだけでよい

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-084-insert-dependency-relink master` をworktree内で実行）
- [x] `DependencyRepository`の既存メソッド（作成・取得・削除）を確認し、上記要件を満たす繋ぎ変えロジックの実装方針を固める（既存のcreateDependency/deleteDependencyをそのまま使い、繋ぎ変えは削除+作成の2ステップで実現）
- [x] 失敗するテストを先に書く: 要望原文の例（A→B→C、Bの後にDを挿入→A→B、B→D、D→Cになること）を含む複数ケース（前挿入・後挿入・依存なしの場合・分岐がある場合）→ Red確認（5ケース全て失敗確認）
- [x] `submitInlineInsert()`に依存関係の繋ぎ変えロジックを実装
- [x] Green確認・既存テスト回帰なし確認（新規5件Green、全体795 passed/14 skipped、既存回帰なし）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPで実機検証（依存関係を持つタスクチェーンで前挿入・後挿入を実施し、ガント上の接続線が期待通り繋ぎ変わることを確認。要望原文の例A→B→C、Bの後にDを挿入→A→B、B→D、D→Cを実機操作＋API応答の両方で確認）
- [x] `docs/requests_log.md` R-084の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: 分離した制御実験（BRANCHIN→SOURCE→AFTER）で「後に挿入」を実行し、入力エッジ（BRANCHIN→SOURCE）が維持され出力エッジのみ新規アイテム経由に繋ぎ変わることをAPI照会で確認

---

## R-083バグ修正: フローチャートのネストルート直接アクセス時にfaviconが404になる（2026-08-12）

**ブランチ**: `fix/R-083-favicon-nested-route`
**発見経緯**: R-083本番デプロイ後の実機検証中にデプロイAgentが発見
**症状**: `index.html`の`<link rel="icon" href="favicon.svg">`が相対パスのため、`https://door-fujita.com/contents/Youkan/flows/{id}`のようなネストしたルートへ直接アクセス・リロードすると、ブラウザが現在のURLパス基準（`/contents/Youkan/flows/favicon.svg`）でfaviconを解決しようとし404（SPAフォールバックでindex.htmlが返りcontent-type text/html）になる。ルート直下（`/contents/Youkan/`）では問題ない
**背景**: 当初`%BASE_URL%favicon.svg`を使おうとしたが、Vite devサーバー限定でbase接頭辞が二重付与される不具合があり、それを避けるため単純な相対パスに変更した経緯がある（`docs/requests_log.md` R-083参照）。今回は本番のSPAネストルート直接アクセス時に別の問題が発生している

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b fix/R-083-favicon-nested-route master` をworktree内で実行）
- [x] `index.html`の`<link rel="icon">`をこのプロジェクト固定のAppID絶対パス`/contents/Youkan/favicon.svg`に変更する（`docs/development_env.md`でAppID固定と確認済みのため、`import.meta.env.BASE_URL`等の動的解決は不要、直書きでシンプルに解決する）
- [x] devサーバーとビルド後の両方で、ルート直下・ネストルート（`/contents/Youkan/flows/xxx`相当のURLを直接開く）双方でfaviconが200・image/svg+xmlで解決されることを確認
- [x] 既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（dev環境で、ネストしたURLへ直接アクセス・リロードしてfaviconが読み込めることを確認）
- [x] `docs/requests_log.md` R-083の対応状況にこのバグ修正を追記
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: ネストルート（`/flows/{id}`）へ直接アクセス・リロードしてfaviconが200・image/svg+xmlで解決されることを確認

---

## R-085 フロー目安時間更新エラー「Database Error during update」の原因調査・修正（2026-08-12）

**ブランチ**: `fix/R-085-estimated-minutes-update-error`
**要望**: `docs/requests_log.md` R-085
**仕様**: `docs/SPEC/02_機能仕様.md` F-32
**優先度**: 高（実際にエラーが発生しているバグ報告）

### 指揮AI事前調査済み（実装Agentは再調査不要）
- バックエンド: `backend/BaseController.php`の汎用update処理（277行目付近）がPDOExceptionを捕捉し500 "Database Error during update"を返している（323行目）。実際のSQLエラー詳細は`error_log()`（322行目 `[BaseController] Update Error on $table ($id): ...`）にのみ出力され、レスポンスには含まれない
- フロントエンド: `PUT /items/{id}`は`FlowScreen.tsx`の`handleEstimatedMinutesChange`（214行目）から発行される
- 発注者自身の仮説（要望原文）: ノード選択状態でのEnter（`onChainCreate`経由の新規ノード作成）とタイトル入力状態でのTab（目安時間欄への移動、R-074実装）が競合しているのではないか。「ノード選択状態とタイトル入力状態でTabの機能を切り替えたほうが良い」という提案も添えられている

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b fix/R-085-estimated-minutes-update-error master` をworktree内で実行）
- [x] 本番またはdevのPHPエラーログ（`error_log`の出力先。本番はSSH経由、devはローカルのPHPビルトインサーバーの標準出力/ログファイル）を確認し、実際のSQLエラー内容を特定する（SQLite `database is locked`等の可能性が高いと推測されるが決めつけないこと）→ 本番`php_errors.log`から報告時刻と一致する`SQLSTATE[HY000]: General error: 5 database is locked`を確認（PDO->commit()自体が失敗元。同種エラーが数ヶ月にわたり繰り返し発生していたことも判明）
- [x] 決めつけず実機（chrome-devtools MCPまたはclaude-in-chrome MCP、dev環境）で症状を再現する。発注者の仮説（Tab/Enterの競合）を軸に、新規ノード作成フロー（タイトル入力→Tab→目安時間入力→Enter）を実施し、目安時間更新PUTと新規ノード作成（POST /items等）が同時多発していないか、ネットワークタブで確認する → `shouldIgnoreKeyEvent`によりTab/Enterの二重ノード作成は発生しないことをコード調査で確認。代わりに`FlowItemNode.tsx`のEnterハンドラが`onEstimatedMinutesChange`と`onChainCreate`をawaitなしで同時発火していることを特定。さらに`backend/tests/test_completed_at.php`がローカルで100%決定的に同エラーを再現することを発見し、真因（SQLite rollback journalモードでの未消費SELECTによるCOMMITブロック）を突き止めた
- [x] 原因が判明したら、失敗するテストを先に書く → Red確認 → 修正実装 → Green確認（新規4件: `test_sqlite_wal_mode.php`, `test_update_entity_transaction_rollback.php`, `FlowItemNode.chainCreateSequencing.test.tsx`, `client.friendlyServerError.test.ts`）
- [x] エラーメッセージ改善: 原因が完全には解消しきれない場合でも、`ApiClient`側で500エラー時のトースト文言を「通信エラーが発生しました。しばらくしてから再度お試しください」等、原因不明でもユーザーに分かりやすい文言に改善する
- [x] 発注者の提案（ノード選択状態とタイトル入力状態でTabの機能を切り替える）を採用するかどうかは、実機調査の結果次第で判断してよい（Tab/Enter競合が真因なら有力な解決策、別原因ならスコープ外にする）→ 真因はTab/Enter競合ではなかったため不採用
- [x] 既存テスト回帰なし確認（vitest 794 passed/1件既存無関係事象・14 skip、PHPテスト全件green）
- [x] `git diff --stat master..HEAD` で変更範囲確認（ブランチ作成後にmasterが進んだため`git diff --stat`（working tree）で確認: 5ファイル+57/-16行、新規テスト4ファイル396行）
- [x] 実機検証: 新規ノード作成→タイトル→Tab→目安時間→Enterのチェーン作成フローを複数回連続実施し、エラーが発生しないことを確認（3回連続実施、全リクエスト200、コンソールエラーなし）
- [x] `docs/requests_log.md` R-085の対応状況を更新
- [x] 指揮AIへ完了報告（原因究明の詳細を含める。masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ前にSSHでWALモード・DB健全性を確認（2026-08-13）
- [x] 本番実機検証: チェーン作成フローを5回連続実施。1回のみ「Database Error during update」の500を観測したが直後に同一リクエストが200で成功しデータ損失なし（詳細は`docs/requests_log.md` R-085参照。極低頻度の残存事象として申し送り）

---

## R-086 フローチャートでエッジ選択時の視覚的フィードバック強化（2026-08-12）

**ブランチ**: `feature/R-086-edge-selection-glow`
**要望**: `docs/requests_log.md` R-086
**仕様**: `docs/SPEC/02_機能仕様.md` F-33
**対象**: `FlowScreen.tsx`のedge選択状態・`dependencyToEdge()`（`@xyflow/react`のedge style）

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-086-edge-selection-glow master` をworktree内で実行）
- [x] `@xyflow/react`のedge選択状態（`selected`プロパティ、`onEdgeClick`等）の既存実装を確認する
- [x] 失敗するテストを先に書く: エッジ選択時に発光表現用のstyle/className が付与されることを検証するテスト → Red確認
- [x] 実装: 選択中のedgeに`filter: drop-shadow(...)`等のグロー効果を付与するstyleを追加（xyflowの`selected`状態を利用）
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（エッジをクリックして選択→発光表現を確認、別要素クリックで解除されることを確認）
- [x] `docs/requests_log.md` R-086の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: edgeクリックで`classList`に`selected`付与・`filter: drop-shadow(...)`（2重）が適用されることをDOM直接確認

---

## R-087 ガントチャート日付ヘッダーに合計時間数を表示（2026-08-13）

**ブランチ**: `feature/R-087-gantt-header-total-hours`
**要望**: `docs/requests_log.md` R-087
**仕様**: `docs/SPEC/02_機能仕様.md` F-34
**対象**: `JWCADTategu.Web/src/features/core/youkan/components/Calendar/RyokanGanttView.tsx`の日付ヘッダー列（590〜632行目付近）

### 指揮AI事前調査済み（実装Agentは再調査不要）
- 日付ヘッダー列は幅`w-6`(24px)の狭い列。曜日・日付・`CapacityBar`（R-034実装、4px高さのキャパ割合バー、`stats.capacity > 0`のときのみ表示）が縦に並んでいる
- `stats.total`（分単位のその日の合計割当時間）は`dailyCapacityStats`から既に取得済みで`CapacityBar`の`totalMinutes`propに渡されている（627〜631行目）
- 要望: CapacityBarの直下に、その日の合計時間数を「時間」単位のテキストで表示する

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-087-gantt-header-total-hours master` をworktree内で実行）
- [x] 分→時間の変換・表示形式を決める（幅24pxの狭い列に収まるシンプルな表記。例: 90分→"1.5h"、120分→"2h"、0分は非表示等）。既存の時間表示コンポーネント・ユーティリティ（`logic/`配下等）に類似の変換ロジックがないか確認し、あれば再利用する
- [x] 失敗するテストを先に書く: 合計時間数のテキストが正しい値・表記で表示されること（複数の分数パターン）→ Red確認
- [x] 実装: `CapacityBar`の直下（633行目のGoogleカレンダー予定表示の前）に時間数テキストを追加。`stats`が存在し`stats.total > 0`のときのみ表示する等、既存の条件分岐スタイルに合わせる
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（ガント一覧表示で日付ヘッダーに合計時間数が表示されること、CapacityBarとの視覚的な収まりを確認）
- [x] `docs/requests_log.md` R-087の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: ガント一覧の日付ヘッダーでCapacityBar直下に合計時間数（例: "8h"）表示を確認

---

## R-088 フロー空白部ダブルクリックの依存関係自動設定＋エッジ描画バグ修正（2026-08-13）

**ブランチ**: `feature/R-088-pane-doubleclick-dependency`
**要望**: `docs/requests_log.md` R-088
**仕様**: `docs/SPEC/02_機能仕様.md` F-35
**対象**: `JWCADTategu.Web/src/features/core/youkan/screens/FlowScreen.tsx`の`handlePaneDoubleClick`（858行目付近）

### 指揮AI事前調査済み（実装Agentは再調査不要）
- 発注者は原文で「ガントチャート」と呼んでいるが、該当のダブルクリック新規ノード作成機能は`RyokanGanttView.tsx`（ガント）には存在せず、`FlowScreen.tsx`（フローチャート）の`handlePaneDoubleClick`のみに存在する。フローチャート画面を対象として仕様化した
- 現状`handlePaneDoubleClick`は`createNewItem(x, y)`で座標のみ渡してアイテムを作成しており、選択状態・依存関係は一切見ていない
- 依存関係作成を行う既存の4経路（`onConnect`/`createNodeBelow`/`handleEdgeInsert`/ドラッグ重なり自動接続）は全て`appendDependencyToState()`（R-074新設、`setDependencies`+`setEdges`同時更新）を経由しており、これが「エッジが即座に反映される」ための必須パターン。新設する5つ目の経路も必ずこれを経由させること（別実装すると同種のedge非表示バグを再現する）

### 要件
- 選択ノード（`selectedNodeIds[0]`）がある状態でダブルクリック → クリック位置のY座標と選択ノードのY座標を比較
  - クリック位置が選択ノードより上 → 「新規ノード→選択ノード」の依存関係を作成（新規が前提）
  - クリック位置が選択ノードより下 → 「選択ノード→新規ノード」の依存関係を作成（選択ノードが前提）
- 選択ノードがない状態でのダブルクリック → 依存関係なしで作成（現状維持）

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-088-pane-doubleclick-dependency master` をworktree内で実行）
- [x] `appendDependencyToState()`・`selectedNodeIds`・`DependencyRepository`の既存実装を確認する
- [x] 失敗するテストを先に書く: 選択ノードあり・クリック位置が上/下・選択ノードなしの3パターンで依存関係が正しく作成されること、edgeが即座に反映されること → Red確認
- [x] `handlePaneDoubleClick`に依存関係自動設定ロジックを実装（`appendDependencyToState()`経由）
- [x] Green確認・既存テスト回帰なし確認（vitest全件822件中1件失敗は`useAssigneeView.test.ts`で本タスク非関連・分岐元でも再現する既存の無関係な事象）
- [x] `git diff --stat master..HEAD` で変更範囲確認（2ファイル、+187/-2行）
- [x] chrome-devtools MCPで実機検証（選択ノードの上/下でのダブルクリック、選択なしでのダブルクリック、いずれもedgeが即座に描画されリロード不要であることを確認。ページリロード後も永続化を確認。検証用テストノードは削除し原状回復済み）
- [x] `docs/requests_log.md` R-088の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: 選択ノード上/下でのダブルクリック（source/target方向確認）、選択なしでのダブルクリック（依存関係なし）をAPI照会で確認。既存Phase5自動チェーン機能との併存も確認

---

## R-089 R-085低頻度残存事象の追加調査（2026-08-13）

**ブランチ**: `fix/R-089-database-locked-residual`
**要望**: `docs/requests_log.md` R-089
**背景**: R-085でSQLite「database is locked」の根本原因（WALモード未適用・未クローズカーソルによるロック競合）を修正し本番デプロイ済み。しかし本番実機検証でチェーン作成5回中1回、低頻度で同種の500エラーが再発した（直後のリトライで成功、データ損失なし）

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b fix/R-089-database-locked-residual master` をworktree内で実行）
- [x] `docs/requests_log.md` R-085の記載を読み、既存の対策（WALモード化・busy_timeout・トランザクションrollback修正・Enter時の目安時間保存→チェーン作成の逐次化）を把握する
- [x] 本番のPHPエラーログ（SSH経由）を確認し、直近で同種の「database is locked」エラーが再発していないか、発生時刻・頻度を確認する（2026-08-13 01:29:04に同一item idへの`PUT /items/{id}`が同一秒に2件発火し後着側が失敗していることを特定）
- [x] busy_timeoutの設定値、または目安時間更新以外の並行書き込み経路がないか調査 → 真因は`FlowItemNode.tsx`のEnter確定後、input要素DOM除去に伴う`blur`イベントが古いクロージャの`handleTimeEditConfirm`を再度呼び出し、同一itemIdへPUTが二重発火していたこと（PUT×POSTではなくPUT×PUTの新しい競合経路）
- [x] 原因が特定できたため、失敗するテストを先に書く → Red確認 → 修正実装（編集セッション単位で確定を1回に制限する`hasConfirmedRef`ガード追加）→ Green確認
- [x] 既存テスト回帰なし確認（vitest全件805 passed/14 skipped、失敗3件は既存の無関係事象）
- [x] `git diff --stat master..HEAD` で変更範囲確認（FlowItemNode.tsx +14、テスト +35の2ファイルのみ）
- [x] `docs/requests_log.md` R-089の対応状況を更新（原因特定・修正実装済みを明記）
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: チェーン作成フローを5回連続実施しエラー再発なしを確認

---

## R-090 フローのズームアウト制限緩和＋「全体」ズーム・パンボタン新設（2026-08-13）

**ブランチ**: `feature/R-090-flow-zoom-controls`
**要望**: `docs/requests_log.md` R-090
**仕様**: `docs/SPEC/02_機能仕様.md` F-36
**対象**: `FlowScreen.tsx`の`ReactFlow`コンポーネント（`minZoom`等のprops）・ヘルプボタン周辺のUI

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-090-flow-zoom-controls master` をworktree内で実行）
- [x] `ReactFlow`コンポーネントの現在の`minZoom`設定値を確認し、より小さい値（遠くまでズームアウト可能）に変更する（未設定=既定0.5 → 明示的に0.05へ）
- [x] ヘルプボタンの位置・実装を確認し、その直下に「全体」表示ボタン（クリックで`fitView`相当のズーム・パンを実行）を新設する
- [x] 失敗するテストを先に書く: 「全体」ボタンクリックで`fitView`（または同等の処理）が呼ばれることを検証するテスト → Red確認
- [x] 実装
- [x] Green確認・既存テスト回帰なし確認（vitest全件822件中807 pass・14 skip、失敗1件`useAssigneeView.test.ts`は既存の日付境界依存の無関係な事象）
- [x] `git diff --stat master..HEAD` で変更範囲確認（FlowScreen.tsx +10/-1、テスト新規105行の2ファイルのみ）
- [x] chrome-devtools MCPで実機検証（ズームアウトの範囲拡大、「全体」ボタンの配置・動作を確認）
- [x] `docs/requests_log.md` R-090の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: ズームアウトでscale=0.05到達を確認。「全体」ボタンの視覚的な収まり確認はブラウザ表示ジオメトリ取得不可の環境都合で未実施（コードレベルではfitView呼び出しを確認済み）

---

## R-091 依存関係順ソートを全ビューへ展開（2026-08-13）

**ブランチ**: `feature/R-091-dependency-sort-all-views`
**要望**: `docs/requests_log.md` R-091
**仕様**: `docs/SPEC/02_機能仕様.md` F-37
**対象**: `JWCADTategu.Web/src/features/core/youkan/logic/hierarchy.ts`（共通ロジック）・`useOverviewItems.ts`（全体一覧）・`BucketColumn.tsx`（状況把握）・グリッドビュー・タイムラインビューの各実装

### 指揮AI事前調査済み（実装Agentは再調査不要）
- R-076で実装した依存関係考慮ソート（`hierarchy.ts`の`sortWithDependencies`、非export）は既に汎用ロジック。共通関数`buildHierarchicalList()`内部（`showGroups=false`時のみ）で`compareGanttListItems`を使って呼ばれている
- `buildHierarchicalList()`はガント（`RyokanGanttView.tsx`）・全体一覧（`useOverviewItems.ts`）・状況把握（`BucketColumn.tsx`、showGroups=true時のみ）で共用されているが、`dependencies`引数の扱いが画面ごとに異なる:
  - 全体一覧: `useOverviewItems.ts`45行目で`dependencies: []`固定（R-048のコメントに「OverviewBoardでは依存関係を考慮しない、起動時APIコスト削減のため」と明記あり）
  - 状況把握: showGroups=trueのときのみ`buildHierarchicalList`使用、`dependencies`未指定（デフォルト非考慮）。showGroups=falseのときは別関数`sortItemsHierarchically`（依存関係非対応）を使用
  - グリッドビュー・タイムラインビューの実装状況は未調査。実装Agentが調査すること
- **重要な設計判断**: 全体一覧で依存関係を反映するには`/dependencies`の追加取得が必要になり、R-048で意図的に避けた起動時APIコストが増える可能性がある。影響が大きい場合（例: 常時ポーリング等の重い処理が必要になる）は実装前に指揮AIへ確認すること。単純に画面表示時に1回取得する程度であれば問題ないと判断してよい

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-091-dependency-sort-all-views master` をworktree内で実行）
- [x] グリッドビュー・タイムラインビューの現在の並び順ロジックを調査し、依存関係を考慮しているか確認する（結果: 両ビューとも独自の並び替えロジックを持たず、`RyokanCalendar.tsx`が`QuantityEngine.calculateMetrics()`で作る共通の`metrics.contributingItems`をそのまま`CalendarCell`で描画しているだけだった。依存関係は未考慮）
- [x] 各画面（全体一覧・状況把握・グリッド・タイムライン）で`dependencies`を取得し`buildHierarchicalList`（または各画面のソートロジック）に正しく渡すよう対応する。グリッド・タイムラインが`buildHierarchicalList`を使っていない場合は、それぞれの並び替えロジックに`sortWithDependencies`相当の処理を適用する（`sortWithDependencies`を`export`して共通利用可能にする）
- [x] 失敗するテストを先に書く: 各画面で依存関係のあるタスクが順序通りに並ぶことを検証するテスト → Red確認
- [x] 実装
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（依存関係のあるタスクを作成し、全体一覧・状況把握・グリッド・タイムラインそれぞれで前後の序列が保たれることを確認）
- [x] `docs/requests_log.md` R-091の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: 全体一覧・状況把握でDOM順序が依存チェーン通りであることを確認。グリッド・タイムラインは新規コンソールエラーなしを確認

---

## R-092 全体一覧の右クリックメニュー統一＋挿入時の依存関係自動構築（2026-08-13）

**ブランチ**: `feature/R-092-overview-context-menu`
**要望**: `docs/requests_log.md` R-092
**仕様**: `docs/SPEC/02_機能仕様.md` F-38
**対象**: `JWCADTategu.Web/src/features/core/youkan/components/OverviewBoard/OverviewBoard.tsx`・`OverviewItem.tsx`

### 指揮AI事前調査済み（実装Agentは再調査不要）
- 全体一覧（`OverviewBoard.tsx`）は現状、ガントの`buildItemContextMenuActions`（完了/プロジェクト化/いつかやる/アーカイブ/削除/前に挿入/後に挿入等の多機能メニュー、R-078でショートカット対応済み）とは全くの別実装で、`useItemContextMenu.ts`という「削除（Delete）のみ」の簡易フックを使っている（`OverviewBoard.tsx`7〜8行目でimport、64行目で使用）
- 要望を満たすには`OverviewBoard.tsx`の右クリックメニューを`buildItemContextMenuActions`ベース（`ContextMenu.tsx`共通コンポーネント）に置き換える必要がある
- **注意**: 別のAgent（R-091担当）も`useOverviewItems.ts`（全体一覧の別ファイル）を並行して編集している可能性がある。あなたの変更は`OverviewBoard.tsx`・`OverviewItem.tsx`のコンテキストメニュー関連のスコープに留めること

### 要件
- 全体一覧のアイテム右クリックメニューを、ガントと同じ`buildItemContextMenuActions`ベースのメニュー（`ContextMenu.tsx`）に置き換える。項目は完了/プロジェクト化/いつかやる/アーカイブ/削除/前に挿入/後に挿入の全て
- 前に挿入・後に挿入は、ガント（`RyokanGanttView.tsx`の`submitInlineInsert`）と同様のインライン入力方式で実装する（連続入力UXの高度化は本件のスコープ外、単発の挿入でよい）
- 挿入時はR-084相当の依存関係自動構築（既存の依存関係を新規アイテム経由に繋ぎ変える）も行う

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-092-overview-context-menu master` をworktree内で実行）
- [x] `buildItemContextMenuActions.tsx`・`ContextMenu.tsx`・`RyokanGanttView.tsx`の`submitInlineInsert`実装を確認する
- [x] 失敗するテストを先に書く: 全体一覧でアイテム右クリック→ガントと同じメニュー項目が表示されること、前後挿入でインライン入力・依存関係自動構築が行われることを検証するテスト → Red確認
- [x] `OverviewBoard.tsx`の右クリックメニューを`useItemContextMenu`から`buildItemContextMenuActions`ベースへ置き換え、挿入時の依存関係自動構築ロジックを実装
- [x] Green確認・既存テスト回帰なし確認（既存の`useItemContextMenu`のDeleteキー機能等、既存動作を壊さないこと）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（全体一覧でメニュー表示・各項目動作・前後挿入・依存関係構築を確認）
- [x] `docs/requests_log.md` R-092の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: 右クリックメニューに既存9項目＋「前に挿入 (a)」「後に挿入 (b)」を確認、bキーで依存関係が正しい向きで自動構築されることをAPI照会で確認、既存項目「いつかやる」の動作も確認

**完了報告（2026-08-13）**: 実装完了。詳細は指揮AIへの完了報告メッセージを参照。要件バレット中の「いつかやる/アーカイブ」はガント実装（`buildItemContextMenuActions`）に存在しないため含めず、ユーザー原文の「ガントとおなじ...項目も全部同じ」を優先しガントと完全一致のメニュー構成にした（指揮AIレビュー時に確認要）。

**方針転換（2026-08-13）**: 指揮AIレビュー後、発注者確認の結果「既存項目（いつかやる/アーカイブ/とりかかる/保留/待機）も残しつつ統合」を選択。`buildItemContextMenuActions`への全面置き換えを撤回し、元のハードコード配列アプローチに戻して「前に挿入 (a)」「後に挿入 (b)」の2項目のみ追加。挿入時の依存関係自動構築ロジック（`submitInlineInsert`/`DependencyRepository`）は変更なし。テスト9件Green・vitest回帰なし・tscビルド成功・実機検証済み（詳細は指揮AIへの再完了報告メッセージ参照）。

---

## R-093 技術的負債: vite.config.js/vite.config.d.tsの残骸削除（2026-08-13）

**ブランチ**: `chore/R-093-remove-stale-vite-config-artifacts`
**要望**: `docs/requests_log.md` R-093
**対象**: `JWCADTategu.Web/vite.config.js`・`JWCADTategu.Web/vite.config.d.ts`

### 指揮AI事前調査済み（実装Agentは再調査不要）
- 両ファイルの内容を`vite.config.ts`と比較済み。現状はほぼ同一内容（構文の新旧差のみ）で実害はない
- Viteは設定ファイルを`vite.config.js` → `vite.config.ts`の順で探索するため、`.js`が存在すると`.ts`より優先される。将来`.ts`側だけを編集すると変更が反映されない不具合の温床になる

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b chore/R-093-remove-stale-vite-config-artifacts master` をworktree内で実行）
- [x] `git rm JWCADTategu.Web/vite.config.js JWCADTategu.Web/vite.config.d.ts`でgit管理から削除
- [x] `JWCADTategu.Web/.gitignore`に`vite.config.js`・`vite.config.d.ts`を追加（再発防止）
- [x] 削除後、`npm run dev`と`npm run build`の両方が`vite.config.ts`を正しく読み込み問題なく動作することを確認
- [x] 既存テスト回帰なし確認（vitest全件）
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] `docs/requests_log.md` R-093の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番確認: トップ画面が通常通り表示・動作すること、新規コンソールエラーがないことを確認

**完了報告（2026-08-13）**: 実装完了。詳細は指揮AIへの完了報告メッセージを参照。
