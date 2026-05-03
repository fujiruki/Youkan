# Youkan — R-028 実装タスク

**ブランチ**: `feature/R-028-someday`
**会議録**: `secretary/notes/2026-05-04-会議-いつかやる状態の追加.md`
**目的**: 「いつかやる」（someday）状態を追加（MVVM・キャパシティ除外・差別化UI）

## 絶対ルール
- **指揮AIはコード直接編集しない**。全実装はAgent委譲、`model="sonnet"`
- **仕様書更新はコード変更より先**（Phase 3 → Phase 4）
- **ステップ単位で1コミット**。跨ぎ禁止
- **直列実行**: Spec → Backend → Frontend → 統合確認

## 採用条件（必須要件）
1. 文言・色・アイコンの厳密差別化（pendingとsomedayが見た目で即区別可能）
2. キャパシティ計算からの除外（QuantityEngine で `someday` を集計対象外に）
3. ガント・カレンダーでの非表示（期限なきものは時間軸に出さない）
4. 付随機能は別task（自動アーカイブ・リマインダー等は本plan外）
5. 既存遺物 `judgmentStatus.someday` を整理しメインstatusに統合

## 除外対象（触らない）
- `docs/99_Archive/` 配下
- 自動アーカイブ・リマインダー機能（別task）
- マネタイズ／プレミアム化議論

---

## ステップ 1: 仕様書更新 [Agent-Spec]

- [ ] `docs/requests.md` に R-028 追加 → `docs/request_log.md` へ移記（2026-05-04）
- [ ] `docs/SPEC/02_機能仕様.md` F-02 ステータス管理に `'someday'` 追記、状態遷移ルール記述
- [ ] `docs/SPEC/03_画面設計.md` パノラマ6バケット構成・全体一覧フィルター追加・ガント/カレンダー除外を明記
- [ ] `docs/SPEC/05_技術設計.md` JudgmentStatus 型拡張、QuantityEngine除外、差別化UI記述
- [ ] `docs/SPEC/06_変更履歴.md` R-028 エントリ
- [ ] **コード不可触**

## ステップ 2: バックエンド実装 [Agent-Backend]

- [ ] `backend/ItemController.php` の status 受入リストに `'someday'` 追加（バリデーション）
- [ ] `getMyItems` / `getProjectItems` 等で someday を扱う条件確認
- [ ] キャパシティ計算（PHP側）から someday 除外（該当箇所があれば）
- [ ] テスト追加: `backend/tests/test_someday_status.php`
  - someday への遷移 (POST/PUT)
  - someday アイテムは getMyItems の通常表示で出る/出ない確認
  - キャパシティ計算除外確認

## ステップ 3: フロント実装 [Agent-Frontend]

### 3-A. 型定義
- [ ] `JWCADTategu.Web/src/features/core/youkan/types.ts`:
  - `JudgmentStatus` に `'someday'` 追加（6値に）
  - 既存遺物 `judgmentStatus?: ...someday...` を整理（メインstatusに統合）
- [ ] `dueStatus?: 'someday'` は別軸として残す（本plan外）

### 3-B. UI差別化
- [ ] アイコン: 💭（または `Cloud` lucide icon）
- [ ] カラー: `purple-400/50`（pendingのamberや、focus blue/indigo と区別できる色）
- [ ] ラベル文言: 「いつかやる（自分で寝かせる）」
- [ ] pendingのラベル: 「保留（外的要因待ち）」（既存ラベルとの整合確認）

### 3-C. ViewModel
- [ ] `useYoukanViewModel.ts` に someday 状態のフィルター/集計を追加
- [ ] `gdbSomedayRaw` のような新state（または既存 raw を共用）
- [ ] 状態遷移ヘルパー（`moveToSomeday(id)` 等、既存パターンに合わせて）

### 3-D. UI実装
- [ ] パノラマ（PanoramaBoard）に Someday バケット追加（PendingとLogの間）
- [ ] 全体一覧（OverviewBoard）に「Someday含む」フィルタースイッチ（デフォルト除く）
- [ ] ガント・カレンダーで someday を非表示（フィルター/除外）
- [ ] 詳細モーダル（DecisionDetailModal）の状態切替ボタン群に「💭 いつかやる」追加
- [ ] QuickInput はデフォルト Inbox（変更なし）

### 3-E. キャパシティ除外
- [ ] `QuantityEngine.ts` で someday を集計対象外
- [ ] テストケース追加

### 3-F. テスト
- [ ] `useYoukanViewModel.someday.test.tsx` 新規（vitest）
- [ ] パノラマバケット表示テスト
- [ ] 状態遷移テスト

## ステップ 4: マージ＆デプロイ [指揮AI]

- [ ] ローカル動作確認（パノラマ・全体一覧・詳細モーダル・状態遷移）
- [ ] master へマージ
- [ ] `upload.ps1` でデプロイ
- [ ] 本番動作確認

## メンテナンス則（恒久ルール）
- 状態を6から7以上に増やさない（短期記憶限界）
- pending と someday の差別化UIを維持
- キャパシティ除外ルールを維持
- ガント・カレンダーでの someday非表示を維持
