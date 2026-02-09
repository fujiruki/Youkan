---
description: プロジェクトルートの upload.ps1 を使用して、統合された最新ロジックで ConoHa サーバーへデプロイします。
---

1. ビルドと展開の実行
   // turbo
   run_command("powershell.exe -ExecutionPolicy Bypass -File upload.ps1")

2. 実行結果の厳密な確認
   - コマンドの出力（標準出力および標準エラー出力）を最後まで確認します。
   - `✅ DEPLOYMENT SUCCESSFUL!` というメッセージが表示されていることを確認します。
   - もしエラーが発生している場合は、どのフェーズ（Build, Archive, Upload, Extract）で失敗したかを特定し、ユーザーに報告します。

3. 成功の報告
   - デプロイが完了したら、通知またはメッセージで「デプロイ成功」と明示的に報告します。

TIMING:
- 開発した機能の検証が完了し、本番環境への反映が必要な時に使用します。
- このスクリプトは `npm run build`、パッケージング、SCPアップロード、リモート展開を一括で行います。
