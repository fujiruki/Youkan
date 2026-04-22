# Youkan — refactor/naming-unification 実装タスク

**Branch**: `refactor/naming-unification`
**Plan**: `C:\Users\fjtsu\.claude\plans\elegant-whistling-unicorn.md`

## 絶対ルール

- **指揮AIはコード直接編集しない**。全実装はAgent委譲。
- **Agent起動時は model="sonnet" を指定**（指揮AIは opus 継続）。
- **仕様書更新はコード変更より先**（Phase 3 → Phase 4）。
- **ステップ跨ぎのコミット混在禁止**。ステップ単位で1コミット。
- **ステップ間は直列実行**。並行起動はステップ0の Spec+Test のみ。

## 除外対象（Agent誤動作防止）

以下のファイル・変数名は**触らない**:
- `src/features/core/youkan/viewmodels/` 配下の `gdb*` 変数名（`gdbActive`, `gdbIntent`, `gdbPreparation`, `gdbLog`, `refreshGdb`, `ghostGdbCount` 等）
- `src/features/core/youkan/repositories/` 配下の内部識別子
- `src/features/core/youkan/types.ts` の既存型
- `docs/99_Archive/` 配下全て
- `backend/GdbController.php`（GDB用語整理は別タスク扱い）

---

## ステップ 0: 仕様書更新＋インテグレーションテスト整備

### 0-A. 仕様書更新 [Agent-Spec]
- [ ] `docs/requests.md` に本リファクタ要望を追加 → `docs/request_log.md` に R-番号（最新＋1）付与で移記
- [ ] `docs/SPEC/03_画面設計.md` にコンポーネント命名規約セクション新設
  - 状況把握画面: `PanoramaBoard`
  - 全体一覧画面: `OverviewBoard`
  - 内部 viewMode 型: `'stream' | 'panorama' | 'overview' | 'calendar'`
- [ ] `docs/SPEC/05_技術設計.md` のディレクトリ構造更新
  - `components/Common/` 新設を明記
  - `contexts/ViewModeContext.tsx` 追加を明記（FilterContextとの責務分離）
- [ ] `docs/SPEC/06_変更履歴.md` に R-新エントリ
  - 「R-008 の **コンポーネント名は変更なし** 方針を上書きし、UIラベルと内部名称を一致させる」と明記
- [ ] `docs/SPEC/` 配下の「全体一覧2」「YoukanBoard」「NewspaperBoard」「GlobalBoard」言及を整理（99_Archive除く）
- [ ] **コードには一切触らない**

### 0-B. インテグレーションテスト整備 [Agent-Test]
- [ ] `src/features/core/youkan/contexts/__tests__/FilterContext.test.tsx` 新規
- [ ] `src/features/core/youkan/screens/__tests__/DashboardScreen.viewMode.test.tsx` 新規
  - **UI構造ベース**（`data-testid="panorama-layout"`, `data-testid="overview-layout"` 等）
  - Agent-Rename への申し送り: 現状の `GlobalBoard.tsx` / `NewspaperBoard.tsx` に暫定的に `data-testid` を追加、リネーム後も同じ testid が残るようにする
- [ ] `src/features/core/youkan/logic/__tests__/filterUtils.test.ts` 新規（**Red状態でコミット**）
- [ ] `src/components/Layout/YoukanHeader.test.tsx` 強化
  - 現状：「状況把握」クリックで CustomEvent.detail.mode === 'board'
  - ステップ1後：'panorama' になる前提で、値比較をパラメトリック化もしくは両方許容するテストを書く

### 受入基準（ステップ0）
- 追加したテストが全て期待通り動く（filterUtils.test.ts だけ Red 状態）
- コード（src/配下）に変更がない（Agent-Specの責務）
- Agent-Testのコード変更は data-testid 追加のみ、他のロジックは触らない

---

## ステップ 1: 命名統一 [Agent-Rename]

### 1-A. ファイル・フォルダリネーム
| Before | After |
|---|---|
| `components/GlobalBoard/GlobalBoard.tsx` | `components/PanoramaBoard/PanoramaBoard.tsx` |
| `components/GlobalBoard/BucketColumn.tsx` | `components/PanoramaBoard/BucketColumn.tsx` |
| `components/GlobalBoard/ItemCard.tsx` | `components/PanoramaBoard/ItemCard.tsx` |
| `components/GlobalBoard/GentleMessage.tsx` | `components/PanoramaBoard/GentleMessage.tsx` |
| `components/GlobalBoard/ContextMenu.tsx` | `components/PanoramaBoard/ContextMenu.tsx`（ステップ2でCommon/に移動） |
| `components/GlobalBoard/__tests__/*` | `components/PanoramaBoard/__tests__/*` |
| `components/NewspaperBoard/NewspaperBoard.tsx` | `components/OverviewBoard/OverviewBoard.tsx` |
| `components/NewspaperBoard/NewspaperItem.tsx` | `components/OverviewBoard/OverviewItem.tsx` |
| `components/NewspaperBoard/useNewspaperItems.ts` | `components/OverviewBoard/useOverviewItems.ts` |
| `components/NewspaperBoard/ViewControls.tsx` | `components/OverviewBoard/ViewControls.tsx` |

