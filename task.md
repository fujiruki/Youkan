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
- [ ] View `screens/AssigneeViewScreen.tsx` 実装（§13.4レイアウト、案件名とセット表示、管理者のみチップ表示）
- [ ] `ViewState` に `assigneeView` 追加、`App.tsx` にルーティング追加、会社コンテキスト限定の導線追加（メニュー）
- [ ] 既存テスト破壊なし確認（`npm.cmd run test -- --run`）
- [ ] `git diff --stat master..HEAD` で変更範囲確認
- [ ] master マージ・push（**upload.ps1によるデプロイは行わない**）
- [ ] 指揮AIへ完了報告（400語以内。アクセス経路・テスト結果・実機確認が必要な点）
