# Youkan — R-027 実装タスク

**ブランチ**: `feature/R-027-cascade`
**Plan**: `C:\Users\fjtsu\.claude\plans\elegant-whistling-unicorn.md`
**目的**: 親→子孫カスケード機能（MVVM準拠、リアクティブ伝播、楽観的UI＋ロールバック）

## 絶対ルール
- **指揮AIはコード直接編集しない**。全実装はAgent委譲、`model="sonnet"`
- **仕様書更新はコード変更より先**（Phase 3 → Phase 4）
- **ステップ単位で1コミット**。跨ぎ禁止
- **直列実行**: Spec → Backend → Frontend → 統合確認

## 除外対象（触らない）
- `docs/99_Archive/` 配下
- `manufacturing` プラグイン側の `useDashboardViewModel.ts`
- viewmodels/repositories の既存 `gdb*` 変数名（別タスク）

---

## ステップ 1: 仕様書更新 [Agent-Spec]

- [ ] `docs/requests.md` に R-027 要望追加 → `docs/request_log.md` に R-027 で移記（2026-04-27）
- [ ] `docs/SPEC/02_機能仕様.md` に「親→子孫カスケードの一般則」セクション
- [ ] `docs/SPEC/05_技術設計.md` に「リアクティブ伝播パターン」セクション
- [ ] `docs/SPEC/06_変更履歴.md` に R-027 エントリ
- [ ] **コード不可触**

## ステップ 2-5: バックエンド [Agent-Backend]

### 2: ヘルパー抽出＋権限チェック
- [ ] `cascadeTenantToDescendants(string $rootId, ?string $newTenantId): array` private メソッド
- [ ] `cascadeStatusToDescendants(string $rootId, string $updatesSql, array $updateParams): array` private メソッド
- [ ] `update()` 冒頭・行801-826で `joinedTenants` 含有確認、外なら 403

### 3: update() のカスケード呼出
- [ ] beginTransaction/commit/rollBack で囲む
- [ ] tenantChanged/projectChanged 検知 → cascadeTenantToDescendants 呼出
- [ ] レスポンスに `affectedDescendantIds` を含める
- [ ] is_project 条件なし、子孫の project_id は変更しない

### 4: archive/trash/delete カスケード条件撤廃
- [ ] updateStatus() 行388 の `if ($existing['is_project'])` 削除 → cascadeStatusToDescendants 呼出
- [ ] delete() 行971 の同条件削除 → 物理削除カスケード（cascadeDeleteDescendants 新設）
- [ ] レスポンスに `affectedDescendantIds` / `deletedDescendantIds`

### 5: バックエンドテスト
- [ ] `backend/tests/test_cascade_operations.php` 新規
- [ ] テナント移動・プロジェクト移動・個人化・権限・archive(is_project=1/0)・trash・restore・delete・循環・トランザクション失敗 の9〜10ケース

## ステップ 6-8: フロント [Agent-Frontend]

### 6: API/Repository/ViewModel 拡張
- [ ] `ApiClient.updateItem/archiveItem/trashItem/restoreItem/destroyItem` 戻り値に `affectedDescendantIds?: string[]` を追加
- [ ] `CloudYoukanRepository` / `YoukanRepository` も同様
- [ ] `useYoukanViewModel.ts` に:
  - [ ] `refreshItems(ids: string[])` 部分リフレッシュ
  - [ ] `optimisticCascadeTenant(rootId, newTenantId)` 楽観的更新＋snapshot返却
  - [ ] `restoreSnapshot(snapshot)` ロールバック
  - [ ] `updateItem`/`archiveItem`/`trashItem`/`restoreItem`/`deleteItem` を楽観更新→確定同期→ロールバックの3段に書き換え
- [ ] `fetchItemsByIds` API＋Repository＋クライアント新設

### 7: ViewModelリアクティブテスト
- [ ] `viewmodels/__tests__/useYoukanViewModel.cascade.test.tsx` 新規（vitest）
- [ ] updateItem({tenantId}) → 親+子孫即時同期 → API成功で refreshItems
- [ ] API失敗 → snapshot から rollback
- [ ] archiveItem(parent) → 親+子孫即時 → 失敗でrollback

### 8: View層確認（基本変更不要）
- [ ] DecisionDetailModal の動作確認のみ

## ステップ 9: 統合動作確認＋デプロイ [指揮AI]

- [ ] ローカル動作確認（楽観更新・rollback・カスケード）
- [ ] master へマージ
- [ ] `upload.ps1` でデプロイ
- [ ] 本番動作確認

## メンテナンス則（恒久ルール、PRレビューで監視）
- `refreshAll()` の追加使用は禁止（部分refreshの徹底）
- `is_project` での分岐の追加は禁止（親子関係で常に判断）
- バックエンドの巨大 `update()` メソッド肥大化を避ける
- ViewModel に副作用責務を集中、Component/Repository は薄く保つ
