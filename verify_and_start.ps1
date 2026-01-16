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

Write-Status "🚀 SVP v3.0: Starting Development Environment..." "Cyan"

# --- Phase 1: Diagnosis & Self-Healing ---

# Helper to check and kill port
# Helper to check and kill port with retry logic
function Ensure-Port-Free {
    param([int]$Port, [string]$Name)
    
    $MaxRetries = 5
    $RetryDelay = 2

    for ($i = 0; $i -lt $MaxRetries; $i++) {
        $conns = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue

        # Filter out connections that are already closed or invalid
        # But TimeWait (State=11 or similar) might block binding depending on OS config.
        # However, we cannot Kill PID 0.
        
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
                    Write-Status "  Killing PID $processId (State: $($conn.State))..." "Yellow"
                    Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
                }
                catch {
                    Write-Status "  Failed to kill PID $($conn.OwningProcess)." "Red"
                }
            }
        }
        
        if ($systemLocked) {
            Write-Status "  Port $Port is in TimeWait/System use (PID 0). Waiting for release... ($($i+1)/$MaxRetries)" "Cyan"
        }

        Start-Sleep -Seconds $RetryDelay
    }

    # Final Check
    $finalCheck = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($finalCheck) {
        Write-Status "❌ Failed to clear port $Port after retries." "Red"
        Write-Status "  Details:" "Red"
        $finalCheck | Format-Table -AutoSize | Out-String | Write-Host -ForegroundColor Red
        Write-Status "  Please establish manual intervention or wait a moment." "Red"
        exit 1
    }
}

# Cleanup stray Node/PHP processes aggressively
function Cleanup-Stray-Processes {
    Write-Status "Cleaning up stray 'node' and 'php-cgi' processes..." "Yellow"
    # Note: This is aggressive. It assumes this dev environment is the primary user of node/php for this user context.
    # To be safer, we could filter by command line, but Get-Process doesn't always show command line easily in simple PS.
    # We will rely on Port clearing mainly, but adding a specific check for known leaked processes can help.
}

Ensure-Port-Free -Port $PHP_PORT -Name "Backend"
Ensure-Port-Free -Port $VITE_PORT -Name "Frontend"

# --- Phase 2: Launch ---

# 1. Start Backend
$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $backendPath)) {
    Write-Status "❌ Backend directory not found at $backendPath" "Red"
    exit 1
}

Write-Status "Starting PHP Backend ($PHP_HOST`:$PHP_PORT) in $backendPath..." "Cyan"
# Use Start-Process with explicit WorkingDirectory to ensure relative paths (require/include) work correctly.
# Also passing absolute path to router script as a standard practice.
$phpProcess = Start-Process -FilePath "php" -ArgumentList "-S $PHP_HOST`:$PHP_PORT -t `"$backendPath`" `"$backendPath\index.php`"" -WorkingDirectory $backendPath -PassThru -NoNewWindow

# 2. Start Frontend
Write-Status "Starting Vite Frontend (Strict Port $VITE_PORT)..." "Cyan"
# Use npm.cmd for better Windows compatibility. Add -- --strictPort to fail if port is busy (prevent multi-run confusion)
$viteProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev -- --port $VITE_PORT --strictPort" -WorkingDirectory (Join-Path $PSScriptRoot "JWCADTategu.Web") -PassThru -NoNewWindow

# --- Phase 3: Verification ---

Write-Status "Waiting for services to be healthy..." "Yellow"

# Verify Backend
$backendReady = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        # Ensure we get JSON
        $res = Invoke-RestMethod -Uri "http://$PHP_HOST`:$PHP_PORT/health.php" -Method Get -ErrorAction Stop
        
        # Check if response acts like an object with 'status' property
        if ($res -is [PSCustomObject] -and $res.status -eq "ok") {
            $backendReady = $true
            break
        }
        else {
            Write-Host "." -NoNewline
        }
    }
    catch {
        Write-Host "." -NoNewline
        Start-Sleep -Seconds 1
    }
}
Write-Host "" # Newline

if (-not $backendReady) {
    Write-Status "❌ Backend failed to start or returned invalid response." "Red"
    Write-Status "   (Check if another service is on port $PHP_PORT or if PHP is failing)" "Red"
    Stop-Process -Id $phpProcess.Id -Force
    Stop-Process -Id $viteProcess.Id -Force
    exit 1
}

Write-Status "✅ Backend Ready." "Green"

# Verify Frontend (Simple TCP connect or wait a bit)
# Vite takes a moment. We'll assume it's coming up if process is alive.
if ($viteProcess.HasExited) {
    Write-Status "❌ Frontend process exited unexpectedly." "Red"
    Stop-Process -Id $phpProcess.Id -Force
    exit 1
}

Write-Status "✅ Frontend Launching..." "Green"

# --- Phase 4: Ready ---

Write-Status "----------------------------------------" "Green"
Write-Status "🎉 SVP v3.0: Environment Ready!" "Green"
Write-Status "   Backend : http://$PHP_HOST`:$PHP_PORT"
Write-Status "   Frontend: http://localhost:$VITE_PORT"
Write-Status "----------------------------------------" "Green"

# Keep script running to maintain PHP job? 
# Jobs run in background. If this script exits, jobs might be cleaned up depending on context.
# We should probably wait for user input to stop.

Write-Host "Press any key to stop servers..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Status "Stopping servers..." "Yellow"
Stop-Process -Id $phpProcess.Id -Force
Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
Write-Status "Goodbye." "Cyan"
