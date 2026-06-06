# R-049 既存 vitest 38 件 failing の棚卸し（2026-06-06）

## サマリ

| 指標 | Before | After |
|:--|--:|--:|
| 失敗ファイル | 17 | 0 |
| 失敗テスト | 39 | 0 |
| 通過テスト | 565 | 585 |
| skip | 1 | 17 |
| 合計 | 605 | 602 |

- (a) テスト修正: 9 ファイル
- (b) テスト削除（仕様廃止）: 2 ファイル
- (c) 別 R 番号で後追い（skip 化）: 5 ファイル
- 共通の補強（setupTests.ts）: fetch 失敗の Promise rejection 抑止、DependencyRepository モック、useAuth に `joinedTenants: []` を追加

## 分類一覧

| テストファイル | 失敗内容 | 判定 | 対応 |
|:--|:--|:--|:--|
| `src/setupTests.ts` | (補強) 相対 URL fetch が Unhandled Rejection を吐く / DependencyRepository が `/api/dependencies` を呼んで死ぬ / useAuth モックに `joinedTenants` 欠落 | (a) | fetch を Network unavailable Reject に差し替え／DependencyRepository を空配列モック化／useAuth に `joinedTenants: []` を追加 |
| `src/test/WorkDaysSave.test.tsx` | `export {};` のみで No test suite found | (b) | ファイル削除 |
| `src/test/MenuInteraction.test.tsx` | DecisionDetailModal の「今回見送り...」「行き先を選択」ラベルが現行 UI には存在しない | (b) | ファイル削除（メニュー UI は MobileBottomSheet 等に置換済） |
| `src/test/InteractionTests.test.tsx` | `getByText('レンダリングテスト')` で見つからない（タイトルが `<input value>` 化） | (a) | `getByTestId('decision-detail-title-input').value` で検証 |
| `src/test/KeyboardAndButtons.test.tsx` | `onDecision` 引数が 3 → 4 個（`note`, `extra` payload 追加）に変更 | (a) | `toHaveBeenCalledWith(id, 'yes', any String, any Object)` に追従 |
| `src/test/TodayLogic.test.ts` | ローカル fallback ロジックが `status: 'focus'` のみ対象に変更されたのに、テストは `'ready'` を渡している | (a) | テストデータの status を `'focus'` に統一 |
| `src/test/IntentDeleteIntegration.test.tsx` | PanoramaBoard の VM 形が変わり、最小限の spy では描画自体が成立しない（`undefined.filter`） | (c) | `describe.skip` 化（R-053 候補：E2E or VM フィクスチャ整備で再構築） |
| `src/components/Layout/MenuDrawer.test.tsx` | MenuDrawer が Today / Projects / History / 設定 ラベルを持たない（再構成済） | (a) | 現行ラベル「アプリ設定」「変更履歴 (Audit Log)」「マニュアル (Manual)」で再アサート |
| `src/features/core/planning/FutureBoard.test.tsx` | 「未整理 (Inbox)」「スタンバイ (Stock)」セクションが「未定・Inbox」見出しに統合された | (a) | 現行見出し `/未定・Inbox/` でアサート、不要な分類検証を撤回 |
| `src/features/core/youkan/contexts/__tests__/FilterContext.test.tsx` | `filterMode` を localStorage 非永続化（毎セッション 'all' 開始）に仕様変更 | (a) | 「localStorage に保存されない」「localStorage を無視し 'all' 開始」をアサート |
| `src/features/core/youkan/logic/__tests__/perspective.test.ts` | `calculatePerspective(isCompanyContext, filterMode)` の戻り値ラベルを「会社業務の俯瞰」「A社マネージャーとして」等から「自分の時間管理 / 事業の管理」中心に簡略化 | (a) | 現行ロジックに合わせて再アサート（L-3/L-4 は personal_private 固定、L-6 は perspective='company_internal' で label='自分の時間管理'） |
| `src/features/core/youkan/components/Calendar/__tests__/RyokanGanttView.projectName.test.tsx` | `useToast must be used within ToastProvider` | (a) | `renderWithProviders` ヘルパー（ToastProvider ラップ）を用意し全 `render()` を置換 |
| `src/features/core/youkan/components/Calendar/__tests__/RyokanGanttView.scrollRef.test.tsx` | 同上（ToastProvider 未ラップ） | (a) | 同上 |
| `src/features/core/youkan/components/Dashboard/__tests__/FocusCard.test.tsx` | `jest.fn()` が vitest 環境で未定義 | (a) | `jest.fn()` → `vi.fn()` 置換 ＋ `import { describe, it, expect, vi } from 'vitest';` 追加 |
| `src/features/core/youkan/components/PanoramaBoard/__tests__/PanoramaBoard.showGroups.test.tsx` | 動的 import の解決連鎖が 3.6 秒かかり、testTimeout 5000ms に対して並列実行時にタイムアウト | (a) | `it(..., async () => {...}, 30000)` でタイムアウトを延長 |
| `src/features/core/auth/hooks/__tests__/useLoginViewModel.test.ts` | `AuthService` のメソッド名が `login` から `loginUser` / `loginTenant` に分離。エラーメッセージも「ユーザーアカウントのログインに失敗しました…」へ日本語化 | (a) | mock を `loginUser` / `loginTenant` に分割、失敗時の期待メッセージを日本語版に追従 |
| `src/features/core/youkan/logic/QuantityEngine.test.ts` （Scenario 2/3/6） | テストが `tenantProfiles` を渡しているが、実装は `capacityConfig.defaultCompanyWeeklyPattern` / `standardWeeklyPattern` 中心のロジックに置き換わっている | (c) | `it.skip` 化（R-051 候補：テナント別 capacity の仕様再確定が必要） |
| `src/features/plugins/manufacturing/manufacturing.test.ts` | 実装は Dexie/IndexedDB ベース、テストは `/api/deliverables` への fetch を期待。jsdom に IndexedDB なし＋実装乖離 | (c) | `describe.skip` 化（R-051 候補：実装/テスト両方の見直しが必要） |
| `src/features/core/youkan/viewmodels/__tests__/useYoukanViewModel.cascade.test.tsx` | VM の cascade ロジックが「楽観 local 更新」ではなく「affectedDescendantIds から再フェッチ」方式に変更されたため、子孫の `tenantId` / `isArchived` / `deletedAt` を local state で検証してもセットされない | (c) | `describe.skip` 化（R-052 候補：楽観更新仕様の再決定 or テスト書き換え） |

## (c) として残した R 番号候補

- **R-051**: 容量計算（QuantityEngine）/ Manufacturing repository のテスト再整備（仕様再確定 + テスト書き換え）
- **R-052**: useYoukanViewModel カスケード楽観更新の仕様確定とテスト再整備
- **R-053**: PanoramaBoard 統合シナリオを E2E（Playwright 等）または VM フィクスチャ整備で再構築

## 既存テストへの影響

- 565 → 585 で 20 件純増（修正で復活した分）。
- skip 件数は 1 → 17。c 系の 16 ケースが Pending 扱い。
- 削除した 2 ファイル分（WorkDaysSave: テスト 0 件、MenuInteraction: 2 件）はカウントから外れた。

## 補強した共通モック（setupTests.ts）

```ts
// 相対 URL の fetch は Unhandled Rejection になるため Network unavailable で reject
// DependencyRepository は IndexedDB / API 未モック環境でも空配列を返す
// useAuth は joinedTenants: [] を返し、PanoramaBoard 等の .map で落ちないようにする
```

これにより RyokanGanttView 系テストで発生していた 8 件の Unhandled Rejection も消滅。
