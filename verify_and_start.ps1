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
$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $backendPath)) {
    Write-Status "❌ Backend directory not found at $backendPath" "Red"
    exit 1
}

Write-Status "Starting PHP Backend ($PHP_HOST`:$PHP_PORT) in $backendPath..." "Cyan"
$phpJob = Start-Job -ScriptBlock {
    param($h, $p, $path)
    Set-Location $path
    php -S "$($h):$($p)" -t .
} -ArgumentList $PHP_HOST, $PHP_PORT, $backendPath

# 2. Start Frontend
Write-Status "Starting Vite Frontend..." "Cyan"
# Use npm.cmd for better Windows compatibility
$viteProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev" -WorkingDirectory (Join-Path $PSScriptRoot "JWCADTategu.Web") -PassThru -NoNewWindow

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
