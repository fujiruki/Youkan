# Requests

- ドラッグ&ドロップの範囲を改善: 現在は左端のグリップアイコンのみドラッグ可能だが、カード全体をドラッグ開始可能にしたい
- 総会プロジェクトのバグ（調査済み → `docs/SPEC/investigation_soukai_bug.md`）:
  - **DB上のデータ異常はなし**（総会に紐づく6件は全て正当なサブタスク）
  - **修正1（最優先）**: `BaseController.php` 142行目の `projectTitle` フォールバック修正。`parent_title` が `projectTitle` に混入する問題（18件に影響）
  - **修正2**: `parent_id` あり・`project_id` NULL の18件のデータ整合性修復（マイグレーションSQL）
  - **修正3**: `CloudYoukanRepository.ts` の `getGdbShelf` で `project_id` がAPIに渡されない問題の修正
  - **ヒアリング結果**: ガントチャート画面（GanttChart.tsx）で確認。53行目 `item.projectTitle || 'Unassigned'` でグルーピングしており、CalendarController/ItemControllerのSQLに `real_project_title` JOINがない可能性
- 登録と集中画面の右クリックメニューを全体一覧2（Newspaper Board）の右クリックメニューと同じにしたい
