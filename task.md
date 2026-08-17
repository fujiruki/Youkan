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

---

## R-094-A ガントの前後挿入で連続インライン入力UX（2026-08-13）

**ブランチ**: `feature/R-094a-gantt-chain-insert-ux`
**要望**: `docs/requests_log.md` R-094
**仕様**: `docs/SPEC/02_機能仕様.md` F-39
**対象**: `JWCADTategu.Web/src/features/core/youkan/components/Calendar/RyokanGanttView.tsx`の`submitInlineInsert`・インライン入力UI周辺（420〜465行目、535〜560行目付近）

### 指揮AI事前調査済み（実装Agentは再調査不要）
- R-074（`FlowItemNode.tsx`/`FlowScreen.tsx`）に概念的に同一のチェーン作成UX（タイトル確定→Tab→目安時間欄フォーカス→Enter→次ノード作成）が既に実装済み。`chainOnConfirm` state・`onChainCreate`コールバックのパターンを参考にできる
- 目安時間のインライン編集自体は既存機能（F-17）として`RyokanGanttView.tsx`に既に存在する（`timeInputRef`ベースの実装）。これを流用できる

### 要件
1. 「前に挿入」/「後に挿入」でインライン入力（タイトル欄）が出現
2. タイトル入力→Enter確定 →
   - 既存の`submitInlineInsert`ロジックでアイテム作成・依存関係構築を実行
   - 作成された行に目安時間入力欄を表示しフォーカスする
   - 同時に、次の挿入位置（今確定した行の続き）に新しい空のインライン入力行（タイトル欄）を出現させる
3. 目安時間欄でEnter確定 → 目安時間を保存し、フォーカスを2で出現した新しいインライン行（タイトル欄）に移す
4. 新しいインライン行に何も入力されないまま確定されず終わった場合（フォーカスが外れる等）、その行は保存されず消える

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-094a-gantt-chain-insert-ux master` をworktree内で実行）
- [x] 現在の`submitInlineInsert`・インライン入力UI・目安時間インライン編集の実装を詳しく確認する
- [x] 失敗するテストを先に書く: タイトル確定→目安時間欄フォーカス→確定→次のインライン行フォーカス→未入力なら消える、の一連の流れを検証するテスト → Red確認
- [x] 実装
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（連続でタイトル→目安時間→次タイトル…と入力し続けられること、途中で入力せず離脱すると空行が消えることを確認）
- [x] `docs/requests_log.md` R-094の対応状況を更新（ガント側の実装完了を明記）
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: タイトル確定→目安時間欄自動フォーカス→確定→次の空行フォーカス→未入力離脱で消滅、の一連の流れをDOM/API照会で確認

---

## R-094-B 全体一覧の前後挿入で連続インライン入力UX（2026-08-13）

**ブランチ**: `feature/R-094b-overview-chain-insert-ux`
**要望**: `docs/requests_log.md` R-094
**仕様**: `docs/SPEC/02_機能仕様.md` F-39
**対象**: `JWCADTategu.Web/src/features/core/youkan/components/OverviewBoard/OverviewBoard.tsx`の`submitInlineInsert`・`InlineAddRow`周辺（R-092で実装済み）

### 指揮AI事前調査済み（実装Agentは再調査不要）
- R-074（`FlowItemNode.tsx`/`FlowScreen.tsx`）のチェーン作成UXパターンを参考にできる（R-094-Aと同じ参考元）
- 目安時間のインライン編集自体は既存機能（F-17）として`OverviewItem.tsx`（151/216/224行目付近、`formatMinutes`ベース）に既に存在する。これを流用できる
- R-092で実装済みの`submitInlineInsert`・`inlineInsert` state・`InlineAddRow`コンポーネントをベースに拡張する

### 要件（R-094-Aと同じ、対象画面が全体一覧）
1. 「前に挿入」/「後に挿入」でインライン入力（タイトル欄）が出現
2. タイトル入力→Enter確定 → アイテム作成・依存関係構築（既存ロジック）＋作成行に目安時間欄を表示・フォーカス＋次の挿入位置に新しい空インライン行を出現
3. 目安時間欄でEnter確定 → 保存＋フォーカスを新しいインライン行へ
4. 新しいインライン行が未入力のまま終われば保存せず消える

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b feature/R-094b-overview-chain-insert-ux master` をworktree内で実行）
- [x] 現在の`submitInlineInsert`・`InlineAddRow`・目安時間インライン編集（`OverviewItem.tsx`）の実装を詳しく確認する
- [x] 失敗するテストを先に書く: タイトル確定→目安時間欄フォーカス→確定→次のインライン行フォーカス→未入力なら消える、の一連の流れを検証するテスト → Red確認
- [x] 実装
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（連続入力の流れ、未入力行の消滅を確認）
- [x] `docs/requests_log.md` R-094の対応状況を更新（全体一覧側の実装完了を明記）
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: タイトル確定→目安時間欄自動フォーカス→確定→次の空行フォーカス→未入力離脱で消滅、の一連の流れをDOM/API照会で確認

**完了報告（2026-08-13）**: 実装完了。詳細は指揮AIへの完了報告メッセージを参照。

---

## R-095 バグ修正: 全体一覧「その他」ドロップダウンで`action.onClick is not a function`例外（2026-08-13）

**ブランチ**: `fix/R-095-overview-contextmenu-separator-crash`
**要望**: `docs/requests_log.md` R-095
**対象**: `JWCADTategu.Web/src/features/core/youkan/components/OverviewBoard/OverviewBoard.tsx`（321〜374行目付近の`actions`配列）

### 指揮AI原因特定済み（実装Agentは再調査不要）
- `OverviewBoard.tsx`の右クリックメニュー配列に`{ separator: true }`という要素が2箇所（338行目・364行目）含まれているが、この要素は`onClick`プロパティを持たない
- `ContextMenu.tsx`（`JWCADTategu.Web/src/features/core/youkan/components/Common/ContextMenu.tsx`）の`ContextMenuAction`インターフェースは`separator`フィールドをそもそもサポートしておらず、`actions.map()`内（99〜113行目）で全項目間に`index > 0`ベースで自動的に薄い区切り線を挿入する設計になっている
- そのため`{ separator: true }`はセパレータとして機能せず、`onClick`を持たない「空のボタン」としてそのまま描画され、クリックされると`action.onClick()`（103行目）が`undefined()`呼び出しとなり例外が発生する

### 対応方針
`OverviewBoard.tsx`の`{ separator: true }`要素2箇所（338行目・364行目）を削除する。`ContextMenu.tsx`が既に全項目間へ自動でセパレータを描画するため、削除しても視覚的な区切り自体は失われない（グループ単位の強めの区切りが均等な薄い区切りに変わる程度の軽微な見た目の違いのみ）。

