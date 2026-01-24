# Smart Verification Protocol (SVP) - Operational Standards

このドキュメントは、AIエージェントがコードの変更を行った後に必ず実施すべき「標準検証手順」を定義する。
自動テストコード（Unit Test）に加え、AI自身による**Browser Subagentを用いた実地検証（E2E）**を標準プロセスとする。

## 1. 原則 (Principles)
- **修正箇所以外も壊れていないか確認する**: 変更した機能だけでなく、標準的な基本操作（Inbox登録など）が動作することを確認する。
- **エラーゼロ**: ブラウザのコンソールログに赤文字のエラー（400/500番台）が出ていないことを確認する。
- **証跡の記録**: 検証結果は必ず `walkthrough.md` にスクリーンショット付きで記録する。

## 2. 標準検証シナリオ (Basic Operation Suite)
システムの健全性を確認するため、以下の操作は「変更内容に関わらず」定期的に、あるいはリリース前に検証すること。

### A. 起動と接続 (Launch & Connectivity)
- [ ] **Startup**: `verify_and_start.ps1` を使用し、バックエンド・フロントエンドが正常順序で起動すること。
- [ ] **Health Check**: `/api/health` が `{"status": "ok"}` を返すこと。

### B. Inbox & アイテム操作 (Item Lifecycle)
- [ ] **Create**: Inboxに新規アイテムを追加できること。
- [ ] **Update**:
    - アイテム詳細を開けること。
    - 「納期の目安」や「MY期限」を変更し、保存（API 200 OK）されること。
    - エラー（403 Forbidden等）が出ないこと。
- [ ] **Move/Status**:
    - 「保留 (Sleep)」ボタンでアイテムがリストから消え、GDBなどに移動すること。
    - 「完了」操作ができること。

### C. 標準ライフサイクルテスト (User Definitions)
以下のフローが正常に完了することを検証する。
1. **Inbox登録**: タスクTaskAとTaskBを登録。
2. **詳細設定 & 保留**: 詳細画面で納期・目安・My期限を指定し「保留(Sleep)」へ。
3. **Standby -> Commit**: 保留(Standby)から詳細を開き「今日やる(Commit)」へ。
4. **Today -> Execution**: Today画面で「これからやる(Start)」を押す。
5. **Completion**: 「完了(Complete)」を押す。
6. **Multi-Task**: 別のタスクを開始し、同様に完了させる。

### D. ビューの確認 (View Integrity)
- [ ] **Today View**: エラーなく表示されること。
- [ ] **Project List**: プロジェクト一覧が取得できること（401/500エラーなし）。
- [ ] **GDB (Judgment)**: 判断画面が表示され、Inboxアイテムや期限切れアイテムが表示されること。

## 3. エラー時の対応
- 検証でエラーが発生した場合、決して「無視」せず、必ず修正してから完了報告を行うこと。
- 特に認証エラー(401/403)やロジックエラー(500)は、運用に致命的なため最優先で修正する。
