# SVP v4.0: Autonomous & Robust Server Starter
# Features:
# - Encoding Safety: Enforces UTF-8 for console output
# - Connection Agnostic: Binds PHP to 0.0.0.0 to support all interfaces
# - Fail-Open Logic: Tolerates health check timeouts if port is open (Zombie-proof)
# - Self-Diagnosis: Automatically prints bad logs on failure

param (
    [string]$PHP_HOST = "0.0.0.0",  # Bind to all interfaces by default
    [int]$PHP_PORT = 8000,
    [int]$VITE_PORT = 5173
)

# --- 0. Encoding Safety ---
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

function Write-Status {
    param([string]$Msg, [string]$Color = "White")
    Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] $Msg" -ForegroundColor $Color
}

Write-Status "🚀 SVP v4.0: Starting Smart Verification Protocol (Robust Mode)..." "Cyan"

# --- 1. ポート占有プロセスの特定とキル ---

function Kill-Port-Owner {
    param([int]$Port, [string]$Name)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if (-not $conn) {
        Write-Status "✅ Port $Port ($Name) is free." "Green"
        return $false  # キル不要
    }
    $pids = $conn.OwningProcess | Select-Object -Unique
    foreach ($p in $pids) {
        $procName = (Get-Process -Id $p -ErrorAction SilentlyContinue).ProcessName
        Write-Status "  → Killing PID $p ($procName) on port $Port" "Magenta"
        Stop-Process -Id $p -Force -ErrorAction SilentlyContinue
    }
    # 解放待ち (10秒)
    for ($i = 0; $i -lt 10; $i++) {
        if (-not (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' })) {
            Write-Status "✅ Port $Port released." "Green"
            return $true  # キル成功
        }
        Start-Sleep -Seconds 1
    }
    Write-Status "❌ Port $Port could not be released after 10s." "Red"
    throw "Port $Port is stuck. Manual intervention required."
}

# --- 1b. 既存サーバーの再利用チェック ---

function Test-ExistingServer {
    param([int]$Port, [string]$HealthUrl, [string]$Name)
    # ポートが開いていない場合は起動必要
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
    if (-not $conn) { return $false }
    
    # ポートが開いているなら health check
    try {
        $res = Invoke-RestMethod -Uri $HealthUrl -Method Get -TimeoutSec 3 -ErrorAction Stop
        if ($res.status -in @("ok", "degraded")) {
            Write-Status "✅ $Name already running & healthy (Status: $($res.status)). Reusing." "Green"
            return $true
        }
    }
    catch {}
    
    # ポートは開いているが health check 失敗 → ゾンビプロセスをキル
    Write-Status "⚠️ $Name port $Port is occupied but unhealthy. Killing owner..." "Yellow"
    Kill-Port-Owner -Port $Port -Name $Name
    return $false
}

# --- Execution Phase ---

$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $backendPath)) {
    Write-Status "❌ Backend directory not found at $backendPath" "Red"
    exit 1
}

# --- 2. Backend: 既存チェック → 必要なら起動 ---
$backendAlreadyRunning = Test-ExistingServer -Port $PHP_PORT -HealthUrl "http://127.0.0.1:${PHP_PORT}/health.php" -Name "Backend"

if (-not $backendAlreadyRunning) {
    Write-Status "🐘 [1/2] Starting PHP Backend (${PHP_HOST}:${PHP_PORT})..." "Cyan"
    # Use 0.0.0.0 to avoid localhost ipv4/ipv6 ambiguity
    $phpArgs = @("-S", "${PHP_HOST}:${PHP_PORT}", "router.php") 
    $phpProcess = Start-Process -FilePath "php" -ArgumentList $phpArgs -WorkingDirectory $backendPath -NoNewWindow -PassThru -RedirectStandardOutput "server_stdout.txt" -RedirectStandardError "server_stderr.txt"
    Start-Sleep -Seconds 2 # Allow socket to bind

    if (-not $phpProcess -or $phpProcess.HasExited) {
        Write-Status "❌ PHP failed to start immediately." "Red"
        # Self-Diagnosis: Dump log if possible
        Get-Content (Join-Path $backendPath "php_errors.log") -Tail 10 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "  LOG> $_" -ForegroundColor DarkGray }
        exit 1
    }
}
else {
    # 既存プロセスのPIDを取得（Keep-Aliveループ用）
    $conn = Get-NetTCPConnection -LocalPort $PHP_PORT -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' } | Select-Object -First 1
    $phpProcess = Get-Process -Id $conn.OwningProcess -ErrorAction SilentlyContinue
}