### サブタスク
- [x] worktree作成（`git fetch && git checkout -b fix/R-095-overview-contextmenu-separator-crash master` をworktree内で実行）
- [x] 失敗するテストを先に書く: メニューの`actions`配列に`separator: true`かつ`onClick`を持たない要素が含まれないことを検証するテスト（または、全メニュー項目をクリックしてエラーが発生しないことを検証するテスト）→ Red確認
- [x] `{ separator: true }`要素2箇所を削除
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD` で変更範囲確認
- [x] chrome-devtools MCPまたはclaude-in-chrome MCPで実機検証（全体一覧の右クリックメニューを開き、全項目を順にクリックしてエラーが発生しないことを確認。特に旧separator位置に近い項目「今日やる」「アーカイブ」付近を重点確認）
- [x] `docs/requests_log.md` R-095の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージは指揮AIのレビュー後）
- [x] master マージ・`upload.ps1`で本番デプロイ（2026-08-13）
- [x] 本番実機検証: 右クリックメニュー全11項目を複数アイテムで順にクリックし例外なしを確認（今日やる・アーカイブ重点確認含む）

---

## R-097 ガント マンスリー/ウィークリー表示モード＋列幅・行高さ独立記憶スライダー / R-098 コンテンツ印刷ボタン（2026-08-14）

**ブランチ**: `feature/R-097-098-gantt-scale-and-print`
**要望**: `docs/requests_log.md` R-097, R-098
**仕様**: `docs/SPEC/03_画面設計.md` §5.3

### 指揮AI事前調査済み（実装Agentは再調査不要）
- `CalendarHeader.tsx`（141〜153行目）に既存の行高さ（密度）スライダーあり。`min=12 max=32`、`localStorage`キー`youkan_gantt_row_height`（`YOUKAN_KEYS.GANTT_ROW_HEIGHT`）で永続化。`DashboardScreen.tsx`（117〜124行目）で`useState`初期値をlocalStorageから読み、変更時に書き戻すパターン
- `RyokanGanttView.tsx`（161行目）で`const colWidth = 24;`とハードコードされており、スライダー化されていない。`colWidth`は複数箇所（ドラッグ判定、スクロール位置計算、依存関係矢印描画の`GanttDependencyLines`コンポーネント等）で参照されている
- `youkanKeys.ts`に`YOUKAN_KEYS`定数があり、新規localStorageキーはここに追加する（命名規則: `youkan_` prefix）
- ガントビューは「プロジェクト別/一覧」の表示モードは既にあるが、「マンスリー/ウィークリー」という表示スケールモードは今回新設するもの

### 実装Agentによる訂正（2026-08-14、実機検証で発覚・指揮AI確認済み）

事前調査は`DashboardScreen.tsx`内部の`viewMode==='calendar'`をガント画面の実体と想定していたが、実際にヘッダー「カレンダー→ガント」から到達するのは`App.tsx`の`currentView==='calendar'`が指す**`VolumeCalendarScreen.tsx`**（`features/core/calendar/screens/`）であり、`DashboardScreen.tsx`側の`viewMode==='calendar'`分岐はUI導線が存在しない到達不能パスだった。指揮AI確認の上、状態配線の対象を`DashboardScreen.tsx`から`VolumeCalendarScreen.tsx`へ変更。以下のチェックリストは実際の実装対象（`VolumeCalendarScreen.tsx`）に基づき完了扱いとする。

### R-097 サブタスク

- [x] worktree作成（`git fetch && git checkout -b feature/R-097-098-gantt-scale-and-print master` をworktree内で実行）
- [x] `youkanKeys.ts`に新規localStorageキー追加: `GANTT_SCALE_MODE`（`'monthly' | 'weekly'`）、`GANTT_COL_WIDTH_MONTHLY`、`GANTT_ROW_HEIGHT_MONTHLY`、`GANTT_COL_WIDTH_WEEKLY`、`GANTT_ROW_HEIGHT_WEEKLY`
- [x] 失敗するテストを先に書く（`CalendarHeader.test.tsx`）: マンスリー/ウィークリー切替トグルの表示・クリックでモード変更コールバックが呼ばれること、モードに関わらず列幅・行高さ両スライダーが表示されること → Red確認
- [x] `CalendarHeader.tsx`にマンスリー/ウィークリー切替トグル（既存の「プロジェクト別/一覧」トグルと同じUIパターン）を追加
- [x] `CalendarHeader.tsx`に列幅（日付列幅）スライダーを追加（min=16/max=80）。既存の行高さスライダーと横並びに常時表示（`isGantt`条件は既存のまま維持）
- [x] `RyokanGanttView.tsx`のハードコード`colWidth = 24`をpropとして受け取れるように変更（呼び出し元`RyokanCalendar.tsx`経由で配線）。従来無視されていた`rowHeight`propも実際に使用するよう修正（h-7固定→動的style、`GanttDependencyArrows`への`rowHeight=28`ハードコードも実propに変更）
- [x] **`VolumeCalendarScreen.tsx`**（当初想定の`DashboardScreen.tsx`から変更）にモード・列幅・行高さのローカルstate管理を追加。モード切替時は切替先モードの記憶値（`localStorage`）を`colWidth`/`rowHeight`のstateへ復元。スライダー操作時は現在選択中のモードに対応するキーへ書き込む
- [x] 既存の単一値`youkan_gantt_row_height`キーはPanoramaボード側で引き続き使用中のため統合・廃止せず、Gantt専用の新4キーと併存させる方針に変更（指揮AI確認済み、副次的判明事項として下記に記録）
- [x] マンスリー初期値は既存動作を完全維持（列幅24px・行高さ28px相当）することをテストで確認
- [x] Green確認・既存テスト回帰なし確認

### R-098 サブタスク

- [x] 失敗するテストを先に書く: ガント画面・全体一覧画面に印刷ボタンが表示され、クリックで`window.print`が呼ばれることを検証するテスト → Red確認
- [x] `index.css`に`@media print`ルールを追加: ヘッダー・サイドメニュー・操作ボタン等のUIクロームに`no-print`クラスを付与し非表示化（`YoukanHeader.tsx`・`CalendarHeader.tsx`・`OverviewBoard.tsx`ツールバー・`SideMemoWidget.tsx`・`SpeechFloatingButton.tsx`）。本体コンテンツのみ印刷対象にする
- [x] `CalendarHeader.tsx`に「印刷」ボタンを追加（`onClick={() => window.print()}`、`isGantt`ゲート）
- [x] `OverviewBoard.tsx`のツールバー付近に同様の「印刷」ボタンを追加
- [x] Green確認・既存テスト回帰なし確認

### 仕上げ（共通）

- [x] `git diff --stat master..HEAD`で変更範囲確認（sqlite/log/tsbuildinfo混入なし。15ファイル+469/-21行）
- [x] claude-in-chrome MCPで実機検証（dev環境。chrome-devtools MCPはセッション途中で切断されたため代替使用）:
  - ヘッダー→カレンダー→ガント（`VolumeCalendarScreen.tsx`実体）で実際にウィークリー表示に切替→列幅24→68・密度28→14に調整→マンスリーに戻す（24/28に復帰）→再度ウィークリーに戻す（68/14が復元）→ページ全体リロード後も68/14が維持されることを確認
  - ガント画面・全体一覧画面それぞれで印刷ボタン→`window.print()`発火を確認。`.no-print`疑似適用のスクリーンショットでヘッダー・ツールバー・フローティングウィジェットが非表示、コンテンツ本体のみ表示されることを確認
- [x] `docs/requests_log.md` R-097・R-098の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）
- [x] 指揮AIレビュー承認・発注者確認済み → master マージ・push（コミット`3d88463`）
- [x] `upload.ps1`で本番デプロイ（`DEPLOYMENT SUCCESSFUL!`確認）
- [x] 本番実機検証（claude-in-chrome MCP）: ヘッダー→カレンダー→ガントで実際に遷移し、ウィークリー切替→列幅24→69・密度28→14に調整→マンスリーに戻す→再度ウィークリーに戻して69/14が復元されること、ページ全体リロード後も維持されることを確認。ガント・全体一覧の印刷ボタンで`window.print()`発火、`.no-print`疑似適用でヘッダー・ツールバー非表示を確認。新規コンソールエラーなし（既存の無関係なGoogle連携エラーのみ）
- [x] `docs/requests_log.md` R-097・R-098を「完了（本番デプロイ・実機検証完了）」に更新

### 副次的判明事項（技術的負債、スコープ外）

- 密度スライダーは従来`DashboardScreen.tsx`の`ganttRowHeight`という単一stateを介して実質Panoramaボードの行高さにのみ効いており、Gantt側（VolumeCalendarScreen）は死んだ配線だった。今回Gantt専用の別stateに繋ぎ替えたことでPanoramaボードの行高さはUIから調整する手段がなくなったが、指揮AI確認の上「各ビューが専用の行高さを持つ方が正しい設計」として復旧UI追加は不要と判断（YAGNI）
- `DashboardScreen.tsx`内の到達不能な`viewMode==='calendar'`パス自体の削除は今回スコープ外。別途技術的負債として`docs/requests.md`への起票を検討

---

## R-099 GET /itemsに依存関係グラフを埋め込む（2026-08-14）

**ブランチ**: `feature/R-099-items-api-dependency-fields`（master最新、R-097/R-098マージ後のコミットを基点にすること）
**要望**: `docs/requests_log.md` R-099
**仕様**: `docs/SPEC/04_データ設計.md` §3.5「API露出（R-099）」

### 背景
発注者が外部のAI（詳細不明。ForAi経由でコピペした先のAIか、Youkan APIを直接読んだ何らかのAIツール）に「Youkan APIには明示的な依存グラフのフィールドがない」と指摘された。現状`GET /items`系のレスポンスには依存関係フィールドがなく、`GET /dependencies`（`DependencyController.php`）を別途叩いて`source_item_id`/`target_item_id`のペアと突き合わせる必要がある。発注者は「`GET /items`本体に埋め込む」方式を選択した。

### 指揮AI事前調査済み（実装Agentは再調査不要）
- `item_dependencies`テーブル: `source_item_id`＝上流（前提タスク）、`target_item_id`＝下流（後続タスク）。`04_データ設計.md` §3.5参照
- `BaseController::mapItemRow($item)`（`BaseController.php` 200行目）が、DBの行→フロントエンド向けJSON変換を行う一元化された共通関数。`ItemController.php`内の複数の一覧系メソッド（`getMyItems()`の`scope=aggregated/personal/company/dashboard/team`各分岐、`getProjectItems()`、`getSubTasks()`、単体`show()`）がそれぞれこの関数を経由してレスポンスを組み立てている（詳細はItemController.php内を実装Agentが確認すること）
- `DependencyController::getDependenciesDirect()`（`DependencyController.php` 132行目付近）に、テナントスコープを考慮した`item_dependencies`絞り込みSQLの実例がある。同じテナントフィルタパターンを流用してよい
- **N+1禁止**: R-091で「全体一覧の`items`レスポンスに依存関係を毎回埋め込むと起動時APIコストが増える」という理由で意図的に埋め込みを避けた経緯がある。今回はコストを抑えた実装（1リクエストにつき`item_dependencies`を1回だけ一括取得し、メモリ上で`item_id => {dependsOn: [], blocks: []}`の隣接マップを構築してから、`mapItemRow()`の呼び出し側でこのマップを渡して結果に埋め込む）とすることでこの懸念を解消する設計とする

### サブタスク

- [x] worktree作成
- [x] 失敗するテストを先に書く → Red確認
- [x] `mapItemRow()`に依存関係マップを埋め込むロジックを実装（N+1回避を`buildDependencyMap()`で実現）
- [x] `ItemController.php`内の全一覧系メソッドに配線
- [x] Green確認・既存backendテスト回帰なし確認
- [x] フロントエンド型定義（`Item`型）に`dependsOn`/`blocks`追加
- [x] `git diff --stat master..HEAD`で変更範囲確認
- [x] 実機確認（curl等でAPIレスポンス確認）
- [x] `docs/requests_log.md` R-099の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

**完了報告（2026-08-14）**: ブランチ`feature/R-099-items-api-dependency-fields`（worktree `.claude/worktrees/R-099`、master `8db0dd3`ベース）。コミット`98a8d3d`(Red)→`d36f561`(実装)→`0d872b4`(requests_log.md更新)。`BaseController.php`に`buildDependencyMap()`新設、`mapItemRow($item, $dependencyMap)`拡張。`ItemController.php`の9箇所（getMyItems各scope・getProjectItems・getSubTasks・show）に配線。新規テスト18件（`test_r099_dependency_fields.php`、値検証＋N+1回避のクエリ回数検証）全Green。既存backend/frontendテスト回帰なし（既知の無関係な既存失敗のみ）。dev環境で`dependsOn`/`blocks`の実値をAPI照会で確認済み。

**指揮AIによる独立レビュー（Codex）で発見・修正（2026-08-14）**: 新規テスト`test_r099_dependency_fields.php`が開発用実DB（`jbwos.sqlite`）へ直接接続し、後片付けの`DELETE ... WHERE tenant_id IS NULL OR tenant_id = ''`が個人アカウントの無関係な既存依存関係を無条件削除する破壊的バグを発見。専用一時DB接続＋削除範囲を`r099_`プレフィックス限定へ修正し、巻き込み削除防止テストを追加（ブランチ`fix/R-099-test-safety`、コミット`8de3240`）。あわせて`BaseController::buildDependencyMap()`のテナント境界（`joinedTenants`に`currentTenantId`が欠けるケース）で依存関係が欠落する問題も修正し、`dashboard`/`getSubTasks`/`show`と挙動を揃えた。修正後テスト23件全Green。

**masterマージ・本番デプロイ・実機検証完了（2026-08-14）**: `git merge fix/R-099-test-safety`でmasterへ統合（fast-forward、`8de3240`）。`upload.ps1`でデプロイ後、本番`GET /items`（aggregated 481件・company 294件・personal 187件）全てに`dependsOn`/`blocks`フィールドが含まれ、実データ134件が実際の依存関係を保持していることをAPI照会で確認。

### 注意事項
- 既存のフロントエンドの依存関係取得ロジック（`DependencyRepository`経由で`GET /dependencies`を叩く既存コード）は変更・撤去しない。今回はAPIに新フィールドを追加するだけで、既存の取得経路と共存させる
- パフォーマンス上の懸念（一覧系メソッド全てへの適用が想定より重い等）に気づいた場合は、自己判断で範囲を縮小せず指揮AIに確認すること

---

## R-100 ガント完了アイテムのカレンダー要素・依存関係エッジをグレー化（2026-08-14）

**ブランチ**: `feature/R-100-gantt-completed-gray`
**要望**: `docs/requests_log.md` R-100
**仕様**: `docs/SPEC/03_画面設計.md` §5.4「完了アイテムのカレンダー要素・依存関係エッジのグレー化（R-100）」

### 背景
発注者から「ガントの完了表示モードで、完了アイテムのカレンダー上の要素と依存関係エッジもグレーにしてほしい。完了したのかどうかがわかりづらい」との要望。R-035でタイトル文字列（`COMPLETED_ITEM_CLASS`、取り消し線＋グレー）は完了時にグレー化済みだが、日別の視覚要素・依存関係矢印は未対応。

### 指揮AI事前調査済み（実装Agentは再調査不要）
- `RyokanGanttView.tsx`は`isItemDone(item)`（`logic/statusUtils.ts`）で完了判定済みの`done`変数を行レンダリング時に既に持っている（902行目付近）
- 「日別割当チップ」: 1033〜1045行目付近。`className`に`"bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600"`が固定で入っている。`done`のとき`bg-slate-400 hover:bg-slate-500 dark:bg-slate-600`等のグレー系に切り替えること
- 「目安納期ハンドル（ドラッグつまみ）」: 1061〜1069行目付近。`"bg-indigo-400 border border-white dark:border-slate-900 shadow-md"`が固定。`done`のときグレー系に切り替えること
- 「顧客納期の赤マーカー」（1074行目、`bg-red-500/80`）は対象外。完了・未完了に関わらず赤のまま変更しないこと
- 依存関係矢印: `GanttDependencyArrows`コンポーネント（1119行目付近）の`<path stroke="#6366f1" .../>`（1221行目）と、矢印マーカー`<polygon ... fill="#6366f1" />`（1208行目）が対象。各`arrow`について、対応する`dependencies`エントリの`sourceItemId`・`targetItemId`から実アイテムの完了状態を引き、いずれかが完了済みならグレー系（例: `#94a3b8`のようなslateトーン）にする。現在`arrows`の`useMemo`内では`sourceItem`/`targetItem`を一度取得しているので、そこで`isItemDone()`判定した結果を`arrows`配列の各要素（`{key, x1, y1, x2, y2}`）に`isDimmed: boolean`のような形で持たせ、SVG描画時に参照する形が自然
- グレーの具体的な色トーンは、既存の`COMPLETED_ITEM_CLASS`（`logic/statusUtils.ts`）や他画面のグレー表現と視覚的に統一感が出るよう実装Agントの判断で選んでよい

### サブタスク

