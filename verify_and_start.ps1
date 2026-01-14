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
function Ensure-Port-Free {
    param([int]$Port, [string]$Name)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conn) {
        Write-Status "$Name Port $Port is busy. Attempting to clear..." "Yellow"
        try {
            Stop-Process -Id $conn.OwningProcess -Force
            Start-Sleep -Seconds 1
            Write-Status "Cleared port $Port." "Green"
        }
        catch {
            Write-Status "Failed to clear port $Port. Process ID: $($conn.OwningProcess)" "Red"
            exit 1
        }
    }
}

Ensure-Port-Free -Port $PHP_PORT -Name "Backend"
Ensure-Port-Free -Port $VITE_PORT -Name "Frontend"

# --- Phase 2: Launch ---

# 1. Start Backend
Write-Status "Starting PHP Backend ($PHP_HOST`:$PHP_PORT)..." "Cyan"
$phpJob = Start-Job -ScriptBlock {
    param($h, $p, $path)
    Set-Location $path
    php -S "$($h):$($p)" -t .
} -ArgumentList $PHP_HOST, $PHP_PORT, (Join-Path $PWD "backend")

# 2. Start Frontend
Write-Status "Starting Vite Frontend..." "Cyan"
# Vite is interactive, so we launch it in a new window or use Start-Process used carefully
# For dev experience, we usually want Vite output visible. 
# But for strict automation, let's use Start-Process.
# To keep it simple for this script, we'll launch it as a background job or separate process.
# Ideally, "npm run dev" opens a persistent process.
$viteProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory (Join-Path $PWD "JWCADTategu.Web") -PassThru -NoNewWindow

# --- Phase 3: Verification ---

Write-Status "Waiting for services to be healthy..." "Yellow"

# Verify Backend
$backendReady = $false
for ($i = 0; $i -lt 10; $i++) {
    try {
        $res = Invoke-RestMethod -Uri "http://$PHP_HOST`:$PHP_PORT/health.php" -Method Get -ErrorAction Stop
        if ($res.status -eq "ok") {
            $backendReady = $true
            break
        }
    }
    catch {
        Start-Sleep -Seconds 1
    }
}

if (-not $backendReady) {
    Write-Status "❌ Backend failed to start or verify." "Red"
    Stop-Job $phpJob
    Stop-Process -Id $viteProcess.Id -Force
    exit 1
}

Write-Status "✅ Backend Ready." "Green"

# Verify Frontend (Simple TCP connect or wait a bit)
# Vite takes a moment. We'll assume it's coming up if process is alive.
if ($viteProcess.HasExited) {
    Write-Status "❌ Frontend process exited unexpectedly." "Red"
    Stop-Job $phpJob
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
Stop-Job $phpJob
Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
Write-Status "Goodbye." "Cyan"
