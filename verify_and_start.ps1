param (
    [string]$PHP_HOST = "127.0.0.1",
    [int]$PHP_PORT = 8005,
    [int]$VITE_PORT = 5173
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Msg, [string]$Color = "White")
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $Msg" -ForegroundColor $Color
}

Write-Status "🚀 SVP v3.1: 開発環境を起動します（自己修復モード）..." "Cyan"

# --- Phase 1: Diagnosis & Self-Healing ---

# Helper to check and kill processes on port
function Ensure-Port-Free {
    param([int]$Port, [string]$Name)
    
    $MaxRetries = 10
    $RetryDelay = 2

    for ($i = 0; $i -lt $MaxRetries; $i++) {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

        if (-not $conns) {
            Write-Status "✅ Port $Port is free." "Green"
            return
        }

        # Identify killable processes (PID > 0)
        $killable = $conns | Where-Object { $_.OwningProcess -gt 0 }
        $systemLocked = $conns | Where-Object { $_.OwningProcess -eq 0 }

        if ($killable) {
            Write-Status "$Name Port $Port is busy. Killing processes..." "Yellow"
            foreach ($conn in $killable) {
                try {
                    $processId = $conn.OwningProcess
                    $proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
                    if ($proc) {
                        Write-Status "  Killing '$($proc.ProcessName)' (PID $processId)..." "Yellow"
                        Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                    }
                }
                catch {
                    Write-Status "  Failed to kill PID $($conn.OwningProcess)." "Red"
                }
            }
        }
        
        if ($systemLocked) {
            Write-Status "  Port $Port is in TIME_WAIT/System use (PID 0). Waiting for release... ($($i+1)/$MaxRetries)" "Cyan"
        }

        # If it's taking too long, try aggressive mode
        if ($i -gt 2) {
            Cleanup-Stray-Processes
        }

        Start-Sleep -Seconds $RetryDelay
    }

    # Final Check
    $finalCheck = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($finalCheck) {
        Write-Status "❌ Failed to clear port $Port after retries." "Red"
        Write-Status "  Details:" "Red"
        $finalCheck | Format-Table -AutoSize | Out-String | Write-Host -ForegroundColor Red
        Write-Status "  CRITICAL: Please manually close applications using port $Port." "Red"
        exit 1
    }
}

# Cleanup stray Node/PHP processes aggressively
function Cleanup-Stray-Processes {
    Write-Status "🧹 Performing aggressive cleanup of stray processes..." "Magenta"
    
    # Kill PHP processes
    $phpProcs = Get-Process -Name "php", "php-cgi" -ErrorAction SilentlyContinue
    foreach ($p in $phpProcs) {
        try {
            Write-Status "  - Killing stray PHP (PID $($p.Id))" "Magenta"
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }
        catch {}
    }
}

# --- Cleanup Phase ---
Cleanup-Stray-Processes
Ensure-Port-Free -Port $PHP_PORT -Name "Backend"
Ensure-Port-Free -Port $VITE_PORT -Name "Frontend"

# --- Phase 2: Launch ---
$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $backendPath)) {
    Write-Status "❌ Backend directory not found at $backendPath" "Red"
    exit 1
}

# 1. Start Backend
# Check for existing PHP
$phpProcess = Get-Process php -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*$PHP_HOST*" } | Select-Object -First 1

if ($phpProcess) {
    Write-Status "✅ PHP Backendは既に実行中です (PID: $($phpProcess.Id))" "Green"
}
else {
    Write-Status "🐘 PHP Backendを起動しています (Port $PHP_PORT)..." "Cyan"
    $phpArgList = "-S $PHP_HOST`:$PHP_PORT -t `"$backendPath`" `"$backendPath\index.php`""
    $phpProcess = Start-Process -FilePath "php" -ArgumentList $phpArgList -WorkingDirectory $backendPath -NoNewWindow -PassThru
    Start-Sleep -Seconds 2

    if ($phpProcess.HasExited) {
        Write-Status "❌ PHPの起動に失敗しました。" "Red"
        exit 1
    }
    Write-Status "✅ PHP Backendを開始しました (PID: $($phpProcess.Id))" "Green"
}

# 2. Start Frontend
Write-Status "⚡ Vite Frontendを起動しています..." "Cyan"
    
$npmCmd = "npm.cmd"

# Start Vite in background
$viteProcess = Start-Process -FilePath $npmCmd -ArgumentList "run dev -- --port $VITE_PORT --strictPort" -WorkingDirectory (Join-Path $PSScriptRoot "JWCADTategu.Web") -PassThru -NoNewWindow
    