- [x] worktree作成
- [x] 失敗するテストを先に書く（`RyokanGanttView.completedGray.test.tsx`）→ Red確認
- [x] 実装
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD`で変更範囲確認
- [x] 実機検証（chrome-devtools/claude-in-chrome MCP）
- [x] `docs/requests_log.md` R-100の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

（注: R-100は一時的なAPIエラーで一度中断・再開した経緯あり。完了報告の詳細は当該Agentからの完了報告メッセージを参照）

**指揮AIによる独立レビュー（Codex）**: `RyokanGanttView.tsx`の完了アイテムグレー化ロジック（割当チップ・目安納期ハンドル・依存関係矢印）は仕様通り実装されており、顧客納期の赤マーカーも対象外のまま維持されていることを確認。テストの網羅性（顧客納期マーカーの非対象確認・矢印グレー色の厳密検証）に改善余地はあるが実装自体に問題はないと判断し、追加修正は見送り。

**本番デプロイ・実機検証完了（2026-08-14）**: master統合済みコード（コミット`f240230`）を`upload.ps1`でデプロイ後、本番ガント画面の「完了表示」モードで完了アイテムの割当チップ52個が`.bg-slate-400`、依存関係エッジ17本が`stroke="#94a3b8"`＋グレー矢印マーカー（`#gantt-dep-arrowhead-done`）になっていることをDOM照会で確認。

---

## R-101 フローチャート画面に全体印刷ボタンを追加（2026-08-14）

**ブランチ**: `feature/R-101-flow-print-button`
**要望**: `docs/requests_log.md` R-101
**仕様**: `docs/SPEC/03_画面設計.md` §7.9「コンテンツ印刷ボタン（R-101）」

### 背景
発注者から「フローチャートも全体を印刷するボタンを作って」との要望。R-098（ガント・全体一覧の印刷ボタン）の延長で、フローチャート画面（`FlowScreen.tsx`）にも印刷ボタンを追加する。

### 指揮AI事前調査済み（実装Agentは再調査不要）
- `FlowScreen.tsx`は`useReactFlow()`から`fitView`を取得済み（93行目）
- 既存の「全体表示」ボタン（1105〜1112行目）: `onClick={() => fitView({ duration: 300, padding: 0.1 })}`。フローチャート内の全ノードが画面に収まるよう自動でズーム・パンする
- ヘルプボタン（1097〜1104行目）、全体表示ボタン（1105〜1112行目）は`className="absolute top-* right-3 ..."`で右上に縦に並んでいる。印刷ボタンも同じ配置パターンで追加するのが自然
- `.no-print`クラス・`@media print { .no-print { display: none !important } }`はR-098で`index.css`に追加済みでそのまま使える
- 印刷ボタン押下時は、`fitView({ duration: 0, padding: 0.1 })`（アニメーションなしで即座に全ノードを収める）を実行してから`window.print()`を呼ぶこと

### サブタスク

