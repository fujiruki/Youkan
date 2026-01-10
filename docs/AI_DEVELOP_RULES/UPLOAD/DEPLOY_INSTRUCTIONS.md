# Webアプリケーション デプロイ手順書 (AIアシスタント向け)

このドキュメントは、ユーザーのWebサーバー (ConoHa) にWebアプリケーション (Vite/React/静的サイト) をデプロイするための手順を記したものです。
他のAIアシスタントにデプロイを依頼する際は、このファイルと `upload.ps1` スクリプトを渡してください。

## 1. 前提条件 / 必要なファイル

デプロイを実行するために、AIエージェントは以下にアクセス可能である必要があります：

1.  **ソースコード**: Webアプリケーションのプロジェクト (package.json に `build` スクリプトが含まれていること)。
2.  **デプロイスクリプト**: `upload.ps1` (後述)。
3.  **SSH秘密鍵**: 鍵ファイル (例: `key-2025-11-29-07-10.pem`)。通常、プロジェクトルートまたは安全な場所に保管されています。

## 2. デプロイのワークフロー

AIは以下の手順を実行する必要があります：

1.  **設定の確認**:
    *   `upload.ps1` を開きます。
    *   `$remoteDir` を、*新しい* システム用のサーバー上の正しいターゲットパスに更新します。
    *   `$sshKeyPath` が正しい秘密鍵ファイルを指していることを確認します。

2.  **アプリケーションのビルド**:
    *   ビルドコマンドを実行して、`dist` (または `build`) ディレクトリを生成します。
    *   コマンド: `npm run build` (または `build.bat` があればそれを実行)。

3.  **アップロードの実行**:
    *   PowerShellスクリプトを実行します。
    *   コマンド: `.\upload.ps1`

## 3. `upload.ps1` テンプレート

新しいプロジェクトにスクリプトがない場合は、以下の内容で `upload.ps1` を作成してください (`$remoteDir` は適宜変更してください)：

```powershell
$ErrorActionPreference = "Stop"

# --- 設定 (ここを変更してください) ---
$serverHost = "www1045.conoha.ne.jp"
$serverUser = "c6924945"
$serverPort = "8022"
$remoteDir  = "public_html/door-fujita.com/contents/YOUR_NEW_PROJECT_NAME" # <--- ここを変更
$sshKeyPath = "key-2025-11-29-07-10.pem"       # <--- 鍵ファイルがあることを確認
$archiveName = "deploy.tar.gz"
# ------------------------------------

Write-Host "Starting upload process..."
Write-Host "Server: $serverHost"
Write-Host "Target: $remoteDir"

# 1. ビルド成果物の確認
if (-not (Test-Path "dist")) {
    Write-Error "Error: 'dist' directory not found. Run 'npm run build' first."
    exit 1
}

# 2. アーカイブ作成
try {
    tar -czf $archiveName -C dist .
    if ($LASTEXITCODE -ne 0) { throw "tar command failed" }
} catch {
    Write-Error "Archive failed: $_"; exit 1
}

# 3. アップロードと展開
$scpArgs = @("-o", "StrictHostKeyChecking=no", "-P", $serverPort, "-i", $sshKeyPath, $archiveName, "$serverUser@$serverHost`:$remoteDir/$archiveName")
$sshCommandExtract = "mkdir -p $remoteDir && cd $remoteDir && rm -f index.html && tar -xvf $archiveName && rm $archiveName"
$sshArgsExtract = @("-o", "StrictHostKeyChecking=no", "-p", $serverPort, "-i", $sshKeyPath, "$serverUser@$serverHost", $sshCommandExtract)
$fixPermsCommand = "find $remoteDir -type d -exec chmod 755 {} + && find $remoteDir -type f -exec chmod 644 {} +"
$sshArgsPerms = @("-o", "StrictHostKeyChecking=no", "-p", $serverPort, "-i", $sshKeyPath, "$serverUser@$serverHost", $fixPermsCommand)

try {
    # アップロード
    Write-Host "Uploading..."
    & scp $scpArgs
    
    # 展開 (Extract)
    Write-Host "Extracting..."
    & ssh $sshArgsExtract
    
    # パーミッション修正
    Write-Host "Fixing permissions..."
    & ssh $sshArgsPerms
    
    Write-Host "SUCCESS: Deployed to $remoteDir" -ForegroundColor Green
} catch {
    Write-Error "Deployment failed: $_"
    exit 1
} finally {
    if (Test-Path $archiveName) { Remove-Item $archiveName }
}
```