# Wait for Vite to initialize
Write-Status "Viteの起動待機中 (Port $VITE_PORT)..." "Cyan"

$frontendReady = $false
$retryCount = 0
$maxRetries = 30 

while (-not $frontendReady -and $retryCount -lt $maxRetries) {
    $tcp = Test-NetConnection -ComputerName "localhost" -Port $VITE_PORT -InformationLevel Quiet
    if ($tcp) {
        $frontendReady = $true
        Write-Status "✅ Vite Frontend (Port $VITE_PORT) 接続確認" "Green"
    }
    else {
        Start-Sleep -Seconds 1
        $retryCount++
    }
}

if ($viteProcess.HasExited) {
    Write-Status "❌ Viteの起動に失敗しました。`n   トラブルシュート: 手動で 'npm run dev' を実行してエラーを確認してください。" "Red"
    # Cleanup PHP since we failed
    Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

if (-not $frontendReady) {
    Write-Status "⚠️ Viteの起動に時間がかかっています。ブラウザが接続できない可能性があります。" "Yellow"
}
else {
    Write-Status "✅ Vite Frontendを開始しました (PID: $($viteProcess.Id))" "Green"
}

# --- Phase 3: Verification & Recovery ---

Write-Status "バックエンドのヘルスチェックを待機中..." "Yellow"

$backendReady = $false
$retryCount = 0
$maxRetries = 15

while (-not $backendReady -and $retryCount -lt $maxRetries) {
    try {
        # Try API health endpoint first (routed via index.php)
        $res = Invoke-RestMethod -Uri "http://$PHP_HOST`:$PHP_PORT/api/health" -Method Get -ErrorAction Stop
        if ($res -is [PSCustomObject] -and $res.status -eq "ok") {
            $backendReady = $true
            Write-Status "✅ Backendヘルスチェック成功! (/api/health)" "Green"
        }
    }
    catch {
        # Fallback to direct file check if API fails
        try {
            $res = Invoke-RestMethod -Uri "http://$PHP_HOST`:$PHP_PORT/health.php" -Method Get -ErrorAction Stop
            if ($res -is [PSCustomObject] -and $res.status -eq "ok") {
                $backendReady = $true
                Write-Status "✅ Backendヘルスチェック成功! (/health.php)" "Green"
            }
        }
        catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 1
            $retryCount++
        }
    }
}
Write-Host "" 

if (-not $backendReady) {
    Write-Status "⚠️ Backend unresponsive. Attempting Restart Strategy..." "Red"
    
    # Kill and Retry once
    if ($phpProcess -and $phpProcess.Id) {
        Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue
    }
    Start-Sleep -Seconds 2
    
    Write-Status "🔄 Restarting PHP Backend..." "Cyan"
    $phpProcess = Start-Process -FilePath "php" -ArgumentList "-S $PHP_HOST`:$PHP_PORT -t `"$backendPath`" `"$backendPath\index.php`"" -WorkingDirectory $backendPath -PassThru -NoNewWindow
    
    # Quick check
    Start-Sleep -Seconds 3
    try {
        $res = Invoke-RestMethod -Uri "http://$PHP_HOST`:$PHP_PORT/api/health" -Method Get -ErrorAction Stop
        if ($res -is [PSCustomObject] -and $res.status -eq "ok") {
            $backendReady = $true
            Write-Status "✅ Backend Recovered!" "Green"
        }
    }
    catch {
        Write-Status "❌ Backend failed recovery." "Red"
    }
}

if (-not $backendReady) {
    Write-Status "❌ Critical Failure: Backend could not be started." "Red"
    if ($phpProcess -and $phpProcess.Id) { Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue }
    if ($viteProcess -and $viteProcess.Id) { Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue }
    exit 1
}

# --- Phase 4: Ready ---

Write-Status "----------------------------------------" "Green"
Write-Status "🎉 SVP v3.1: 開発環境が正常に起動しました" "Green"
Write-Status "----------------------------------------" "Green"
Write-Status "   Backend : http://$PHP_HOST`:$PHP_PORT"
Write-Status "   Frontend: http://localhost:$VITE_PORT"
Write-Status "----------------------------------------" "Green"
    
# Ensure browser open
Write-Status "🌍 ブラウザを起動しています (http://localhost:$VITE_PORT)..." "Cyan"
Start-Process "http://localhost:$VITE_PORT"

Write-Host "サーバーを停止するには何かキーを押してください..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Status "サーバーを停止しています..." "Yellow"
if ($phpProcess -and $phpProcess.Id) { Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue }
if ($viteProcess -and $viteProcess.Id) { Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue }
Write-Status "Server stopped." "Cyan"