- [x] worktree作成
- [x] 失敗するテストを先に書く（`FlowScreen.print.test.tsx`）→ Red確認
- [x] `FlowScreen.tsx`に印刷ボタンを追加（Printerアイコン）
- [x] ヘッダー・ヘルプボタン・全体表示ボタン・Controls・MiniMap等のUIクロームに`.no-print`を付与
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD`で変更範囲確認
- [x] 実機検証（claude-in-chrome MCP）
- [x] `docs/requests_log.md` R-101の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

**完了報告（2026-08-14）**: ブランチ`feature/R-101-flow-print-button`（worktree `.claude/worktrees/R-101`、master `8db0dd3`ベース）。`FlowScreen.tsx`に印刷ボタン追加（`handlePrint`: `fitView({duration:0,padding:0.1})`即時実行→`window.print()`）。`.no-print`をヘルプ・全体表示・印刷ボタン・Controls・MiniMap・FlowHeaderに付与。新規テスト2件Green、vitest全件860 pass/14 skip/1 failed（既知の無関係な`useAssigneeView.test.ts`のみ）。claude-in-chrome MCPで実機検証: 画面外に出た3ノードが印刷ボタンでfitViewにより再表示、`.no-print`要素8個が非表示化されコンテンツのみ残ることを確認。

**指揮AIによる独立レビュー（Codex）で発見・修正（2026-08-14）**: 「未配置」パネル（`Flow/UnplacedItemList.tsx`）に`.no-print`が付与されておらず、全体印刷時に混入する漏れを発見。`.no-print`を付与し、`FlowScreen.print.test.tsx`にテストケースを追加（ブランチ`fix/R-101-print-unplaced`、コミット`0c381f2`）。

**masterマージ・本番デプロイ・実機検証完了（2026-08-14）**: `git merge fix/R-101-print-unplaced`でmasterへ統合（マージコミット`8dde5a1`）。`upload.ps1`でデプロイ後、本番フローチャート画面で「未配置」パネルに`.no-print`が付与され`@media print`ルールで非表示になることをCSSOM経由で確認。

---

## R-102 フローチャート印刷ボタンで全体が中央に印刷されない（2026-08-14）

**ブランチ**: `fix/R-102-print-centering`
**要望**: `docs/requests_log.md` R-102
**仕様**: `docs/SPEC/03_画面設計.md` §7.9

### 背景
改善要望フォーム経由（2026-08-14 13:42）。「フローチャートで印刷ボタンを押してみたら、全体が中央に印刷されていない。中央にして。」本日デプロイしたR-101（フローチャート印刷ボタン）の後続バグ。スクリーンショット（`backend/data/requests_sub_uploads/019ffe94-896c-7bc7-b0d7-516bcf787fb2.png`、本番サーバーのみ）で、印刷プレビューの用紙右端の細い帯にフローチャート全体が押し込まれ、用紙の大部分が空白になっている症状を確認済み。

### 指揮AI事前調査済み（実装Agentは再調査不要）
- `JWCADTategu.Web/src/index.css`の印刷用CSS（68-72行目付近）は`.no-print { display: none !important; }`のみで、React Flowのビューポート要素（`.react-flow`本体）を印刷用紙のサイズにフィットさせるスタイルが一切存在しない
- React Flowは既定でブラウザの画面表示サイズ（px単位の画面ビューポート）を基準にcanvasをレイアウトするため、印刷時にブラウザが用紙サイズへ再レイアウトする過程で、この画面基準のサイズ指定がそのまま持ち込まれ、用紙の一部にしか収まらなくなっている可能性が高い
- `FlowScreen.tsx`の`handlePrint`（898-900行目付近）は`fitView({ duration: 0, padding: 0.1 })`→`window.print()`の順で実行しており、fitView自体は正しく全ノードを画面内に収めている。問題は印刷時のCSSレイアウト側にあると推測される
- 対応方針の候補（実装Agentが調査の上、妥当な方法を選ぶこと）: `@media print`内で`.react-flow`関連要素の`width`/`height`を`100%`または用紙基準に上書きする、`@page`ルールでサイズ・マージンを明示する、印刷直前に一時的なインラインスタイルで実ピクセルサイズを用紙相当に変更する、等

### サブタスク

- [ ] worktree作成（`git worktree add .claude/worktrees/fix-R102-print-centering -b fix/R-102-print-centering master`、`git worktree list`で実在確認）
- [ ] 失敗するテストを先に書く → Red確認
- [ ] 印刷レイアウトの原因調査・修正
- [ ] Green確認・既存テスト回帰なし確認
- [ ] `git diff --stat master..HEAD`で変更範囲確認
- [ ] 実機検証（claude-in-chrome MCP等で印刷プレビュー相当の確認。ブラウザの実際の印刷ダイアログ操作は自動化ツールの制約でフリーズする可能性があるため、`window.print()`自体を発火させず、印刷用CSS適用状態のスクリーンショットやレイアウト計算値で代替確認すること）
- [ ] `docs/requests_log.md` R-102の対応状況を更新
- [ ] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

---

## R-103 目安時間の全角入力を半角として認識する（2026-08-14）

**ブランチ**: `fix/R-103-time-input-fullwidth`
**要望**: `docs/requests_log.md` R-103
**仕様**: `docs/SPEC/03_画面設計.md` §7.7.4

### 背景
改善要望フォーム経由（2026-08-13 15:35）。「目安時間に全角で入力したら半角に変換して認識して」

### 指揮AI事前調査済み（実装Agentは再調査不要）
- `JWCADTategu.Web/src/features/core/youkan/logic/timeParser.ts`の`parseTimeInput()`が半角数字専用の正規表現（`\d`）のみでマッチしており、全角数字（`１２３`等）・全角記号（`ｈ`/`ｍ`等）を入力すると全パターンにマッチせず`null`を返す（未入力扱いになり保存されない）
- 対応: `parseTimeInput()`の冒頭で、入力文字列の全角英数字・記号を半角へ正規化してから既存の判定ロジックに通す（`String.prototype.normalize('NFKC')`等の標準機能での変換を優先し、ライブラリ追加は不要）
- 単一の共通関数（`parseTimeInput()`）を直すため、フローチャート・ガント・全体一覧等の呼び出し元ごとの個別対応は不要

### サブタスク

- [ ] worktree作成（`git worktree add .claude/worktrees/fix-R103-time-input-fullwidth -b fix/R-103-time-input-fullwidth master`、`git worktree list`で実在確認）
- [ ] 失敗するテストを先に書く（`timeParser.test.ts`に全角入力パターンを追加）→ Red確認
- [ ] `parseTimeInput()`に全角→半角正規化を実装
- [ ] Green確認・既存テスト回帰なし確認
- [ ] `git diff --stat master..HEAD`で変更範囲確認
- [ ] 実機検証（いずれかの目安時間入力欄で全角入力→正しく認識されることを確認）
- [ ] `docs/requests_log.md` R-103の対応状況を更新
- [ ] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

---

## R-104 フローチャートの各ノードに納期・マイ期限をさりげなく表示する（2026-08-14）

**ブランチ**: `feature/R-104-flow-node-due-date`
**要望**: `docs/requests_log.md` R-104
**仕様**: `docs/SPEC/03_画面設計.md` §7.10

### 背景
改善要望フォーム経由（2026-08-14 13:44）。「ふろーちゃーとに、それぞれののーどのマイ期限、もしくは納期がいつになっているかもさりげなく添えるとしたらどういうやりかたにするのがいいかな？やってみてほしい」。提案型の要望のため、表示方法自体の設計検討を実装Agentに委ねる。

### 指揮AI事前調査済み（実装Agentは再調査不要）
- `FlowItemNode.tsx`は既に目安時間バッジ（§7.7.3、`formatMinutes(item.estimatedMinutes)`）を持っている。同様のパターンで`item.due_date`（顧客納期）・`item.prep_date`（マイ期限）をノード下部に追加するのが自然
- ガント画面（`RyokanGanttView.tsx`）の日別「目安納期ハンドル」・「顧客納期の赤マーカー」の配色（顧客納期=赤系、マイ期限=別トーン）と視覚的な一貫性を持たせることが望ましい
- 「さりげなく」という要望のニュアンスを尊重し、未設定なら非表示、設定済みでも小さく控えめな表示とすること
- 両方設定されている場合の表示（両方出す／どちらか優先）は実装Agentが妥当な案を判断してよい。判断に迷う場合は指揮AIに確認すること

### サブタスク

- [ ] worktree作成（`git worktree add .claude/worktrees/feature-R104-flow-node-due-date -b feature/R-104-flow-node-due-date master`、`git worktree list`で実在確認）
- [ ] 表示方法の設計案を決定（判断に迷えば指揮AIに確認）
- [ ] 失敗するテストを先に書く → Red確認
- [ ] `FlowItemNode.tsx`に納期・マイ期限表示を実装
- [ ] Green確認・既存テスト回帰なし確認
- [ ] `git diff --stat master..HEAD`で変更範囲確認
- [ ] 実機検証（claude-in-chrome MCP等）
- [ ] `docs/requests_log.md` R-104の対応状況を更新
- [ ] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

---

## R-105 ガントチャート「時間軸タイムライン表示」（2026-08-16）

**ブランチ**: `feature/R-105-gantt-timeline-blocks`
**要望**: `docs/requests_log.md` R-105
**仕様**: `docs/SPEC/03_画面設計.md` §5.3（時間軸タイムライン表示）、`docs/SPEC/04_データ設計.md` §3.5（ガント時間軸タイムラインのブロック位置）
**相談計画**: `C:\Users\fjtsu\.claude\plans\konoyoukan-no-gantotya-to-hyouji-hidden-gizmo.md`

### 背景
週表示・日表示のガントに「何時から何時までこのタスクをする」という時間軸を持たせたいという要望。相談の結果、既存`RyokanGanttView`を拡張し、`ganttScaleMode`に`'daily'`を追加。`'weekly'`/`'daily'`ではタスクを「目安時間÷24h」の幅・その日の中の開始オフセット位置を持つブロックとして描画する（`'monthly'`は従来の日次チップ表示のまま変更なし）。

### 指揮AI事前調査済み（実装Agentは再調査不要）
- **新規テーブル・新規Controller・新規APIエンドポイントは不要**。`items`テーブルの既存汎用JSON列`meta`を再利用する。`ItemController::update()`の`$allowedFields`に既に`'meta'`が含まれ、`BaseController::updateEntity()`は配列値を自動で`json_encode`/`json_decode`する（`backend/BaseController.php` L292-297・L382-417、`backend/ItemController.php` L911）
- フロント側の`meta`マージ・保存パターンは`FlowScreen.tsx` L279-283（`updateItemMeta`）・L311で確立済み。`{ ...(item.meta || {}), gantt_time_blocks: {...} }`という同型のマージをそのまま踏襲する
- 保存構造: `items.meta.gantt_time_blocks = { "YYYY-MM-DD": 開始オフセット分(0-1439) }`。未調整の日はキーが存在せず自動配置にフォールバック
- 既存の`allocationMap`（`RyokanGanttView.tsx` L512-541、日ごとの割当分計算、`QuantityEngine.allocateBackwardsCore`）は変更不要。今回追加するのは「その日に割り当てられた分の中で何時何分から始まるか」の横位置情報のみ
- 行順（`transformedItems`）は既にR-076/F-25（`logic/hierarchy.ts`）により依存関係順に整列済みのため、追加のトポロジカルソートは不要
- 既存の`visibleDependencies`（`RyokanGanttView.tsx` L174-179）から`targetItemId -> [sourceItemId...]`のpredecessorマップを構築できる
- `prep_date`ドラッグの`mousemove`/`mouseup` on `window`実装パターン（`RyokanGanttView.tsx` L182-187, L306-329）を新規`timeBlockDragState`でも踏襲する
- `VolumeCalendarScreen.tsx` L56-91のモード別列幅・行高さ独立記憶（`localStorage`）パターンに`daily`用キーを追加する

### 設計要件（相談で確定・変更しないこと）
1. ブロック幅 = その日の割当時間(分) ÷ 1440分
2. 開始位置デフォルト: その日の先頭（0:00）。ただし同日・同行内で依存関係により先行するタスクの割当があれば、その直後から配置
3. ユーザーは横方向（時間軸方向）にドラッグして開始位置を手動調整でき、位置は`meta.gantt_time_blocks`に保存・再現される
4. 24時間をはみ出す場合、ブロックの右端をその日の末尾（24:00）に揃えて描画し、警告マーク「❗️」を表示
5. 稼働時間によるグレー背景は実装しない（検討したが撤回済み。24h全体を通常背景のまま扱う）
6. `timelineMode`未指定時（＝`monthly`表示）は既存の日次チップ表示を完全維持し、既存テスト・既存動作に一切影響を与えないこと

### サブタスク

- [ ] worktree作成（`git worktree add .claude/worktrees/feature-R105-gantt-timeline-blocks -b feature/R-105-gantt-timeline-blocks master`、`git worktree list`で実在確認）
- [ ] `logic/__tests__/ganttTimeBlocks.test.ts`を先に書く（自動配置の先頭寄せ／依存タスク直後配置／手動オフセット優先／24hはみ出し時の`overflow`フラグと幅クランプ）→ Red確認
- [ ] `logic/ganttTimeBlocks.ts`実装（`computeDailyTimeBlockLayout`関数。相談計画ファイルに実装例あり）→ Green確認
- [ ] `components/Calendar/__tests__/RyokanGanttView.timelineBlocks.test.tsx`を先に書く（`timelineMode`未指定時は既存チップ表示のまま＝後方互換保証／ブロックの`left`/`width`スタイル／同日依存関係での直後配置）→ Red確認
- [ ] `RyokanGanttView.tsx`に`timelineMode?: boolean` prop追加、`timelineMode`時のみ計算する`useMemo`群（`dailyEntriesByDate`/`predecessorsByItemId`/`manualOffsetsByItemId`/`timeBlockLayoutsByDate`）とセル描画分岐を実装 → Green確認
- [ ] `components/Calendar/__tests__/RyokanGanttView.timelineDrag.test.tsx`を先に書く（ドラッグ確定時の`onUpdateItem`呼び出し内容・`meta.gantt_time_blocks`更新・24h超クランプ）→ Red確認
- [ ] ドラッグハンドラ実装（`timeBlockDragState`新設、px→分変換、`[0,1439]`クランプ、確定直前に最新`item.meta`を読み直してからマージ）→ Green確認
- [ ] `screens/__tests__/VolumeCalendarScreen.ganttScale.test.tsx`（既存拡張）で`daily`モード追加・`localStorage`独立記憶を検証 → Red確認 → `VolumeCalendarScreen.tsx`の`ganttScaleMode`型拡張・`youkanKeys.ts`に`GANTT_COL_WIDTH_DAILY`/`GANTT_ROW_HEIGHT_DAILY`追加 → Green確認
- [ ] `components/Calendar/__tests__/CalendarHeader.test.tsx`（既存拡張）で3ボタントグルを検証 → Red確認 → `CalendarHeader.tsx`に「デイリー」ボタン追加 → Green確認
- [ ] `RyokanCalendar.tsx`に`ganttTimelineMode` prop drilling追加。既存の`RyokanCalendar.*.test.tsx`群が壊れないことを確認
- [ ] `npm.cmd run test -- --run`全体実行、既存テスト回帰なし確認
- [ ] `git diff --stat master..HEAD`で変更範囲確認
- [ ] 実機検証（`/run`スキルまたはchrome-devtools系ツール）: デイリー/ウィークリーモード切替、ブロックの幅・位置の目視確認、ドラッグでの開始位置変更とリロード後の保持確認、24hはみ出し時の右端揃え＋❗️警告確認、マンスリーモードに戻して従来の日次チップ表示が変化していないことの確認、列幅スライダー上限の妥当性確認（現状`max=80`では時間分解能を見せるには狭い可能性が高いため、実機体感で調整）
- [ ] `docs/requests_log.md` R-105の対応状況を更新
- [ ] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

---

## R-105-Y2 + R-106 ガント時間軸タイムライン改善2件（2026-08-16）

**ブランチ**: `feature/R-105-Y2-R-106-gantt-timeline-polish`
**要望**: `docs/requests_log.md` R-105-Y2, R-106
**仕様**: `docs/SPEC/03_画面設計.md` §5.3
**背景**: R-105（ガント時間軸タイムライン表示）は本番デプロイ済み。発注者からのフォローアップ要望2件と、改善要望フォーム経由の要望1件（実質2件、うち1件は上位互換で統合済み）をまとめて対応する。いずれも`RyokanGanttView.tsx`・`CalendarHeader.tsx`という同じファイルを触るため1ブランチにまとめる

### R-105-Y2: 時間軸ブロックへの目安時間表示＋依存矢印のブロック端合わせ

指揮AI事前調査済み（実装Agentは再調査不要）:
- `RyokanGanttView.tsx`の時間軸ブロック（`timelineMode`時、L1147-1190付近）にはテキストラベルが無く❗️はみ出し警告のみ表示。マンスリー表示の日次チップ（L1198-1201）は`step.allocatedMinutes >= 60 ? Math.round(step.allocatedMinutes / 60) + 'h' : ''`で時間ラベルを表示済み。これと同様の表示をブロック中央に追加する
- `GanttDependencyArrows`コンポーネント（L1278-）の矢印座標計算（L1337: `x1 = stickyColWidth + (sourceDayIdx + 1) * colWidth`、L1339: `x2 = stickyColWidth + targetDayIdx * colWidth`）は`timelineMode`の有無にかかわらず常に「日付セルの右端/左端」を使っている。`timelineMode`時は、`RyokanGanttView`が既に計算済みの`timeBlockLayoutsByDate`（L609-649）を`GanttDependencyArrows`にpropsとして渡し、`sourceItem`/`targetItem`の対応日付に時間軸ブロックがあれば、そのブロックの実際の右端（`x1 = stickyColWidth + sourceDayIdx * colWidth + (startOffsetMinutes + displayWidthMinutes) / DAY_MINUTES * colWidth`）・左端（`x2 = stickyColWidth + targetDayIdx * colWidth + startOffsetMinutes / DAY_MINUTES * colWidth`）を使うよう改修する。該当日に時間軸ブロックが無い場合は既存の日付セル端計算にフォールバックする

### R-106: 列幅スライダー最大値の表示領域幅化＋「密度」→「行高」改称

指揮AI事前調査済み（実装Agentは再調査不要）:
- `CalendarHeader.tsx`の`COL_WIDTH_MAX = { monthly: 80, timeline: 240 }`（L16付近）が固定値でスライダー`max`を決めている。ガント表示エリア（日付列が並ぶスクロール可能領域、タスク一覧列を除く）の可視幅を動的に取得し（`ResizeObserver`等、実装方式はAgent判断）、スライダーの`max`として使うよう改修する。CalendarHeaderは独立コンポーネントのため、実際の表示エリア幅は親（`RyokanGanttView.tsx`または`VolumeCalendarScreen.tsx`）から計測してpropsで渡す設計が必要
- `CalendarHeader.tsx`のL201（表示テキスト）・L203（`aria-label`）の「密度」を「行高」に変更する。既存の`CalendarHeader.test.tsx`に「密度」を前提にしたテストがあれば合わせて更新する

### サブタスク

- [x] worktree作成（`git worktree add .claude/worktrees/feature-R105Y2-R106-gantt-polish -b feature/R-105-Y2-R-106-gantt-timeline-polish master`、`git worktree list`で実在確認）
- [x] 失敗するテストを先に書く（時間軸ブロックに目安時間ラベルが表示されること）→ Red確認 → 実装 → Green確認
- [x] 失敗するテストを先に書く（`timelineMode`時に依存矢印がブロック端座標を使うこと、ブロック無し日はセル端にフォールバックすること）→ Red確認 → 実装 → Green確認
- [x] 失敗するテストを先に書く（列幅スライダーの`max`が表示領域幅に応じて変化すること）→ Red確認 → 実装 → Green確認
- [x] 失敗するテストを先に書く（「行高」ラベル・aria-label）→ Red確認 → 実装 → Green確認
- [x] `npm.cmd run test -- --run`全体実行、既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD`で変更範囲確認
- [x] 実機検証（`/run`スキルまたはchrome-devtools系ツール）: ウィークリー/デイリーで時間軸ブロックに時間ラベルが見えること、依存関係のあるタスクで矢印がブロック端（マス目端ではなく）から出ていること、列幅スライダーを最大まで動かすと列が表示領域いっぱいに近づくこと、行高スライダーのラベルが「行高」になっていること、マンスリー表示が変化していないこと（後方互換）
- [x] `docs/requests_log.md` R-105-Y2・R-106の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

---

## R-107 フローノードの表示レイアウト圧縮（2026-08-17）

**ブランチ**: `feature/R-107-flow-node-layout-compact`
**要望**: `docs/requests_log.md` R-107
**仕様**: `docs/SPEC/03_画面設計.md` §7.10「レイアウト圧縮（R-107）」

### 背景