# --- 3. Verify Backend (skip if already validated) ---
if (-not $backendAlreadyRunning) {
    Write-Status "🩺 Verifying Backend Health..." "Yellow"
    $backendReady = $false
    $retryCount = 0
    $maxRetries = 20

    while (-not $backendReady -and $retryCount -lt $maxRetries) {
        try {
            $res = Invoke-RestMethod -Uri "http://127.0.0.1:$PHP_PORT/health.php" -Method Get -ErrorAction Stop -TimeoutSec 2
            if ($res.status -in @("ok", "degraded")) {
                $backendReady = $true
                $statusMsg = "✅ Backend Ready! (Status: $($res.status))"
                if ($res.status -eq "degraded") { Write-Status $statusMsg "Yellow" } else { Write-Status $statusMsg "Green" }
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
        if (-not $phpProcess.HasExited) {
            Write-Status "⚠️ Backend Health Check Timed Out, BUT Process is Alive." "Yellow"
            Write-Status "   -> Assuming 'Degraded' state and proceeding (Fail-Open)." "Yellow"
        }
        else {
            Write-Status "❌ Backend Process Died." "Red"
            Get-Content (Join-Path $backendPath "php_errors.log") -Tail 10 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "   LOG> $_" -ForegroundColor DarkGray }
            exit 1
        }
    }
}

# --- 4. Frontend: 既存チェック → 必要なら起動 ---
$frontendAlreadyRunning = $false
$viteConn = Get-NetTCPConnection -LocalPort $VITE_PORT -ErrorAction SilentlyContinue | Where-Object { $_.State -eq 'Listen' }
if ($viteConn) {
    Write-Status "✅ Frontend already running on port $VITE_PORT. Reusing." "Green"
    $frontendAlreadyRunning = $true
}

if (-not $frontendAlreadyRunning) {
    Write-Status "⚡ [2/2] Starting Vite Frontend..." "Cyan"
    $npmCmd = "npm.cmd"
    # [FIX] --host 127.0.0.1 を強制: 未指定だと IPv6 等にバインドされ 127.0.0.1 から到達不能になる
    $viteProcess = Start-Process -FilePath $npmCmd -ArgumentList "run dev -- --port $VITE_PORT --host 127.0.0.1" -WorkingDirectory (Join-Path $PSScriptRoot "JWCADTategu.Web") -PassThru -NoNewWindow
}

# 5. Verify Frontend (HTTP-level check, skip if already running)
if (-not $frontendAlreadyRunning) {
    Write-Status "🩺 Waiting for Frontend (HTTP-level verification)..." "Yellow"
    $frontendReady = $false
    $retryCount = 0
    $maxRetries = 30

    while (-not $frontendReady -and $retryCount -lt $maxRetries) {
        try {
            # [FIX] TCP ポートチェックではなく HTTP GET で実際に到達可能か確認
            $response = Invoke-WebRequest -Uri "http://127.0.0.1:$VITE_PORT" -Method Head -TimeoutSec 2 -ErrorAction Stop -UseBasicParsing
            if ($response.StatusCode -lt 500) {
                $frontendReady = $true
                Write-Status "✅ Frontend Ready! (HTTP $($response.StatusCode))" "Green"
            }
        }
        catch {
            Write-Host "." -NoNewline
            Start-Sleep -Seconds 1
            $retryCount++
        }
    }
    Write-Host ""

    if (-not $frontendReady) {
        Write-Status "❌ Frontend HTTP verification failed after ${maxRetries}s." "Red"
        Write-Status "   Possible causes:" "Yellow"
        Write-Status "   - Vite not bound to 127.0.0.1 (check --host option)" "Yellow"
        Write-Status "   - Port $VITE_PORT occupied by another process" "Yellow"
        Write-Status "   - Build errors preventing dev server startup" "Yellow"
        exit 1
    }
}

# --- Phase 4: Ready ---
Write-Status "----------------------------------------" "Green"
Write-Status "🎉 SVP v4.0: Development Environment Online" "Green"
Write-Status "----------------------------------------" "Green"
Write-Status "   Backend : http://127.0.0.1:$PHP_PORT"
Write-Status "   Frontend: http://localhost:$VITE_PORT"
Write-Status "----------------------------------------" "Green"

# Keep alive loop
while ($true) {
    if ($phpProcess.HasExited) {
        Write-Status "⚠️ Backend process stopped unexpectedly!" "Red"
        break
    }
    Start-Sleep -Seconds 5
}
