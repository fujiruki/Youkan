# 引き継ぎ書: backPC初回セッション (2026-03-24)

**作成日**: 2026-03-24
**作成者**: Claude Code（指揮AI）

---

## 今日やったこと

### backPC環境整理
- 不要フォルダ5つ削除（01_経営事務, 02_発信コンテンツ, 03_公式サイト, 05_振り返り, AI_Common）
- `.company/` をGitHubからclone（参照用）
- CLAUDE.md をbackPC用に更新
- スラッシュコマンド12個を `~/.claude/commands/` にグローバル配置
- spec-docs-driven-dev-template を `00_AI共通/` に導入・改良・push
- sdd-dashboard セットアップ（npm link済み）
- git config を `Fujiruki-backPC` / `fjt.suntree@gmail.com` に設定

### DotLog
- **push-notify.php**: executionがnullの場合、commits先頭をフォールバック（`resolveCurrentAndNextTask()`追加）
- **YoukanTaskBanner.tsx**: ホーム画面タイトル下にYoukanタスク表示（エラー表示付き）
- **youkan-relay.php**: フロントエンド用Youkan API中継エンドポイント作成
- `status_updated_at` が数値なのに文字列比較していたバグ修正
- デプロイ先リンクを `/contents/Youkan/` に更新
- 複数回デプロイ済み、本番稼働中

### Youkan
- **TodayController**: commitsソートを「着手開始日が近い順」に変更（due_date ASC, sort_order優先）
- **reorderFocus()**: `focus_order` → `sort_order` に統一
- **SortableFocusQueue**: @dnd-kitでドラッグ&ドロップUI追加、カード全体をドラッグ可能に
- **nullクラッシュ修正**: `sanitizeItems` ユーティリティ作成、全コンポーネントに防御フィルタ適用
- **デプロイ先変更**: `contents/TateguDesignStudio/` → `contents/Youkan/` に移行完了
- 旧TateguDesignStudioは `TateguDesignStudio_DELETE_OK` にリネーム済み（サーバー上）
- **SdDD仕様書整備**: SPEC.md, spec/01〜06, request_log.md を新規作成
- **総会バグ調査・部分修正**:
  - BaseController.php の projectTitle フォールバック修正済み
  - 全コントローラーに `real_project_title` JOIN追加済み
  - 本番DBの parent_id→project_id データ修復済み（19件）
- **右クリックメニュー統一**: DashboardScreenとGlobalBoardで共通の `buildItemContextMenuActions` を使用

### AiSecretary
- `docs/spec/07_アプリ間連携.md` に通知対象ロジック追記（execution→commits→通知なし）

### sdd-dashboard改善
- 完了セクション折りたたみ（`e`キーでトグル）
- `--reset` オプション（完了済みセクション削除、バックアップ自動作成）
- `fs.watch` → `fs.watchFile` ポーリング化（60秒間隔）
- 全てpush済み

### spec-docs-driven-dev-template改善
- `task.md` テンプレート追加
- README.mdにSdDD略称・`/sddd`案内・ダッシュボードセットアップ手順追加
- 導入ガイドにダッシュボードCLI手順追加
- 禁止事項「指揮AIのコード編集禁止」をバグ修正含めて明確化
- 全てpush済み

---

## 未完了・残タスク

### Youkan — 総会プロジェクト表示バグ（未解決）
- **状況**: ガントチャート画面でアイテムに `[総会]` が表示され続ける
- **調査結果**: ガントチャート（`features/plugins/tategu/screens/ScheduleBoard.tsx`）は**バックエンドAPIを使っていない**。ローカルIndexedDB（`db.projects`, `db.doors`, `db.tasks`）から直接データ取得している
- **しかし**: 晴樹のスクショの画面が本当にtateguプラグインのガントチャートかどうか未確認。量感カレンダーのリスト表示の可能性もある
- **次のアクション**: 晴樹に「どのメニュー/URLから開いた画面か」をヒアリングして特定する
- 調査報告書: `docs/SPEC/investigation_soukai_bug.md`

### Youkan — requests.md（残りの未対応）
```
- ドラッグ&ドロップの範囲を改善 → 実装済み・デプロイ済み
- 総会プロジェクトのバグ → 部分修正済み、表示問題は未解決
- 右クリックメニュー統一 → 実装済み・デプロイ済み
```

### Youkan — Morning Planning
- 仕様書: `docs/SPEC/03_MORNING_PLANNING.md` 作成済み
- 実装: ドラッグ&ドロップ並べ替え + ソートロジックは完了
- 未完了: 「着手開始日が近い順」のデフォルトソートは `due_date` 近い順で近似実装。本来の目安期間逆算ロジックは未実装

### Youkan — コミットすべき変更
backPCで多数の変更を加えたが、**gitコミットが不十分**な可能性がある。以下を確認：
```bash
cd C:\Fujiruki\Projects\Youkan && git status && git log --oneline -5
```

### DotLog — コミットすべき変更
同様にDotLogも確認が必要。

---

## サーバー上の状態

| パス | 状態 |
|------|------|
| `contents/Youkan/` | 本番稼働中（最新デプロイ済み） |
| `contents/TateguDesignStudio_DELETE_OK/` | 旧版。削除可能 |
| `contents/DotLog/` | 本番稼働中（最新デプロイ済み） |
| `contents/Youkan/backend/jbwos.sqlite` | 本番DB（data修復済み） |
| `contents/Youkan/backend/jbwos.sqlite.bak_20260324_soukai_fix` | 修復前バックアップ |

---

## 学んだこと・ルール

1. **指揮AIはコードに触らない**: バグ修正も含め全てAgentに委譲する（memoryに記録済み）
2. **SdDD Phase4**: task.md作成 → ダッシュボード案内 → Agent起動の順
3. **Agentにtask.md更新を必ず指示する**: 指示しないとダッシュボードに反映されない
4. **Windowsのfs.watchは不安定**: fs.watchFileポーリングに変更済み
5. **Youkanの `status_updated_at` はUnixタイムスタンプ（数値）**: 文字列として扱わない
6. **upload.ps1のSSH鍵パス**: backPCでは `C:\Fujiruki\Secret\key-2026-03-21-18-16-ConohaforAI.pem`

---

## 参照すべきファイル

| 目的 | ファイル |
|------|---------|
| Youkan仕様書目次 | `C:\Fujiruki\Projects\Youkan\docs\SPEC.md` |
| Youkan requests | `C:\Fujiruki\Projects\Youkan\docs\requests.md` |
| 総会バグ調査報告 | `C:\Fujiruki\Projects\Youkan\docs\SPEC\investigation_soukai_bug.md` |
| Morning Planning仕様 | `C:\Fujiruki\Projects\Youkan\docs\SPEC\03_MORNING_PLANNING.md` |
| DotLog Phase1仕様 | `C:\Fujiruki\Projects\DotLog\docs\spec\phase1-web-push-notification.md` |
| アプリ間連携仕様 | `C:\Fujiruki\Projects\AiSecretary\docs\spec\07_アプリ間連携.md` |
| SdDDテンプレート | `C:\Fujiruki\00_AI共通\spec-docs-driven-dev-template\` |
| backPC CLAUDE.md | `C:\Fujiruki\CLAUDE.md` |
