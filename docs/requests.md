# Requests

- **【中】** マネージャーAI連携用API（晴樹さん行動分析）
  - 目的: 外部のマネージャーAI（C:\claude-workspace\shared\manager\）が、指定ユーザー（例: fjt.suntree@gmail.com）のタスク一覧・focus傾向・完了状況を1日2回（12:00, 21:00）取得し、行動パターン分析に使う
  - 現状: `shared/youkan_helper.py` の `get_focus_tasks()` は毎回ログインして `/items?scope=aggregated` を叩いている。外部バッチ向けの専用口やAPIキー発行機構はない
  - 認証方式（要検討）: ユーザー発行APIキー or サービス間シークレット+対象メールアドレス指定（現行の共通 `youkan_api_token` はテナント跨ぎで危険）
  - エンドポイント案:
    - `GET /api/user/{user_id}/tasks?status=all` 全タスク+focus状態（status, due_date, completed_at, priority, project_id）
    - `GET /api/user/{user_id}/activity?since=YYYY-MM-DD` 完了履歴・ステータス変更履歴
  - レスポンス形式: JSON
  - 呼び出し頻度: 1日2回（12:00, 21:00）

- **【高】** APIで全テナントのタスクを一括取得できるようにする
  - 現状: `/api/items` はテナントごとに個別リクエストが必要。「全て」フィルタに相当するAPIパラメータがない
  - 要望: `GET /api/items?scope=all` で個人+全テナントのタスクを一括取得
  - 背景: 番頭WebUIダッシュボードから晴樹さんのフォーカスタスクを表示したいが、テナント切り替えAPIもないため全タスク取得が困難
  - 現在の回避策: 各テナントIDを個別に叩いて結合（非効率・テナント追加時にハードコード修正が必要）

- **【中】** フローチャート自動配列（依存順序通りに自動整列）

- **【中】** 操作中エラーで「はい」返答後に前の状態に戻ってしまうバグの修正

- **【中】** フローへのアイテム追加（流れの途中に追加できるようにする）

- **【低】** ショートカットヘルプ表示（一覧パネル等）

- **【中】** ガントチャートでマイ期限が依存順位の影響でずれた場合の処理
  - 「依存のせいで入れれません。これ以降のアイテムの納期をずらす？それともアイテムの納期移動をキャンセルする？」と問うダイアログ

- **【低】** コード内 GDB 用語の刷新（R-026完了後の別タスク）
  - 現状: `viewmodels/` 配下の `gdbActive`, `gdbIntent`, `gdbPreparation`, `gdbLog`, `refreshGdb`, `ghostGdbCount` 等の GDB 用語が内部変数名に残存
  - 要望: `src/features/core/youkan/viewmodels/useYoukanViewModel.ts` の上記変数名を「状況把握ボード」に沿った命名（PanoramaBoard系）に改める
  - バックエンド `backend/GdbController.php` の整理も併せて検討
  - 注意: `repositories/` 層にも波及するため、R-026（命名統一）とは独立した大仕事。別R番号で別ブランチ対応する
