# ========================================
# Universal Web Application Deploy Script
# ========================================
# このスクリプトは、React/Vite フロントエンド（+ オプションでPHPバックエンド）を
# ConoHa Web サーバーに自動デプロイします。
#
# 使用方法:
# 1. プロジェクトルートにこのスクリプトを配置
# 2. 下記の「設定」セクションを編集（特に $remoteDir）
# 3. プロジェクトルートで実行: .\upload.ps1
#
# 前提条件:
# - フロントエンドのビルドコマンドが `npm run build` で動作すること
# - SSH秘密鍵が `docs/AI_DEVELOP_RULES/UPLOAD/key-2025-11-29-07-10.pem` に存在すること
# ========================================

$ErrorActionPreference = "Stop"

# ========================================
# 🔧 設定（ここを編集してください）
# ========================================
$serverHost = "www1045.conoha.ne.jp"
$serverUser = "c6924945"
$serverPort = "8022"

# 🎯 重要: デプロイ先のディレクトリを指定してください
# 例: "public_html/door-fujita.com/contents/YOUR_PROJECT_NAME"
$remoteDir = "public_html/door-fujita.com/contents/Youkan"  # <-- ここを変更

# SSH秘密鍵のパス（プロジェクトルートからの相対パス）
$sshKeyPath = "C:\Fujiruki\Secret\key-2026-03-21-18-16-ConohaforAI.pem"

# フロントエンドのディレクトリ名（自動検出も可能）
$frontendDir = "JWCADTategu.Web"  # <-- プロジェクトに合わせて変更

# バックエンドのディレクトリ名（存在しない場合は自動スキップ）
$backendDir = "backend"

# アーカイブファイル名
$archiveName = "deploy.tar.gz"
# ========================================

Write-Host "🚀 Starting Deployment Process..." -ForegroundColor Cyan
Write-Host "   Server: $serverHost"
Write-Host "   Target: $remoteDir"
Write-Host "   Key   : $sshKeyPath"

# ========================================
# [1/4] フロントエンドのビルド
# ========================================
Write-Host "`n[1/4] Building Frontend..." -ForegroundColor Yellow

