---
description: Start the development server using the Smart Verification Protocol (SVP) launcher.
---

# サーバー起動 (SVP v4.0)

以下のコマンドを実行して、ローカル開発サーバー（Backend + Frontend）を起動します。
このコマンドは、環境の診断、修復、および文字コードの自動ハンドリングを行います。

```powershell
./svp.ps1
```

## できること
- **自動クリーンアップ**: ゾンビプロセス（php.exe, node.exe）を自動的に停止します。
- **ポート解放待ち**: ポートが使用中の場合、解放されるまで待機します。
- **Fail-Open**: サーバーが応答しなくてもプロセス生存が確認できれば起動を継続します。
- **文字化け防止**: ランチャーが自動的に適切なエンコーディングでスクリプトを実行します。

## 注意事項
- サーバーを停止するには、PowerShellウィンドウを開いたまま `Ctrl+C` を押すか、ウィンドウを閉じてください。
