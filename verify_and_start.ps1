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

# --- 1. Aggressive Cleanup ---

function Cleanup-Stray-Processes {
    Write-Status "🧹 Cleaning up stray processes..." "Magenta"
    $processes = @("php.exe", "node.exe")
    foreach ($proc in $processes) {
        $running = Get-Process $proc.Replace(".exe", "") -ErrorAction SilentlyContinue
        if ($running) {
            Write-Status "  - Killing $($running.Count) process(es) of $proc" "Magenta"
            try {
                $running | Stop-Process -Force -ErrorAction SilentlyContinue
                # Fallback to taskkill for stubborn processes
                Start-Sleep -Milliseconds 200
                if (Get-Process $proc.Replace(".exe", "") -ErrorAction SilentlyContinue) {
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
    Write-Status "⏳ Waiting for port $Port ($Name) to release..." "Yellow"
    for ($i = 0; $i -lt 5; $i++) {
        # Retry 5 times
        if (-not (Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue)) {
            Write-Status "✅ Port $Port is free." "Green"
            return
        }
        Start-Sleep -Seconds 1
    }
    Write-Status "⚠️ Port $Port might still be in use. Proceeding anyway (Fail-Open)..." "Yellow"
}

# --- Execution Phase ---

Cleanup-Stray-Processes
Wait-For-Port-Release -Port $PHP_PORT -Name "Backend"
Wait-For-Port-Release -Port $VITE_PORT -Name "Frontend"

$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $backendPath)) {
    Write-Status "❌ Backend directory not found at $backendPath" "Red"
    exit 1
}

# --- 2. Start Backend (Robust Binding) ---
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

# --- 3. Verify Backend (Fail-Open Tolerant) ---
Write-Status "🩺 Verifying Backend Health..." "Yellow"
$backendReady = $false
$retryCount = 0
$maxRetries = 20

while (-not $backendReady -and $retryCount -lt $maxRetries) {
    try {
        # Check localhost (127.0.0.1) explicitly for health check
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

# FAIL-OPEN LOGIC
if (-not $backendReady) {
    # Check if process is strictly alive
    if (-not $phpProcess.HasExited) {
        Write-Status "⚠️ Backend Health Check Timed Out, BUT Process is Alive." "Yellow"
        Write-Status "   -> Assuming 'Degraded' state and proceeding to Frontend (Fail-Open)." "Yellow"
        
        # Self-Diagnosis: Why did it fail?
        Write-Status "📝 [Self-Diagnosis] Recent PHP Errors:" "Magenta"
        Get-Content (Join-Path $backendPath "php_errors.log") -Tail 5 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "   LOG> $_" -ForegroundColor DarkGray }
    }
    else {
        Write-Status "❌ Backend Process Died." "Red"
        # Self-Diagnosis
        Get-Content (Join-Path $backendPath "php_errors.log") -Tail 10 -ErrorAction SilentlyContinue | ForEach-Object { Write-Host "   LOG> $_" -ForegroundColor DarkGray }
        exit 1
    }
}

# --- 4. Start Frontend ---
Write-Status "⚡ [2/2] Starting Vite Frontend..." "Cyan"
$npmCmd = "npm.cmd"
$viteProcess = Start-Process -FilePath $npmCmd -ArgumentList "run dev -- --port $VITE_PORT" -WorkingDirectory (Join-Path $PSScriptRoot "JWCADTategu.Web") -PassThru -NoNewWindow

# 5. Verify Frontend
Write-Status "🩺 Waiting for Frontend..." "Yellow"
$frontendReady = $false
$retryCount = 0
$maxRetries = 30

while (-not $frontendReady -and $retryCount -lt $maxRetries) {
    try {
        $tcp = Test-NetConnection -ComputerName "localhost" -Port $VITE_PORT -InformationLevel Quiet
        if ($tcp) {
            $frontendReady = $true
            Write-Status "✅ Frontend Ready!" "Green"
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
    Write-Status "❌ Frontend Startup Timeout." "Red"
    # Don't kill backend, leave it for manual inspection
    exit 1
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
