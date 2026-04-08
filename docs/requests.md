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
