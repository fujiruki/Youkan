# Youkan — R-029 実装タスク

**ブランチ**: `feature/R-029-bugfix`
**Plan**: `C:\Users\fjtsu\.claude\plans\elegant-whistling-unicorn.md`
**目的**: 3バグ複合修正

## 修正対象（独立3件）

1. **修正1**: 登録と集中（stream）でプロジェクト（is_project=1）非表示
2. **修正2**: パノラマの Someday バケットに someday アイテム表示（getGdbShelf レスポンスに someday キー追加）
3. **修正3**: 3階層以上プロジェクトフォーカスで子孫取得（WITH RECURSIVE 初期行に parent_id チェック追加）

## 絶対ルール
- 指揮AIはコード直接編集しない、Agent委譲、`model="sonnet"`
- 仕様書先行 → コード実装
- ステップ単位で1コミット

## ステップ

### ステップ1: 仕様書更新（Agent-Spec）
- `docs/requests.md` → `docs/request_log.md` に R-029 移記（2026-05-04）
- `docs/SPEC/03_画面設計.md` Streamモードに「プロジェクト非表示」追記
- `docs/SPEC/05_技術設計.md` getGdbShelf に someday キー、getProjectDescendantIds に parent_id チェックを追記
- `docs/SPEC/06_変更履歴.md` R-029 エントリ
- コードは触らない

### ステップ2: バグ修正実装（Agent-Bugfix）
- `JWCADTategu.Web/src/features/core/youkan/screens/DashboardScreen.tsx`: inbox/pending/waiting items に isProject フィルター
- `JWCADTategu.Web/src/features/core/youkan/repositories/CloudYoukanRepository.ts`: getGdbShelf に someday 追加
- `JWCADTategu.Web/src/features/core/youkan/repositories/YoukanRepository.ts`: モック版にも someday 追加
- `GdbShelf` 型に `someday?: Item[]` 追加
- `JWCADTategu.Web/src/features/core/youkan/viewmodels/useYoukanViewModel.ts`: refreshGdb で shelf.someday から直接セット
- `backend/BaseController.php`: getProjectDescendantIds の WITH RECURSIVE 初期行に parent_id 条件追加
- テスト確認: 既存テスト維持、必要なら追加

### ステップ3: マージ＆デプロイ
- master へマージ、upload.ps1 でデプロイ

## メンテナンス則（恒久）
- getGdbShelf レスポンスは status 数と完全対応
- 階層判定は id/project_id/parent_id の3軸で初期行評価
- stream モードはタスク判断・登録フォーカス、プロジェクト構造はパノラマ・全体一覧で扱う