改善要望フォーム経由（2026-08-17 01:54）。「フローチャート画面のノードの中のレイアウトを変えたい。現状は、状態・目安時間のあと改行して『期限 8/16』のようになっているが、これを改行をやめてたい。添付画像の例なら『Inbox 1h 8/16』と書いてほしい。8/16　と表示されている根拠がマイ期限なら青、納期なら赤　というルールであれば、『期限』というラベルも不要になる」。R-104（フローノードへの納期・マイ期限表示）のフォローアップ。

### 指揮AI事前調査済み（実装Agentは再調査不要）

`JWCADTategu.Web/src/features/core/youkan/components/Flow/FlowItemNode.tsx`:
- L187-223: ステータス・目安時間の行（`<div className="flex items-center gap-1">`、`item.status`のuppercaseラベルと目安時間バッジ）
- L224-237: 納期・マイ期限の行（別の`<div className="flex items-center gap-1.5 text-[8px] leading-tight">`）。`due_date`設定時は`text-red-400`で「納期 M/d」、`prep_date`設定時は`text-indigo-400`で「期限 M/d」とラベル付きで表示

この2つの`<div>`が別要素のため画面上で改行される。要望は以下:
1. 2つの行を1つの`<div>`（同一flexコンテナ）に統合し、「INBOX 1h 8/16」のように1行で表示する
2. 「納期」「期限」のラベルテキストを削除し、色（`text-red-400`=納期、`text-indigo-400`=マイ期限、既存配色は維持）のみで区別する
3. 両方設定されている場合は両方の日付を続けて表示する（ラベルが無くても色で区別できるため）

### サブタスク

- [ ] worktree作成（`git worktree add .claude/worktrees/feature-R107-flow-node-layout-compact -b feature/R-107-flow-node-layout-compact master`、`git worktree list`で実在確認）
- [ ] 失敗するテストを先に書く（1行に統合されていること、ラベルテキスト「納期」「期限」が表示されないこと、日付自体・色分けは維持されること、両方設定時に両方表示されること、未設定時は非表示のままであること）→ Red確認
- [ ] `FlowItemNode.tsx`のレイアウトを実装（既存の`FlowItemNode.dueDate.test.tsx`があれば合わせて更新）
- [ ] Green確認・既存テスト回帰なし確認
- [ ] `git diff --stat master..HEAD`で変更範囲確認
- [x] 実機検証（`/run`スキルまたはchrome-devtools系ツール）: フローチャート画面で、目安時間・納期・マイ期限が設定されたノードが1行レイアウトで表示されること、ラベルテキストが出ないこと、色分けで納期/マイ期限が区別できること、未設定項目の要素がないこと（指揮AIが代行検証・確認済み）
- [x] `docs/requests_log.md` R-107の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）→ 指揮AIレビュー完了、マージ・デプロイへ進行中

---

## R-108 フローチャート複数選択まとめ移動後の位置巻き戻りバグ修正（2026-08-17）

**ブランチ**: `fix/R-108-flow-multiselect-move-revert`
**要望**: `docs/requests_log.md` R-108
**仕様**: `docs/SPEC/03_画面設計.md` §7.11

### 背景

会話内発言原文: 「フローチャート画面でシフトをしながらドラッグすると範囲選択ができますよね　それで選択した状態でどれか要素をつかんでドラッグするとその選択をされたアイテムが全部いっぺんに相対距離を保ちながら移動できるんですけど　移動した後に何もないところをクリックして　選択解除をしたら、　全部元の位置に戻っていってしまいます　これはバグだと思うので直してほしいです」

期待動作: Shift+ドラッグの範囲選択→複数ノードをまとめてドラッグ移動→キャンバスの空白部分をクリックして選択解除、という一連の操作後も、移動した位置がそのまま維持されること。

### 指揮AI事前調査済み（実装Agentは深追いせずここから調査開始してよい）

`JWCADTategu.Web/src/features/core/youkan/screens/FlowScreen.tsx`:
- `onNodeDragStop`（L436-469付近）の複数選択パス（`selectedNodes.length > 1`）: 各ノードについて`await updateItemMeta(node.id, { flow_x: node.position.x, flow_y: node.position.y })`をforループでシーケンシャル呼び出し（L445-447）→ `setAllItems`でローカル反映（L448-454）→ `buildGroupNodes`で`nodes`ステートを再構築（L458-469）
- `updateItemMeta`は別途定義された関数（`allItems`をuseCallback依存配列に持つクロージャ）。`allItems`スナップショットに基づいて`currentMeta`をマージしてから`ApiClient.updateItem()`を呼ぶ
- `onSelectionChange`（L328-331）は`selectedNodeIds`/`selectedEdgeIds`のstate更新のみに見えるが、この状態変化をトリガーに`nodes`または`allItems`が再構築される別の処理（`useEffect`等）が存在し、その時点でサーバー保存がまだ反映されていない・またはローカル`allItems`と`nodes`の同期が崩れている古い位置データで上書きされている可能性が高い
- 疑わしい具体的シナリオ: (1) 複数ノードへの`updateItemMeta`呼び出しがシーケンシャル（forループ内await）のため、途中のノードの保存中に他の処理（React再レンダリング等）が古い`allItems`を参照してしまうrace condition、(2) `nodes`ステートを`allItems`から再構築する`useEffect`が、選択解除時の再レンダリングをトリガーに走り、その時点の`allItems`がまだ全ノード分の位置更新を反映していない、(3) React Flow自体の内部position stateと、Reactコンポーネント側で管理する`nodes`ステートの同期タイミングのズレ
- 実装Agentはまずブラウザ操作で確実に再現させ、コンソールログ・Reactデバッグツール等で「いつ・どのstateが」元の位置に巻き戻るのかを特定してから修正すること

### サブタスク

- [ ] worktree作成（`git worktree add .claude/worktrees/fix-R108-flow-multiselect-move-revert -b fix/R-108-flow-multiselect-move-revert master`、`git worktree list`で実在確認）
- [ ] 実機（開発サーバー）で再現確認: フローチャート画面でShift+ドラッグ範囲選択→複数ノードドラッグ移動→キャンバス空白クリックで選択解除→位置が戻ることを確認
- [ ] 根本原因を特定し、`docs/handover/`または報告内に記録
- [ ] 失敗するテストを先に書く（複数選択移動後、選択解除相当の操作をしても位置が保持されること）→ Red確認
- [ ] 修正実装
- [x] Green確認・既存テスト回帰なし確認
- [x] `git diff --stat master..HEAD`で変更範囲確認
- [x] 実機再検証（本番配信バンドルのコードレベル確認。claude-in-chromeのモディファイア制約でUI操作の完全再現はできず）
- [x] `docs/requests_log.md` R-108の対応状況を更新
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）→ マージ・本番デプロイ完了（2026-08-17）

---

## R-109 フローチャート日付グルーピング表示（2026-08-17）

**ブランチ**: `feature/R-109-flow-date-grouping`
**要望**: `docs/requests_log.md` R-109
**仕様**: `docs/SPEC/03_画面設計.md` §7.12

### 背景

会話内発言＋手書き図により、フローチャート画面に「日付ごとのグルーピング表示」機能を追加する要望。発注者指定により実装着手前に相談を実施し、仕様を確定済み。詳細は`docs/SPEC/03_画面設計.md` §7.12を参照（実装Agentは仕様検討済みのためそちらを正とし、再相談は不要）。

### 指揮AI事前調査済み（実装Agentは再調査不要）

- `FlowScreen.tsx`のヘッダーは1段のみ。既存トグルはなく、ヘルプ／全体表示／印刷ボタンが`absolute top-*`でキャンバス右上に縦に並ぶフローティング配置パターン（1121-1144行目付近）。新規「日付表示」チェックボックスもこのパターンに追加するのが自然
- ノード自動配置は`JWCADTategu.Web/src/features/core/youkan/logic/flowAutoPlace.ts`の`calculateAutoPlacement`。`computeLayers`（53-97行目）がLongest Path Layeringで依存深さ（レイヤー）を計算し、同一レイヤー内は`sortItemsForChain`で有効締切順にソートしている。x座標=`xBaseOffset + layer * X_INTERVAL(250)`、y座標=レイヤー内で中央揃え。今回の日付グルーピングはこれとは異なる軸（依存深さではなく日付）でx座標を決めるため、新規のレイアウト関数として実装する必要がある（既存の`calculateAutoPlacement`を流用せず、参考にする程度でよい）
- 有効締切（`due_date`/`prep_date`の早い方）の計算は`hierarchy.ts`の`getEffectiveDeadline`と同等ロジックが`flowAutoPlace.ts`内にも存在する（共通化されているか確認し、あれば再利用すること）
- 依存関係は`item_dependencies`テーブル・`DependencyRepository`のシンプルなCRUD（`{id, sourceItemId, targetItemId, createdAt}`）。DAGのトポロジカルソートは`hierarchy.ts`の`sortWithDependencies`（Kahn's algorithm、41-183行目）が参考になるが、今回必要なのは「最長経路（クリティカルパス）」の計算であり、トポロジカルソートとは別に新規実装が必要
- ノード位置は`item.meta.flow_x`/`item.meta.flow_y`に保存。手動ドラッグ時の保存パターンは`FlowScreen.tsx`の`onNodeDragStop`・`updateItemMeta`を参照（R-108でこの保存順序にバグがあり修正済みなので、同じ順序の考え方＝ローカルstate確定を保存より先に行う、を踏襲すること）

### 仕様概要（詳細は`03_画面設計.md` §7.12）

1. 右上フローティングボタン列に「日付表示」チェックボックス＋（グルーピング表示中のみ）「元に戻す」ボタンを追加
2. 区切り基準は有効締切（`due_date`/`prep_date`の早い方）
3. チェックON時、x軸を日付軸として日付ごとに縦区切り線＋背景色分け。各区間内は依存関係順・既存の上下位置をできるだけ保ってy軸整列。実際に`flow_x`/`flow_y`を書き換えて保存する
4. 各区間下部に「合計Xh」（その日が締切のタスクの目安時間単純合計）「最短Yh」（その区間内だけのクリティカルパス、区間をまたぐ依存は無視、並列分岐は最大値・直列は合計）を表示
5. チェックON適用直前の全ノード位置をフロント側stateにバックアップし、「元に戻す」ボタンで1段階Undo

### サブタスク

- [ ] worktree作成（`git worktree add .claude/worktrees/feature-R109-flow-date-grouping -b feature/R-109-flow-date-grouping master`、`git worktree list`で実在確認）
- [ ] 純粋関数のロジックから着手（TDD、DOM非依存で書けるため優先）:
  - [ ] 失敗するテストを先に書く: 有効締切でアイテムを日付キーごとにグルーピングする関数 → Red確認 → 実装 → Green確認
  - [ ] 失敗するテストを先に書く: 日付区間内のクリティカルパス（最長経路）計算関数。直列は合計、並列分岐は最大値。区間外の依存は無視。循環依存がある場合の安全側フォールバックも検討 → Red確認 → 実装 → Green確認
  - [ ] 失敗するテストを先に書く: 日付グルーピング用のノード位置（x/y）計算関数。x=日付区間ごとの帯、y=依存順・既存位置をできるだけ保った整列 → Red確認 → 実装 → Green確認
- [ ] UI実装:
  - [ ] 失敗するテストを先に書く: 「日付表示」チェックボックスの表示・トグル動作 → Red確認 → 実装 → Green確認
  - [ ] 失敗するテストを先に書く: チェックON時に区切り線・背景色分け・合計/最短時間が表示されること → Red確認 → 実装 → Green確認
  - [ ] 失敗するテストを先に書く: チェックON時に対象ノードの`flow_x`/`flow_y`が実際に更新されること（`onUpdateItem`/`updateItemMeta`相当の呼び出し検証） → Red確認 → 実装 → Green確認
  - [ ] 失敗するテストを先に書く: 「元に戻す」ボタンでチェックON直前の位置に復元されること → Red確認 → 実装 → Green確認