### 1-B. 識別子リネーム
- [ ] `export const YoukanBoard` → `export const PanoramaBoard`
- [ ] `interface GlobalBoardProps` → `interface PanoramaBoardProps`
- [ ] `NewspaperBoard` / `NewspaperBoardProps` → `OverviewBoard` / `OverviewBoardProps`
- [ ] `useNewspaperItems` → `useOverviewItems`
- [ ] `YOUKAN_KEYS.NEWSPAPER_*` → `YOUKAN_KEYS.OVERVIEW_*` (キー文字列値も `youkan_overview_*` に変更)

### 1-C. `'board'` viewMode 廃止
- [ ] `YoukanHeader.tsx` L332: 「状況把握」`'board'` → `'panorama'`
- [ ] `YoukanHeader.tsx` L333: 「全体一覧」`'newspaper'` → `'overview'`
- [ ] `DashboardScreen.tsx` L46-53: viewMode 型から `'board'` 除去、`'newspaper'` → `'overview'`
- [ ] `DashboardScreen.tsx` L62-63: 変換ロジック削除
- [ ] `DashboardScreen.tsx` L279: `viewMode === 'newspaper'` → `'overview'`

### 1-D. レガシーテキスト除去
- [ ] `YoukanHeader.test.tsx` の旧「全体一覧2」テスト削除

### 1-E. 呼び出し側 import 修正
- [ ] `screens/DashboardScreen.tsx`, `screens/FlowScreen.tsx`, `screens/ProjectRegistryScreen.tsx`
- [ ] `components/Calendar/RyokanGanttView.tsx`
- [ ] `test/IntentDeleteIntegration.test.tsx`, `test/ContextMenuDelete.test.tsx`, `test/InboxThrowIn.test.tsx`

### 受入基準（ステップ1）
- `npm.cmd run build` / `npm.cmd run test -- --run` green
- `rg 'YoukanBoard|GlobalBoardProps|NewspaperBoard|useNewspaperItems|全体一覧2' src/ docs/SPEC/` が 0 件
- ステップ0-B で書いたインテグレーションテストが green

---

## ステップ 2: 重複解消 (DRY) [Agent-DRY]

### 2-A. filterUtils 実装（TDD）
```ts
// src/features/core/youkan/logic/filterUtils.ts
export const isTenantFilter = (filterMode: FilterMode): filterMode is string =>
  typeof filterMode === 'string' &&
  filterMode !== 'all' && filterMode !== 'personal' && filterMode !== 'company';

export const isCompanyContext = (filterMode: FilterMode): boolean =>
  filterMode === 'company' || isTenantFilter(filterMode);

export const getSelectedTenantId = (filterMode: FilterMode): string | null =>
  isTenantFilter(filterMode) ? filterMode : null;
```

ステップ0-Bで Red だった `filterUtils.test.ts` を Green にする。

### 2-B. 呼び出し側差し替え
- [ ] `YoukanHeader.tsx` L146
- [ ] `components/Dashboard/ViewContextBar.tsx` L86
- [ ] `PanoramaBoard.tsx` L73-77 → `getSelectedTenantId(filterMode)`
- [ ] `PanoramaBoard.tsx` L307-314
- [ ] `OverviewBoard.tsx` の IIFE を簡略化

### 2-C. ContextMenu 共通化
- [ ] `components/PanoramaBoard/ContextMenu.tsx` → `components/Common/ContextMenu.tsx` に移動
- [ ] `components/UI/ContextMenu.tsx` 削除、`items` プロパティの互換シムを共通版に吸収
- [ ] 22箇所の import 差し替え

### 受入基準（ステップ2）
- `filterUtils.test.ts` green
- `rg "filterMode !== 'all' && filterMode !== 'personal'" src/` 0 件

---

## ステップ 3: 状態管理整理 + localStorageマイグレーション [Agent-State]

### 3-A. migrateLocalStorage（TDD）
1. [ ] `src/features/core/session/__tests__/migrateLocalStorage.test.ts` を先に書く（Red）
2. [ ] `src/features/core/session/migrateLocalStorage.ts` 実装
3. [ ] `src/App.tsx` の mount 冒頭で呼び出し

変換内容:
- `youkan_view_mode`: `'board'` → `'panorama'`, `'newspaper'` → `'overview'`
- `youkan_newspaper_*` → `youkan_overview_*`
- `youkan_schema_version = '2'` で冪等ガード

### 3-B. ViewModeContext（TDD）
1. [ ] `contexts/__tests__/ViewModeContext.test.tsx` を先に書く
2. [ ] `src/features/core/youkan/contexts/ViewModeContext.tsx` 実装
3. [ ] `App.tsx` に `ViewModeProvider` 追加
4. [ ] `YoukanHeader.tsx`, `DashboardScreen.tsx`, `VolumeCalendarScreen.tsx`, `ProjectRegistryScreen.tsx` を Context 利用に

### 3-C. 未使用 ViewModel 削除
- [ ] `features/core/youkan/viewmodels/useDashboardViewModel.ts` 削除（参照0確認後）
- [ ] `features/plugins/manufacturing/viewmodels/useDashboardViewModel.ts` は**残す**

---

## ステップ 4: レガシー整理 [Agent-Cleanup]

- [ ] `components/Dashboard/DashboardScreen.tsx`（旧）の参照確認
  - 参照0なら削除
  - 参照ありなら `TateguDashboardScreen.tsx` にリネーム
- [ ] `FieldNoteList` コメント化 import の除去
- [ ] `docs/SPEC/` 内の GDB 言及を「状況把握」「PanoramaBoard」に置換（Agent-Spec が担当）
- [ ] `docs/requests.md` に「GDB 変数名刷新」別タスクを追加
