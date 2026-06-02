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
- [ ] `DecisionDetailModal.tsx` のタイトル表示/編集の分岐ロジックを確認
- [ ] 失敗テストを書く（タイトル空文字でモーダル開く → 編集欄が見える / 文字入力 → 保存できる）
- [ ] テスト失敗確認・コミット
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