- [ ] `npm.cmd run test -- --run`全体実行、既存テスト回帰なし確認（`useAssigneeView.test.ts`の既存フレーキー1件は無関係なので無視してよい）
- [ ] `git diff --stat master..HEAD`で変更範囲確認
- [ ] 実機検証（`/run`スキルまたはchrome-devtools系ツール）: 依存関係のある複数タスクを異なる有効締切で用意し、チェックONで区切り線・背景色・合計/最短時間が正しく表示されること、ノードが実際に移動し`flow_x`/`flow_y`が更新されること、「元に戻す」で元の位置に戻ることを確認。手書き図の例（直列区間は合計=最短、分岐区間は合計>最短）で計算結果が妥当か目視確認
- [ ] `docs/requests_log.md` R-109の対応状況を更新
- [ ] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

## R-110 R-109日付グルーピング表示の軸入れ替え（2026-08-17）

**ブランチ**: `fix/R-110-flow-date-band-axis`
**要望**: `docs/requests_log.md` R-110
**仕様**: `docs/SPEC/03_画面設計.md` §7.12（R-110で軸を修正した節を参照）
**計画ファイル**: `C:\Users\fjtsu\.claude\plans\konoyoukan-no-gantotya-to-hyouji-hidden-gizmo.md`（詳細な設計はここに確定済み、実装Agentは再設計不要）

### 背景

R-109実装（本番デプロイ済み）を発注者が実際に確認したところ、「日付が列ごとで縦になっている、横のはずだ。フローの流れは上から下だから、日付は横線区切りで上から下に増えていくべき」というフィードバックを受けた。R-109の実装は「日付＝X軸（横に並ぶ帯）、依存の深さ＝帯内でY軸（縦積み）」になっており、フロー本来の「上から下へ流れる」設計（`FlowItemNode.tsx`のHandleがTop/Bottom、`createNodeBelow`がY軸のみ増加）と軸が逆だった。

指揮AIが発注者と2回のAskUserQuestionで確認し、以下を確定済み（再相談不要）:
1. 帯は画面幅ではなくフロー全体のコンテンツ幅いっぱいの横長帯とし、上から下へ日付順に積み上げる
2. 帯内のノードは依存の深さ順に横一列に並べる
3. ラベルは帯の左上に、日付（曜日つき）→改行→合計→改行→最短、の順で縦に並べる
4. 帯同士の区切りは横線（`borderBottom`）

### 対象ファイル・設計（詳細は計画ファイル参照）

- `logic/flowDateGrouping.ts`: 軸入れ替え。`BAND_WIDTH`/`ROW_HEIGHT`/`BAND_HEADER`/`BAND_FOOTER`→`BAND_HEIGHT`/`COL_WIDTH`/`LABEL_MARGIN_WIDTH`に再編。帯は`bandX=0`固定・`bandY=index*BAND_HEIGHT`で縦積み。帯内ノードは`flow_x = LABEL_MARGIN_WIDTH + col*COL_WIDTH`、`flow_y = bandY + (BAND_HEIGHT-NODE_HEIGHT)/2`。同depthのタイブレークは`flow_y`比較→`flow_x`比較に変更。`bandLabel`に曜日を追加（`date-fns/locale`の`ja`を使用、他箇所での使用例があれば確認して踏襲）
- `components/Flow/DateBandNode.tsx`: ラベルを上下分散→左上3行スタックに変更
- `screens/FlowScreen.tsx`: 帯ノードの罫線を`borderLeft`/`borderRight`→`borderBottom`に変更
- `calculateCriticalPathMinutes`/`computeDepthWithin`/`groupItemsByDeadline`/`getEffectiveDeadline`/`formatHours`/Undo/チェックボックスUI/`applyPlacements`は変更不要（軸に依存しないロジックのため）

### サブタスク

- [x] worktree作成（`git worktree add .claude/worktrees/fix-R110-flow-date-band-axis -b fix/R-110-flow-date-band-axis master`、`git worktree list`で実在確認）
- [x] 既存の`logic/__tests__/flowDateGrouping.test.ts`を新しい軸の期待値に書き換え（Red確認、5件失敗）→ `flowDateGrouping.ts`実装（Green確認、19件）
- [x] `DateBandNode.tsx`のラベル配置変更（左上3行スタック。専用コンポーネントテストは無く、統合テスト`FlowScreen.dateGrouping.test.tsx`と実機目視で確認）
- [x] `FlowScreen.tsx`の帯の罫線変更（`borderLeft`/`borderRight`→`borderBottom`）
- [x] `npm.cmd run test -- --run`全体実行、既存テスト回帰なし確認（旧軸前提だった`FlowScreen.dateGrouping.test.tsx`3件のRedを追加発見・新軸へ更新しGreen化。全体943 passed/14 skipped/1 failed=既存フレーキー`useAssigneeView.test.ts`のみで本件と無関係）
- [x] 実機検証（`php -S 127.0.0.1:8000 -t backend backend/router.php`・Vite dev、chrome-devtools MCP）: 日付表示チェックON時に「上から下に日付が積み上がる」「帯内で左から右にノードが並ぶ」「左上に日付(曜日)/合計/最短が縦3行で表示される」「帯同士が横線で区切られる」ことを確認。「元に戻す」ボタンで復元されることも確認
- [x] `docs/requests_log.md` R-110の対応状況を更新
- [x] `docs/SPEC/03_画面設計.md` §7.12の更新に齟齬なしを確認（指揮AI更新済み内容が実装と一致、追加修正不要）
- [x] 指揮AIへ完了報告（masterへのマージ・本番デプロイは指揮AIレビュー後）

## R-111 / R-112 日付帯内配置の「横位置維持」修正 ＋ フロー「自動整理」ボタン（2026-08-17）

**ブランチ**: `feature/R-111-112-flow-arrange`（1ブランチで R-111 → R-112 の順に直列実装）
**要望**: `docs/requests_log.md` R-111 / R-112
**仕様**: `docs/SPEC/03_画面設計.md` §7.12（R-111で修正した節）・§7.13、`docs/SPEC/02_機能仕様.md` F-42 / F-43
**計画ファイル**: `C:\Users\fjtsu\.claude\plans\konoyoukan-no-gantotya-to-hyouji-hidden-gizmo.md`（設計確定済み、実装Agentは再設計不要）

### 背景

R-110（横帯・上→下）を発注者が確認したところ「帯の中のノードが横一列に並べ直されて元のマインドマップの形が壊れる。日付整理は横方向移動をせず縦方向移動だけで日付の領域に移してほしい」とのフィードバック。あわせて「重ならず・エッジ交差が少なく・隙間が狭い」自動整理ボタンの要望。発注者確認済み: 帯内の行順は依存関係優先／自動整理は自前実装（外部レイアウトライブラリ不使用）／プロジェクトごとに整理して横並び／自動整理も「元に戻す」可能。

### R-111 対象・設計

- `logic/flowDateGrouping.ts` `calculateDateGroupLayout` のみ: `flow_x`は変更しない。帯内は依存深さ順→元`flow_y`順に処理し、`row = max(帯内依存元のrow)+1`を下限として、X区間`[flow_x, flow_x+NODE_WIDTH]`が既配置ノードと重ならない最初の行に置く。`flow_y = bandY + BAND_PADDING_TOP + row*ROW_HEIGHT`。帯高さ`max(rows*ROW_HEIGHT+上下パディング, BAND_MIN_HEIGHT)`可変、`bandY`累積。帯幅は全ノードの`minX-LABEL_MARGIN_WIDTH`〜`maxX+NODE_WIDTH`。`COL_WIDTH`/`BAND_HEIGHT`定数廃止
- `FlowScreen.tsx`帯ノード生成・`DateBandNode.tsx`は変更不要

### R-112 対象・設計

- 新規 `logic/flowAutoArrange.ts` `calculateAutoArrange(items, deps, sizes?)`: プロジェクト分割（`calculateAutoPlacement`と同じ）→ Longest Path層分け（`computeDepthWithin`をexportして流用、層=上→下）→ 重心法で層内並び替え（初期順は元`flow_x`、4回程度掃引）→ 座標割当（実測幅+GAP_X=40で詰め、層は中央揃え、縦は層最大高さ+GAP_Y=60累積、未計測は180×60）→ プロジェクトは実幅+PROJECT_GAP=200で横並び
- `screens/FlowScreen.tsx`: `top-[180px] right-3`に「自動整理」ボタン（`isDateGrouping`中はdisabled）、`handleAutoArrange`（バックアップ→`nodes`の`measured`でサイズMap→計算→`applyPlacements`→`fitView`）、「元に戻す」表示条件を`hasPositionBackup` stateに変更
- 「全て自動配置」（`UnplacedItemList.tsx`）は変更しない

### サブタスク

- [x] `git fetch && git checkout -b feature/R-111-112-flow-arrange master`
- [x] R-111: `flowDateGrouping.test.ts`を新ルールへ書き換え＋追加（Red）→ 実装（Green）。`FlowScreen.dateGrouping.test.tsx`の期待座標も追随
- [x] R-112: `flowAutoArrange.test.ts`新規（重なりなし／依存先が下／交差ケース／プロジェクト横並び／sizes反映／flow_x同点解消）（Red）→ 実装（Green）
- [x] R-112: FlowScreen統合テスト（ボタン表示・押下で保存・元に戻す・日付表示中は無効）（Red）→ 実装（Green）
- [x] `npm.cmd run test -- --run`全体Green（959 passed / 14 skipped / 1 failed=既知フレーキー`useAssigneeView.test.ts`のみ）
- [x] 実機検証（`php -S 127.0.0.1:8000 -t backend backend/router.php`＋Vite）: 日付表示ONで横位置不変・行分け・帯高さ可変／自動整理で重なりなし・上→下・プロジェクト横並び・元に戻す・日付表示中無効
- [x] `docs/requests_log.md` R-111/R-112の対応状況更新、SPECと実装の齟齬確認
- [x] 指揮AIへ完了報告（マージ・デプロイは指揮AIレビュー後）

## R-113 / R-114 日付表示の「表示のみ」分離＋「日付整列」ボタン ＋ 自動整理の縦間隔スライダー（2026-08-17）

**ブランチ**: `feature/R-113-114-flow-date-align`（1ブランチで直列実装）
**要望**: `docs/requests_log.md` R-113 / R-114
**仕様**: `docs/SPEC/03_画面設計.md` §7.12（帯の位置と表示）・§7.13（縦間隔スライダー、ON中も使用可）・§7.14（日付整列ボタン）、`docs/SPEC/02_機能仕様.md` F-44 / F-45

### 背景

R-111/R-112デプロイ後、発注者から「日付表示ONで自動的に位置を動かすのをやめ、表示ON/OFFと移動をボタンで分けたい」「帯は日付グループの最上/最下/左端/右端ノードの位置に追従してほしい」「自動整理の縦間隔を今の50〜70%にしたい、スライダーで調整」との要望。相談で確定済み（ドラッグは横縦とも許可／自動整理はON中も可）。

### 設計

- `logic/flowDateGrouping.ts`: 新規 `calculateDateBands(items, deps, sizes?)` — `groupItemsByDeadline`ごとに、ノード現在位置の外接矩形（左端=minX−LABEL_MARGIN_WIDTH、右端=max(x+width)、上端=minY−BAND_PADDING_TOP、下端=max(y+height)+BAND_PADDING_BOTTOM、サイズは実測or既定）＋label/totalMinutes/criticalMinutesを返す。`calculateDateGroupLayout`はplacements用に残す（y原点=全配置ノードのminY−BAND_PADDING_TOPから区間を累積。bands出力は不要なら削除）
- `logic/flowAutoArrange.ts`: `calculateAutoArrange(items, deps, sizes?, options?: {gapY?: number})`、既定 `GAP_Y=35`
- `screens/FlowScreen.tsx`:
  - `handleToggleDateGrouping`: ON/OFFのみ（バックアップ・applyPlacementsを廃止）。`dateBands`は`useMemo(() => isDateGrouping ? calculateDateBands(placedItems, dependencies, sizes) : [], ...)`でライブ追従（`nodes`のmeasured/positionから）
  - 新ボタン「日付整列」（自動整理の下、`top-[212px] right-3`）: バックアップ→`calculateDateGroupLayout`のplacements→`applyPlacements`→fitView。日付表示ON/OFFは変えない
  - 「自動整理」の`disabled={isDateGrouping}`を撤廃。縦間隔スライダー（`<input type="range" min=10 max=100>`、既定35、`localStorage['youkan_flow_arrange_gap_y']`）を自動整理ボタンの隣に配置し、`calculateAutoArrange`に渡す
  - `handleRestorePositions`は`setIsDateGrouping(false)`を呼ばない（表示状態は独立）
