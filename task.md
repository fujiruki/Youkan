# Youkan — R-030 実装タスク

**ブランチ**: `feature/R-030-hierarchy-types`
**Plan**: `C:\Users\fjtsu\.claude\plans\elegant-whistling-unicorn.md`
**目的**: virtual-header- 概念を完全撤廃。HierarchicalWrapper を discriminated union 化して MVVM/型安全/メンテナンス性を確立

## 絶対ルール
- 指揮AIはコード直接編集しない、Agent委譲、`model="sonnet"`
- TDD: テスト先行 → Red → 実装 → Green
- 仕様書先行 → コード実装
- ステップ単位で1コミット

## ステップ

### ステップ1: 仕様書更新 [Agent-Spec]
- `docs/requests.md` → `docs/request_log.md` に R-030 移記（2026-05-05）
- `docs/SPEC/05_技術設計.md` に「階層ラッパー型分離方針」追記
  - HierarchicalWrapper は discriminated union ('item' / 'header')
  - ヘッダーは `item: Item` を持たず、`projectId` / `projectTitle` / `project` のみ
  - virtual-header- プレフィックス禁止
  - React key には `wrapper.id` を使う
- `docs/SPEC/06_変更履歴.md` に R-030 エントリ
- コードは触らない

### ステップ2: TDDテスト整備 [Agent-Test]
- `JWCADTategu.Web/src/features/core/youkan/logic/__tests__/hierarchy.types.test.ts` 新規（Red状態）
  - ヘッダーWrapperには `item` プロパティが存在しないこと（型ガード後アクセス不可）
  - アイテムWrapperには `item.id` が実IDのまま（virtual-header- 含まれない）
  - depth・project 関連の挙動固定
- 既存 `hierarchy.test.ts` のあれば、ガードテスト（プロジェクト数・順序・depth）を補強

### ステップ3: 型変更＋実装 [Agent-Refactor]

#### 3-A. Model層（hierarchy.ts）
- `HierarchicalWrapper` 型を discriminated union に変更
- `buildHierarchicalList` のヘッダー push を新型へ（virtual-header- 文字列削除）
- `result.filter(w => w.type === 'item').map(w => w.item)` の型ガード調整

#### 3-B. View 層（4ファイル）
- `OverviewBoard.tsx`: ローカル `stripId` 削除、`wrapper.type === 'header'` 分岐に
- `OverviewItem.tsx`: ヘッダー型なら `wrapper.projectId` / `projectTitle` を直接使用 → **`onNavigateToFlow` のフロー画面伝搬バグ自動解消**
- `BucketColumn.tsx`: 型ガード分岐
- `RyokanGanttView.tsx`: 型ガード分岐

#### 3-C. ViewModel 層
- `useOverviewItems.ts`: 型再exportまたは型推論で吸収

#### 3-D. 散在コード削除
- `useYoukanViewModel.ts` の8箇所 `.replace('virtual-header-', '')` 削除
- `useSubtasks.ts` の2箇所同上削除

### ステップ4: マージ＆デプロイ [指揮AI]
- master へマージ
- `upload.ps1` でデプロイ
- grep 検証: `rg "virtual-header" src/` 0件
- 本番動作確認

## 除外対象
- `docs/99_Archive/` 配下
- `App.tsx`/`FlowScreen.tsx` の多層防御（不要）
- 共通ヘルパー `idUtils.ts` 新設（不要）

## メンテナンス則（恒久）
- 階層ラッパー型は discriminated union（type プロパティで分岐）
- ヘッダー型は `item: Item` を持たない
- React key には `wrapper.id` を使う（`wrapper.item.id` 経由禁止）
- 階層UI拡張時は新variantを追加（`'tenant_header'` など）
- item.id を加工して別の意味を持たせるパターンを禁止
- レイヤー境界（API・URL・ナビゲーション）の ID は常に実ID
