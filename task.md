# Youkan — 現在の作業

現在、進行中のタスクはありません。

## 直近の完了タスク

### R-026: 命名統一＋状態管理整理リファクタリング（2026-04-22 完了）

ブランチ `refactor/naming-unification` で5ステップ全て完遂し `master` にマージ・デプロイ済み。

- **ステップ0** (`a0be227`): 仕様書更新＋インテグレーションテスト整備
- **ステップ1** (`9f304b0`): 命名統一（GlobalBoard→PanoramaBoard、NewspaperBoard→OverviewBoard、`board`/`newspaper` viewMode 廃止、全体一覧2レガシーテスト削除）
- **ステップ2** (`08e2fe0`): 重複解消（`logic/filterUtils.ts` 新設、ContextMenu の `components/Common/` 共通化）
- **ステップ3** (`db9bbd6`): 状態管理整理（`ViewModeContext` 新設、`migrateLocalStorage` 実装、未使用 `useDashboardViewModel` 削除）
- **ステップ4** (`7c51226`): レガシー整理（旧 `components/Dashboard/DashboardScreen.tsx` 削除、docs の GDB 言及を PanoramaBoard に置換）
- **マージ** (`88a2f38`): `master` へ `--no-ff` マージ
- **詳細**: `docs/request_log.md` の R-026 エントリ参照

## 次に積まれている要望

`docs/requests.md` に未着手項目あり:
- **コード内 GDB 用語の刷新**（viewmodel/repository 内部の `gdbActive`/`refreshGdb` 等の変数名を PanoramaBoard 系に改める。別R番号で実施予定）