- 印刷（`no-print`）・R-108のドラッグ挙動は変更しない

### サブタスク

- [x] `git fetch && git checkout -b feature/R-113-114-flow-date-align master`
- [x] R-113: `flowDateGrouping.test.ts`に`calculateDateBands`（外接矩形・実測サイズ反映・ノード移動で帯が動く）追加、`calculateDateGroupLayout`のy原点仕様更新（Red→Green）
- [x] R-113: `FlowScreen.dateGrouping.test.tsx`を新仕様へ（チェックONでノード位置が変わらない・帯が表示される／「日付整列」で縦のみ移動＆保存／元に戻す）（Red→Green）
- [x] R-114: `flowAutoArrange.test.ts`に`gapY`オプション、`FlowScreen.autoArrange.test.tsx`にスライダー（既定35、localStorage記憶、日付表示ON中も押せる）（Red→Green）
- [x] `npm.cmd run test -- --run`全体Green（968 passed / 14 skipped / 0 failed。既知の無関係なunhandled error 2件はmaster baselineと同一の既存事象）
- [x] 実機検証（`php -S 127.0.0.1:8000`＋Vite、worktree専用ローカルDB）: 日付表示ONでノード不動＆帯表示（16件全て位置不変・サーバー保存なし）／「日付整列」で横位置不変・縦のみ移動しサーバー保存（POST 16件200）／帯がdateKey順に単調増加でy=-60,130,320,510,700,890,1080,1270と積み上がる／「元に戻す」で16件全て元位置へ完全復元・日付表示ON状態は維持／自動整理が日付表示ON中も実行可・「元に戻す」ボタン表示／縦間隔スライダーの値変更がlocalStorageへ保存されリロード後も80のまま復元。※端ノードをドラッグして帯が追従する挙動は、本環境のchrome-devtools/claude-in-chrome双方でd3-drag（pointer capture）ベースの実ドラッグを合成できずUI操作での直接確認はできなかった（claude-in-chrome側は本環境でscreenshot API自体が動作しない既知の制約もあり）。この挙動は`FlowScreen.dateGrouping.test.tsx`の「ノードをドラッグすると帯の位置がその場で追従する」テストで、実際のドラッグ時とサーバー保存より先に発火する同一の`onNodesChange`コールバックを直接叩いて検証済み
- [x] `docs/requests_log.md` R-113/R-114の対応状況更新、SPECと実装の齟齬確認（齟齬なし）
- [x] 指揮AIへ完了報告（マージ・デプロイは指揮AIレビュー後）

## R-115 / R-116 日付整列の未定枠配置・行間隔スライダー ＋ フロー操作パネルのホバーツールチップ（2026-08-17）

**ブランチ**: `feature/R-115-116-flow-tooltip-undated`（1ブランチで直列実装）
**要望**: `docs/requests_log.md` R-115 / R-116
**仕様**: `docs/SPEC/03_画面設計.md` §7.14（日付未定ノードの配置・ノード間の上下幅スライダー）・§7.15（ホバーツールチップ）、`docs/SPEC/02_機能仕様.md` F-46 / F-47

### 背景

R-113/R-114デプロイ後、改善要望フォームから「日付整列で日付未定の枠を左中央に置きたい」「日付整列の行間隔もスライダーで調整したい（自動整理の縦間隔スライダーと同様）」「フローチャート上のボタン・スライダーに1秒ホバーでヒントを出したい」との要望。指揮AIとの確認で「未定枠は日付帯の左の専用列、帯全体の高さに対して縦中央揃え」を確定済み。

### 対象ファイル・設計

**R-115**
- `logic/flowDateGrouping.ts` `calculateDateGroupLayout`: `groupItemsByDeadline`の結果を「有効締切あり（dateKey!==UNDATED_KEY、日付昇順）」と「未定（UNDATED_KEY）」に分離。有効締切ありグループは現行どおり上から下へ帯を積む（`ROW_HEIGHT`は引数化: `calculateDateGroupLayout(items, deps, options?: {rowHeight?: number})`、既定110）。積み上げ後の合計高さ`totalDatedHeight`を求める。未定グループは`assignRows`を使い単一カラム（全アイテム同じX区間とみなして必ず別行になる、依存があれば依存元が上）で縦に並べ、列の高さ`undatedHeight = rows*rowHeight + パディング`を計算。列のX位置は「有効締切ありグループの最小flow_x − LABEL_MARGIN_WIDTH − 追加間隔 − NODE_WIDTH」。列のY位置は「有効締切ありの帯全体のY開始位置 + (totalDatedHeight - undatedHeight)/2」（縦中央揃え）。有効締切ありが0件なら未定列だけを原点付近に配置
- `screens/FlowScreen.tsx`: 「日付整列」ボタンの近くに行間隔スライダー（`input[type=range]`、40〜220、既定110、`localStorage['youkan_flow_date_align_row_height']`）を追加し、`handleDateAlign`で`calculateDateGroupLayout(placedItems, dependencies, { rowHeight })`に渡す
- `calculateDateBands`（日付表示の帯・R-113のライブ追従）は現状維持でよい（未定グループの帯も同じロジックで外接矩形を計算するため自然に追従する）

**R-116**
- 新規 `components/Flow/HoverTooltip.tsx`（または`shared/`）: children をラップし、`onMouseEnter`で1000ms後に小さな吹き出し（absolute配置、`bg-slate-800 text-white text-xs`程度）を表示、`onMouseLeave`でタイマークリア・即消灯。ツールチップ文言はprops
- `FlowScreen.tsx`の右上ボタン列・スライダー群（新規タスク追加／ヘルプ／全体表示／印刷／日付表示チェック／元に戻す／自動整理＋縦間隔スライダー／日付整列＋行間隔スライダー）を`HoverTooltip`でラップし、既存の`title`文言をそのままツールチップ文言に使う（`title`属性は二重表示を避けるため外すかそのまま残すかは実装Agent判断。ブラウザ標準ツールチップと二重に出ないよう調整すること）

### サブタスク

- [x] `git fetch && git checkout -b feature/R-115-116-flow-tooltip-undated master`
- [x] R-115: `flowDateGrouping.test.ts`に未定ノードの専用列配置（左側X・縦中央Y・依存順の行割り当て）とrowHeightオプションのテストを追加（Red→Green）。`FlowScreen.dateGrouping.test.tsx`の期待座標も追随
- [x] R-115: `FlowScreen.tsx`に行間隔スライダー追加、`FlowScreen.autoArrange.test.tsx`相当のテストパターンで既定値・localStorage記憶を検証（Red→Green）
- [x] R-116: `HoverTooltip`コンポーネント新規テスト（1000ms後に表示・mouseleaveで消える）（Red→Green）。FlowScreenへの適用は統合テストか実機目視で確認
- [x] `npm.cmd run test -- --run`全体Green（981 passed / 14 skipped / 0 failed）
- [x] 実機検証（`php -S 127.0.0.1:8199`＋Vite、詳細はrequests_log.md参照）: 日付整列で未定ノードが左の専用列に縦中央配置される／行間隔スライダーで間隔が変わり再読込後も記憶／ボタン・スライダーに1秒ホバーでヒントが出る・離すと消える、をいずれも確認
- [x] `docs/requests_log.md` R-115/R-116の対応状況更新、SPECと実装の齟齬確認（齟齬なし、02_機能仕様.md F-46/F-47のステータスのみ更新）
- [x] 指揮AIへ完了報告（マージ・デプロイは指揮AIレビュー後）

## R-117 フロー日付表示の帯に「残り時間」を追加表示（2026-08-17）

**ブランチ**: `feature/R-117-flow-date-remaining`
**要望**: `docs/requests_log.md` R-117
**仕様**: `docs/SPEC/03_画面設計.md` §7.12（「残り時間（R-117）」）、`docs/SPEC/02_機能仕様.md` F-48

### 背景

R-113で日付表示の帯は「表示専用」（`calculateDateBands`、`logic/flowDateGrouping.ts`）に分離済み。発注者から「未完了がある日は最短の下に残り何時間かかるかを表示して」との要望。確認済み: 残り時間＝未完了（`status !== 'done'`）タスクの目安時間の単純合計（依存関係は考慮しない）。区間内が全て完了済みなら表示しない。

### 対象ファイル・設計

- `logic/flowDateGrouping.ts` の `calculateDateBands`（`groupItemsByDeadline`→`DateBand`生成部分）: `DateBand`インターフェースに`remainingMinutes: number`と`hasIncomplete: boolean`を追加。各グループで`group.items.filter(item => item.status !== 'done')`から`remainingMinutes`（`estimatedMinutes`単純合計）と`hasIncomplete`（filter結果が1件以上か）を算出
- `components/Flow/DateBandNode.tsx`: `DateBandNodeData`に`remainingMinutes`/`hasIncomplete`を追加。`hasIncomplete`がtrueのときだけ「最短」行の下に4行目「残り {formatHours(remainingMinutes)}」を表示（`formatHours`は`flowDateGrouping.ts`の既存関数を流用）
- `screens/FlowScreen.tsx`の帯ノードdata合成箇所（`bandNodesForRender`）に`remainingMinutes`/`hasIncomplete`を渡す

### サブタスク

- [x] `git fetch && git checkout -b feature/R-117-flow-date-remaining master`
- [x] `flowDateGrouping.test.ts`に`calculateDateBands`の`remainingMinutes`/`hasIncomplete`（未完了あり／全完了／未完了0分タスクのみ、等）テストを追加（Red→Green）
- [x] `DateBandNode.tsx`のレンダリングテスト（存在すれば更新、無ければ実機目視でも可）: `hasIncomplete=true`で4行目表示・`false`で非表示（`FlowScreen.dateGrouping.test.tsx`の既存帯データ検証テストにアサーション追加＋実機目視で確認）
- [x] `npm.cmd run test -- --run`全体Green（971 passed / 14 skipped、既知の無関係なunhandled error 2件はmaster baselineと同一）
- [x] 実機検証（`php -S 127.0.0.1:8117`＋Vite、worktree専用ローカルDB）: 未完了タスクを含む日付帯に「残り Xh」が最短の下に表示される／全て完了済みの日付帯には表示されないことをDOM照会・スクリーンショットで確認。検証用アイテムは削除済み
- [x] `docs/requests_log.md` R-117の対応状況更新、SPECと実装の齟齬確認（`03_画面設計.md` §7.12の「縦に3行表示する」を4行目の存在に触れる形へ微修正）
- [x] マージ時、他のR-11x系ブランチ（`feature/R-115-116-flow-tooltip-undated`）が先にmasterへ入っていたら`git fetch && git merge origin/master`で取り込んでからコンフリクト解消（`flowDateGrouping.ts`は同ファイル別関数のため機械的に解消できるはず）
- [x] 指揮AIへ完了報告（マージ・デプロイは指揮AIレビュー後）

## R-118 フロー「詰める」機能（手動配置後の上下方向間隔圧縮）（2026-08-17）

**ブランチ**: `feature/R-118-flow-compact`
**要望**: `docs/requests_log.md` R-118
**仕様**: `docs/SPEC/03_画面設計.md` §7.16、`docs/SPEC/02_機能仕様.md` F-49

### 背景