if (Test-Path $frontendDir) {
    Push-Location $frontendDir
    try {
        Write-Host "   → Running 'npm run build'..." -ForegroundColor Cyan
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { 
            Write-Host "`n[!] Build Failed with Exit Code $LASTEXITCODE" -ForegroundColor Red
            Write-Host "    Possible causes:" -ForegroundColor Gray
            Write-Host "    - TypeScript type errors (run 'npm run build' locally to see details)" -ForegroundColor Gray
            Write-Host "    - Missing dependencies (run 'npm install')" -ForegroundColor Gray
            Write-Host "    - Syntax errors in recent changes`n" -ForegroundColor Gray
            Write-Host "    Please ask AI: 'The build failed. How can I fix this?'" -ForegroundColor Yellow
            throw "Frontend build failed. See above for details."
        }
        Write-Host "   ✓ Frontend build completed" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Error "Frontend directory '$frontendDir' not found."
    Write-Error "Please check the `$frontendDir variable in the script."
    exit 1
}

# ========================================
# [2/4] デプロイパッケージの準備
# ========================================
Write-Host "`n[2/4] Preparing Distribution Package..." -ForegroundColor Yellow

$deployTmp = "deploy_tmp"
if (Test-Path $deployTmp) { 
    Remove-Item $deployTmp -Recurse -Force 
}
New-Item -ItemType Directory -Path $deployTmp | Out-Null

# バックエンドファイルのコピー（存在する場合）
if (Test-Path $backendDir) {
    Write-Host "   → Copying backend directory ($backendDir)..." -ForegroundColor Cyan
    # [FIX] Exclude database and log files from deployment to prevent overwriting remote data
    Copy-Item -Path $backendDir -Destination $deployTmp -Recurse -Exclude "*.sqlite", "*.log"
    Write-Host "   ✓ Backend files copied" -ForegroundColor Green
}
else {
    Write-Host "   ℹ Backend directory not found, skipping..." -ForegroundColor Gray
}

# フロントエンドアセットのコピー
Write-Host "   → Copying frontend assets from '$frontendDir/dist'..." -ForegroundColor Cyan
if (Test-Path "$frontendDir/dist") {
    Copy-Item -Path "$frontendDir/dist/*" -Destination $deployTmp -Recurse
    Write-Host "   ✓ Frontend assets copied" -ForegroundColor Green
}
else {
    Write-Error "Frontend dist directory not found at '$frontendDir/dist'."
    Write-Error "Did the build succeed?"
    Remove-Item $deployTmp -Recurse -Force
    exit 1
}

# ========================================
# [3/4] アーカイブ作成
# ========================================
Write-Host "`n[3/4] Creating Archive ($archiveName)..." -ForegroundColor Yellow

try {
    tar -czf $archiveName -C $deployTmp .
    if ($LASTEXITCODE -ne 0) { 
        throw "tar command failed with exit code $LASTEXITCODE" 
    }
    $size = (Get-Item $archiveName).Length / 1KB
    Write-Host "   ✓ Archive created ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
}
catch {
    Write-Error "Failed to create archive: $_"
    Remove-Item $deployTmp -Recurse -Force
    exit 1
}
finally {
    Remove-Item $deployTmp -Recurse -Force
}

# ========================================
# [4/4] サーバーへのアップロード＆展開
# ========================================
Write-Host "`n[4/4] Uploading & Deploying to Server..." -ForegroundColor Yellow

# SSH/SCPコマンドの共通オプション（タイムアウト設定）
# 注意: -v (verbose) は stderr に大量出力し、PowerShell の $ErrorActionPreference="Stop" と
#        衝突するため、通常時は使用しない。デバッグ時のみ手動で追加すること。
$sshOpts = "-o StrictHostKeyChecking=no -o ConnectTimeout=30 -o ServerAliveInterval=15"

$sshCommandMkdir = "mkdir -p $remoteDir"

# 展開 & パーミッション設定コマンド
$sshCommandExtract = "cd $remoteDir && tar -xzf $archiveName && chmod -R 777 . && rm $archiveName && find . -type d -exec chmod 755 {} + && find . -type f -exec chmod 644 {} +"

# [FIX] cmd /c 経由で実行することで、SSH の stderr 出力が PowerShell の
#       ErrorRecord に変換されて $ErrorActionPreference=Stop で throw される問題を回避
function Invoke-SshSafe {
    param([string]$Command, [string]$LogFile)
    cmd /c "$Command 2>&1" | Out-File -Append $LogFile -Encoding utf8
    if ($LASTEXITCODE -ne 0) {
        throw "Command failed (ExitCode: $LASTEXITCODE). Check $LogFile for details."
    }
}

$logFile = "deploy_debug.log"
"--- Deployment log started at $(Get-Date) ---" | Out-File $logFile -Encoding utf8

try {
    $sshBase = "ssh $sshOpts -p $serverPort -i $sshKeyPath $serverUser@$serverHost"
    $scpBase = "scp $sshOpts -P $serverPort -i $sshKeyPath"

    # リモートディレクトリの作成
    Write-Host "   → Ensuring remote directory exists (Log: $logFile)..." -ForegroundColor Cyan
    Invoke-SshSafe -Command "$sshBase `"$sshCommandMkdir`"" -LogFile $logFile
    Write-Host "   ✓ Remote directory ready" -ForegroundColor Green
    
    # アップロード
    Write-Host "   → Uploading archive..." -ForegroundColor Cyan
    $uploadStart = Get-Date
    Invoke-SshSafe -Command "$scpBase $archiveName $serverUser@${serverHost}:$remoteDir/$archiveName" -LogFile $logFile
    $uploadTime = ((Get-Date) - $uploadStart).TotalSeconds
    Write-Host "   ✓ Upload completed ($([math]::Round($uploadTime, 1))s)" -ForegroundColor Green
    
    # 展開 & パーミッション設定
    Write-Host "   → Extracting & setting permissions..." -ForegroundColor Cyan
    Invoke-SshSafe -Command "$sshBase `"$sshCommandExtract`"" -LogFile $logFile
    Write-Host "   ✓ Extraction & permissions completed" -ForegroundColor Green
    
    # 成功メッセージ
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  ✅ DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "   URL: http://door-fujita.com/contents/$(Split-Path $remoteDir -Leaf)/" -ForegroundColor Cyan
}
catch {
    Write-Error "Deployment failed: $_"
    exit 1
}
finally {
    if (Test-Path $archiveName) { 
        Remove-Item $archiveName 
    }
}
