---
description: プロジェクトルートの upload.ps1 を使用して、統合された最新ロジックで ConoHa サーバーへデプロイします。
---

1. デプロイスクリプトの実行
   // turbo
   run_command("powershell.exe -ExecutionPolicy Bypass -File upload.ps1")

TIMING:
- 開発した機能の検証が完了し、本番環境への反映が必要な時に実行します。
- このスクリプトは内部で `npm run build` を実行し、バックエンドファイルの同期（DB除外設定済み）とパーミッション調整までを一括で行います。

CAUTION:
- 初回実行時は SSH 鍵のパスやリモートディレクトリの設定が正しいか `upload.ps1` 内の変数を確認してください。