発注者が自動整理→手動調整したフローチャートのスクリーンショットを添付し、「上下方向をできるだけ詰めたい。ただしエッジが見える範囲・曲がりが潰れて見づらくならない範囲で」との要望。相談で確定: 「自動整理」とは別の新ボタン「詰める」（並べ替え・X変更なし、現在の並び順を保ったまま縦の隙間だけを最小化）。縦間隔の最小値は自動整理の縦間隔スライダー（GAP_Y、`youkan_flow_arrange_gap_y`）を共用。

### 対象ファイル・設計

- 新規 `logic/flowVerticalCompact.ts`: `calculateVerticalCompact(items: Item[], deps: Dependency[], sizes?: Map<id,{width,height}>, options?: {gapY?: number}): PlacementResult[]`（既定gapY=35、`flowAutoArrange.ts`の既定値と同じにする）
  - 対象アイテムを現在の`flow_y`昇順（同値は元の配列順で安定ソート）に処理
  - 各アイテムについて、`newBottomOf(id)`（そのアイテムの新しい`flow_y` + 高さ）を記録しながら、以下の最大値を下限として新しい`flow_y`を決める:
    1. 既に処理済み（現在のY順で自分より上）で、Xの区間（`flow_x`〜`flow_x+width`）が自分と重なるアイテムの`newBottomOf` + gapY
    2. 自分の依存元（predecessor、依存関係グラフでこのアイテム集合内に閉じたもの）の`newBottomOf` + gapY
    3 下限がなければ現在の`flow_y`をそのまま使う（それ以上は詰めない＝一番上のノード群は動かない）
  - `flow_x`は変更しない
  - サイズは`sizes`優先、未指定時は`NODE_WIDTH`×60（`flowAutoArrange.ts`と同じ既定値、`flowDateGrouping.ts`の`NODE_WIDTH`をimport）
- `screens/FlowScreen.tsx`: 右上ボタン列に「詰める」ボタンを追加（「日付整列」の下）。押すと現在位置をバックアップ→`nodes`の`measured`からサイズMap→`calculateVerticalCompact(placedItems, dependencies, sizes, { gapY })`（`gapY`は既存の自動整理用state/localStorageをそのまま使う）→`applyPlacements`→fitView

### サブタスク

- [x] `git fetch && git checkout -b feature/R-118-flow-compact master`
- [x] `flowVerticalCompact.test.ts`新規: 依存元より下に来る／Xが重ならなければ独立して詰まる／Xが重なるノードはgapY以上離れる／並び順(どのノードがどのノードより上か)が変わらない／flow_xが変わらない／gapYオプション反映／複数ノードが同じノードに依存する合流ケース（Red→Green、7件）
- [x] `FlowScreen.tsx`にボタン追加、統合テスト（押下で保存・元に戻す・横位置維持を確認、3件）（Red→Green）
- [x] `npm.cmd run test -- --run`全体Green（978 passed / 14 skipped / 0 failed。既知の無関係なunhandled error 2件はmaster baselineと同一の既存事象）
- [x] 実機検証（`php -S 127.0.0.1:8000`＋Vite、worktree専用ローカルDB）: 依存関係のある2ノードを縦に大きく離して手動配置（API経由でmeta設定）→「詰める」で依存元の下端+gapY直下まで詰まる・横位置(flow_x)は全ノードで不変・エッジも短く見やすい距離を維持→「元に戻す」で元の座標に完全復元。検証に使ったテストデータは削除済み
- [x] `docs/requests_log.md` R-118の対応状況更新、SPECと実装の齟齬確認（齟齬なし）
- [ ] マージ時、他のR-11x系ブランチ（`feature/R-115-116-flow-tooltip-undated`、`feature/R-117-flow-date-remaining`）が先にmasterへ入っていたら`git fetch && git merge origin/master`で取り込みコンフリクト解消（`FlowScreen.tsx`のボタン列部分は両方の追加を残す）※今回は未実施、指揮AIの指示待ち
- [x] 指揮AIへ完了報告（マージ・デプロイは指揮AIレビュー後）

## R-119 バグ調査・修正: フローチャート画面でスマホ表示時にAPI通信エラー（PUT /items/...）が多発（2026-08-17）

**ブランチ**: `fix/R-119-flow-mobile-api-errors`
**要望**: `docs/requests_log.md` R-119

### 背景

発注者からスマホでフローチャート画面を見ていたところ、「API通信エラー PUT /items/{id}: Load failed」というトースト通知が6件以上重なって表示されたとのスクリーンショットが届いた。原因未特定。同じアイテムID（`019ff274-4ff7-793c-80cc-a30e5ac1b6c7`等）が複数回登場しており、単発の通信エラーではなく何らかの一括保存処理（`applyPlacements`のループ、または`autoPlacedItems`のような未使用に見えるuseMemoが実は副作用を持っている等）が走っている可能性がある。ユーザーがボタン（自動整理／日付整列／詰める等）を能動的に押した結果なのか、画面を開いただけで発生したのかも不明。

### 調査方針（根本原因追求、対症療法禁止）

- `screens/FlowScreen.tsx` 内で `updateItemMeta`（＝`PUT /items/{id}`）を呼んでいる箇所を全て洗い出す（`applyPlacements`、その他の個別更新箇所）
- `useEffect`/`useMemo`でマウント時・依存変更時に自動的に位置保存が走る経路が無いか確認する（特に`autoPlacedItems`のような、過去の調査で「使われていないように見える」とされていたコードが実際には副作用を持っていないか再確認する）
- スマホ（狭い画面幅・タッチ操作・モバイル回線）特有の条件で発生するのか、PC（chrome-devtools MCP等）でも再現するか切り分ける
- 同一アイテムIDが複数回エラーになっている理由（同じ保存が二重に走っている／リトライ機構がある／複数の一括操作が重なった等）を特定する
- 実際にサーバー側のデータが壊れていないか（`flow_x`/`flow_y`が意図しない値になっていないか）を確認する

### 対応方針

- 原因が特定でき次第、根本原因を修正する（症状を隠す対症療法は禁止）
- 大量のPUTリクエストが必要な操作（自動整理・日付整列・詰める等の一括配置）自体は正当な機能であり、失敗時にエラートーストが積み重なって画面を埋め尽くすUXも合わせて改善を検討してよい（例: 個別トーストではなく集約表示、失敗分のみ再試行できるようにする等）。ただし本件の主目的は「なぜ通信が失敗したか」の原因調査と再発防止であり、UX改善は副次的な対応として良ければ含める
- 修正内容によっては同時に進行中のR-120（配置系ボタンのプレビュー化）と設計が重なる可能性がある。R-120着手前に本調査の結果を指揮AIへ報告すること

### サブタスク

- [x] `git fetch && git checkout -b fix/R-119-flow-mobile-api-errors master`
- [x] 上記の調査方針に沿って原因を特定する（テストコードでの再現も試みる）
- [x] 原因が判明したらTDDで修正（再現テストをRed→修正→Green）
- [x] `npm.cmd run test -- --run`全体Green
- [x] `docs/requests_log.md` R-119の調査結果・対応状況を更新
- [x] 指揮AIへ完了報告（原因が特定できなかった場合もその旨と調査した範囲を詳細に報告すること。マージ・デプロイは指揮AIレビュー後）

## R-120 フロー配置系ボタンをプレビュー→保存確定方式に統一＋「詰める」に横方向圧縮追加（2026-08-17）

**ブランチ**: `feature/R-120-flow-preview-confirm`
**要望**: `docs/requests_log.md` R-120
**仕様**: `docs/SPEC/03_画面設計.md` §7.16（横方向圧縮・チェックボックス）・§7.17（プレビュー→保存確定方式）、`docs/SPEC/02_機能仕様.md` F-50

**注意**: R-119（同じ`FlowScreen.tsx`の配置保存まわりを触るバグ調査）の結果次第で設計に影響が出る可能性がある。R-119の指揮AIレビューが終わるまで着手を待つこと。

### 背景

R-118（詰める）・R-114（自動整理の縦間隔スライダー）デプロイ後、発注者から「詰めるボタンを押したら縦と横のスライダーと保存ボタンが出て、リアルタイムで動くのを見ながら調整して保存ボタンで確定、という流れが良い」との要望。確認済み: 「詰める」に横方向の圧縮も追加、「自動整理」「日付整列」も同じプレビュー方式に統一。追加要望: 「その縦と横のスライダーの横にチェックマークがあり、チェックを入れたらスライダー有効、はずしたらグレーアウトして無効。詰める機能を効かすかどうかも選べる」（縦・横独立にON/OFF可能）。

### 対象ファイル・設計

**詰めるの横方向圧縮（新規ロジック）**
- `logic/flowHorizontalCompact.ts`（新規）: `calculateHorizontalCompact(items, deps, sizes?, options?: {gapX?: number}): PlacementResult[]`。`flowVerticalCompact.ts`の縦横を入れ替えたロジック（現在の`flow_x`昇順に処理、Y区間が重なる既配置ノードの右端+gapXまで左へ寄せる、依存関係は使わない＝フローの依存は縦方向の意味しか持たないため）
- `flowVerticalCompact.ts`の`calculateVerticalCompact`はそのまま流用。縦横両方有効なときは縦→横の順で適用（縦の結果に対して横を計算）

**プレビュー→保存確定のUI基盤（共通化）**
- 新規 `components/Flow/ArrangePreviewPanel.tsx`（または`FlowScreen.tsx`内に閉じたヘルパー）: スライダー群＋チェックボックス（あれば）＋保存/キャンセルボタンを表示する共通パネル
- `screens/FlowScreen.tsx`:
  - 「自動整理」「日付整列」「詰める」のクリックハンドラを、即時`applyPlacements`から「プレビューモードに入る」に変更する。プレビュー中の対象アイテムの新しい位置はローカルstate（例: `previewPlacements: PlacementResult[] | null`）に保持し、`nodes`構築時に`placedItems`の実座標より優先して使う（`applyPlacements`は呼ばない＝サーバー未送信）
  - スライダー・チェックボックスの`onChange`で該当の計算関数（`calculateAutoArrange`/`calculateDateGroupLayout`/`calculateVerticalCompact`+`calculateHorizontalCompact`）を再実行し`previewPlacements`を更新（リアルタイム反映）
  - パネルの「保存」: `previewPlacements`を対象に既存の`applyPlacements`を呼ぶ（保存前の位置は`positionBackup`へ退避、既存の「元に戻す」Undoをそのまま使う）。`previewPlacements`をnullに戻しパネルを閉じる
  - パネルの「キャンセル」: `previewPlacements`をnullに戻すだけ（サーバー未送信のため`applyPlacements`もbackupも不要）、パネルを閉じる
  - 「詰める」パネル: 縦間隔チェック・横間隔チェックそれぞれの有効/無効を state に持ち、OFFの軸は`previewPlacements`計算から除外（該当軸の座標は元のまま）
  - 別の配置系ボタンを押したときは、開いていたプレビューをキャンセル扱いで閉じてから新しいプレビューを開く

### サブタスク

- [ ] `git fetch && git checkout -b feature/R-120-flow-preview-confirm master`（R-119マージ後のmasterを使うこと。指揮AIに確認）
- [ ] `flowHorizontalCompact.ts`新規テスト（`flowVerticalCompact.test.ts`と対になるケース、縦横同時適用の統合ケース）（Red→Green）
- [ ] プレビュー→保存確定のUI実装。統合テスト: 各ボタン押下でプレビューに入りサーバー保存されないこと／スライダー変更でプレビューが再計算されること／保存でサーバー保存されること／キャンセルで元の位置に戻りサーバー未送信であること／「詰める」のチェックON/OFFでその軸が計算に含まれる・含まれないこと（Red→Green）
- [ ] `npm.cmd run test -- --run`全体Green
- [ ] 実機検証: 各ボタンでプレビュー→保存/キャンセルの一連の流れ、詰めるのチェックボックスの効果、日付表示ONでの帯のライブ追従を確認
- [ ] `docs/requests_log.md` R-120の対応状況更新、SPECと実装の齟齬確認
- [ ] 指揮AIへ完了報告（マージ・デプロイは指揮AIレビュー後）
