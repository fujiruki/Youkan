# Youkan

## Agent-ガント一覧根本修正+総会バグ
### タスク
- [x] Step1: 原因特定
  - [x] 1-1. CalendarController.php SQL調査
  - [x] 1-2. BaseController.php mapItemRow調査
  - [x] 1-3. ローカルDB データ確認
  - [x] 1-4. 原因判定・報告
- [x] Step2: バックエンド修正
- [x] Step3: フロントエンド修正
  - [x] 3-1. hierarchy.ts: is_project除外テスト（RED）→ 既存ロジックでPASS
  - [x] 3-2. hierarchy.ts: wrapper.project=null テスト（RED）→ 実装（GREEN）
  - [x] 3-3. RyokanGanttView: wrapper.projectフォールバック除去テスト（RED）→ 実装（GREEN）
  - [x] 3-4. 既存テスト修正（projectTitle依存に変更）
- [x] ビルド確認（tsc --noEmit + vite build）
