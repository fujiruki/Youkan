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
