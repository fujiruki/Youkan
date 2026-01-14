# JBWOS Backend Server Launcher
# 一貫性のあるサーバー起動とヘルスチェック

param(
    [string]$Host = "0.0.0.0",
    [int]$Port = 8000
)

Write-Host "==================================" -ForegroundColor Cyan
Write-Host " JBWOS Backend Server Launcher" -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan
Write-Host ""

# 1. ポート確認
Write-Host "[1/3] Checking port availability..." -ForegroundColor Yellow
$portCheck = netstat -ano | Select-String ":$Port"
if ($portCheck) {
    Write-Host "  ⚠️  Port $Port is already in use:" -ForegroundColor Red
    Write-Host "  $portCheck" -ForegroundColor Gray
    Write-Host ""
    $continue = Read-Host "  Kill existing process? (y/N)"
    if ($continue -eq "y") {
        Get-Process | Where-Object {$_.ProcessName -eq "php"} | Stop-Process -Force
        Write-Host "  ✅ Killed PHP processes" -ForegroundColor Green
        Start-Sleep -Seconds 1
    } else {
        Write-Host "  ❌ Aborted" -ForegroundColor Red
        exit 1
    }
}

# 2. データベース確認
Write-Host "[2/3] Checking database..." -ForegroundColor Yellow
$dbPath = "backend\jbwos.sqlite"
if (Test-Path $dbPath) {
    $dbSize = (Get-Item $dbPath).Length
    Write-Host "  ✅ Database found ($dbSize bytes)" -ForegroundColor Green
} else {
    Write-Host "  ℹ️  Database will be created on first request" -ForegroundColor Gray
}

# 3. サーバー起動
Write-Host "[3/3] Starting PHP server..." -ForegroundColor Yellow
Write-Host "  Host: $Host" -ForegroundColor Cyan
Write-Host "  Port: $Port" -ForegroundColor Cyan
Write-Host "  Root: backend/" -ForegroundColor Cyan
Write-Host ""
Write-Host "=================================================================================" -ForegroundColor Green
Write-Host "  Server is running at http://localhost:$Port" -ForegroundColor Green
Write-Host "  Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host "=================================================================================" -ForegroundColor Green
Write-Host ""

# JSONシグナル出力（SVP準拠）
Write-Host "{`"SVP_SIGNAL`": {`"status`": `"running`", `"port`": $Port, `"url`": `"http://localhost:$Port`"}}"

# サーバー起動
php -S "${Host}:${Port}" -t backend
