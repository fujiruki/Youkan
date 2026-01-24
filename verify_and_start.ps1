param (
    [string]$PHP_HOST = "127.0.0.1",
    [int]$PHP_PORT = 8000,
    [int]$VITE_PORT = 5173
)

$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Msg, [string]$Color = "White")
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $Msg" -ForegroundColor $Color
}

Write-Status "🚀 SVP v3.2: 開発環境をスマートに起動します（順次起動・自動修復）..." "Cyan"

# --- Phase 1: Aggressive Cleanup ---

function Cleanup-Stray-Processes {
    Write-Status "🧹 クリーンアップを実行中..." "Magenta"
    
    # Force kill using taskkill for reliability
    $processes = @("php.exe", "node.exe")
    foreach ($proc in $processes) {
        $running = Get-Process $proc.Replace(".exe", "") -ErrorAction SilentlyContinue
        if ($running) {
            Write-Status "  - Killing $($running.Count) process(es) of $proc" "Magenta"
            try {
                # PowerShell native kill first
                $running | Stop-Process -Force -ErrorAction SilentlyContinue
                
                # Fallback to taskkill if still alive
                Start-Sleep -Milliseconds 500
                if (Get-Process $proc.Replace(".exe", "") -ErrorAction SilentlyContinue) {
                    Write-Status "  - Using taskkill for stubborn $proc..." "Red"
                    Start-Process "taskkill" -ArgumentList "/F /IM $proc" -NoNewWindow -Wait
                }
            }
            catch {}
        }
    }
}

# Helper to check if port is actually free
function Wait-For-Port-Release {
    param([int]$Port, [string]$Name)
    
    Write-Status "⏳ $Name (Port $Port) の解放を確認中..." "Yellow"
    for ($i = 0; $i -lt 10; $i++) {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
        if (-not $conns) {
            Write-Status "✅ Port $Port is free." "Green"
            return
        }
        Start-Sleep -Seconds 1
    }
    Write-Status "❌ Port $Port が解放されません。別のプロセスが使用している可能性があります。" "Red"
    # Don't exit, try to proceed, maybe it will work or fail clearly later
}

# --- Execution Phase ---

# 1. Clean Slate
Cleanup-Stray-Processes
Wait-For-Port-Release -Port $PHP_PORT -Name "Backend"
Wait-For-Port-Release -Port $VITE_PORT -Name "Frontend"

$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $backendPath)) {
    Write-Status "❌ Backend directory not found at $backendPath" "Red"
    exit 1
}

# 2. Start Backend (Priority 1)
Write-Status "🐘 [1/2] PHP Backendを起動しています (Port $PHP_PORT)..." "Cyan"
$phpArgList = "-S $PHP_HOST`:$PHP_PORT -t `"$backendPath`" `"$backendPath\index.php`""
$phpProcess = Start-Process -FilePath "php" -ArgumentList $phpArgList -WorkingDirectory $backendPath -NoNewWindow -PassThru
Start-Sleep -Seconds 1

if ($phpProcess.HasExited) {
    Write-Status "❌ PHPの起動に即座に失敗しました。" "Red"
    exit 1
}

# 3. Verify Backend (Blocking)
Write-Status "🩺 Backendの起動を確認しています..." "Yellow"
$backendReady = $false
$retryCount = 0
$maxRetries = 10

while (-not $backendReady -and $retryCount -lt $maxRetries) {
    try {
        # Try direct health check via file to ensure PHP is serving
        $res = Invoke-RestMethod -Uri "http://$PHP_HOST`:$PHP_PORT/health.php" -Method Get -ErrorAction Stop
        if ($res.status -eq "ok") {
            $backendReady = $true
            Write-Status "✅ Backend Ready! (PID: $($phpProcess.Id))" "Green"
        }
    }
    catch {
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 1
        $retryCount++
    }
}
Write-Host ""

if (-not $backendReady) {
    Write-Status "❌ Backendが応答しません。起動を中止します。" "Red"
    Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# 4. Start Frontend (Priority 2 - Only after Backend is ready)
Write-Status "⚡ [2/2] Vite Frontendを起動しています..." "Cyan"
    
$npmCmd = "npm.cmd"
# Use --strictPort to fail if port is taken, preventing confusion
$viteProcess = Start-Process -FilePath $npmCmd -ArgumentList "run dev -- --port $VITE_PORT --strictPort" -WorkingDirectory (Join-Path $PSScriptRoot "JWCADTategu.Web") -PassThru -NoNewWindow

# 5. Verify Frontend
Write-Status "🩺 Frontendの起動を待機中..." "Yellow"
$frontendReady = $false
$retryCount = 0
$maxRetries = 30 

while (-not $frontendReady -and $retryCount -lt $maxRetries) {
    try {
        $tcp = Test-NetConnection -ComputerName "localhost" -Port $VITE_PORT -InformationLevel Quiet
        if ($tcp) {
            $frontendReady = $true
            Write-Status "✅ Frontend Ready! (PID: $($viteProcess.Id))" "Green"
        }
        else {
            Start-Sleep -Seconds 1
            $retryCount++
        }
    }
    catch {
        Start-Sleep -Seconds 1
        $retryCount++
    }
}

if (-not $frontendReady) {
    Write-Status "❌ Frontendの起動タイムアウト。ログを確認してください。" "Red"
    Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue
    if (-not $viteProcess.HasExited) { Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue }
    exit 1
}

# --- Phase 4: Ready & Monitor ---

Write-Status "----------------------------------------" "Green"
Write-Status "🎉 SVP v3.2: 開発環境 全システム稼働中" "Green"
Write-Status "----------------------------------------" "Green"
Write-Status "   Backend : http://$PHP_HOST`:$PHP_PORT (Verified)"
Write-Status "   Frontend: http://localhost:$VITE_PORT (Verified)"
Write-Status "----------------------------------------" "Green"
    
# Ensure browser open
Write-Status "🌍 ブラウザを起動します..." "Cyan"
Start-Process "http://localhost:$VITE_PORT"

Write-Host "サーバーを停止するには何かキーを押してください..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Status "サーバーを停止しています..." "Yellow"
if ($phpProcess -and -not $phpProcess.HasExited) { Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue }
if ($viteProcess -and -not $viteProcess.HasExited) { Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue }
Write-Status "Server stopped." "Cyan"

