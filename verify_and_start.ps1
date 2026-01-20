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

Write-Status "🚀 SVP v3.1: Starting Development Environment (Self-Healing Mode)..." "Cyan"

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

    # Kill Node processes (Only those running vite/npm ideally, but hard to distinguish on Windows PS easily)
    # Caution: This might kill other node apps. But user asked for "Healing".
    # We will skip node aggressive kill for safety unless ports are strictly locked.
}

# --- Cleanup Phase ---
Cleanup-Stray-Processes
Ensure-Port-Free -Port $PHP_PORT -Name "Backend"
Ensure-Port-Free -Port $VITE_PORT -Name "Frontend"

# --- Phase 2: Launch ---

# 1. Start Backend
$backendPath = Join-Path $PSScriptRoot "backend"
if (-not (Test-Path $backendPath)) {
    Write-Status "❌ Backend directory not found at $backendPath" "Red"
    exit 1
}

Write-Status "Starting PHP Backend ($PHP_HOST`:$PHP_PORT)..." "Cyan"
# Use Start-Process
$phpProcess = Start-Process -FilePath "php" -ArgumentList "-S $PHP_HOST`:$PHP_PORT -t `"$backendPath`" `"$backendPath\index.php`"" -WorkingDirectory $backendPath -PassThru -NoNewWindow

# 2. Start Frontend
Write-Status "Starting Vite Frontend (Strict Port $VITE_PORT)..." "Cyan"
$viteProcess = Start-Process -FilePath "npm.cmd" -ArgumentList "run dev -- --port $VITE_PORT --strictPort" -WorkingDirectory (Join-Path $PSScriptRoot "JWCADTategu.Web") -PassThru -NoNewWindow

# --- Phase 3: Verification & Recovery ---

Write-Status "Waiting for backend health check..." "Yellow"

$backendReady = $false
$retryCount = 0
$maxRetries = 15

while (-not $backendReady -and $retryCount -lt $maxRetries) {
    try {
        $res = Invoke-RestMethod -Uri "http://$PHP_HOST`:$PHP_PORT/health.php" -Method Get -ErrorAction Stop
        if ($res -is [PSCustomObject] -and $res.status -eq "ok") {
            $backendReady = $true
            Write-Status "✅ Backend Health Check Passed!" "Green"
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
    Write-Status "⚠️ Backend unresponsive. Attempting Restart Strategy..." "Red"
    
    # Kill and Retry once
    Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 2
    
    Write-Status "🔄 Restarting PHP Backend..." "Cyan"
    $phpProcess = Start-Process -FilePath "php" -ArgumentList "-S $PHP_HOST`:$PHP_PORT -t `"$backendPath`" `"$backendPath\index.php`"" -WorkingDirectory $backendPath -PassThru -NoNewWindow
    
    # Quick check
    Start-Sleep -Seconds 3
    try {
        $res = Invoke-RestMethod -Uri "http://$PHP_HOST`:$PHP_PORT/health.php" -Method Get -ErrorAction Stop
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
    Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue
    Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
    exit 1
}

# --- Phase 4: Ready ---

Write-Status "----------------------------------------" "Green"
Write-Status "🎉 SVP v3.1: Environment Fully Operational" "Green"
Write-Status "----------------------------------------" "Green"
Write-Status "   Backend : http://$PHP_HOST`:$PHP_PORT"
Write-Status "   Frontend: http://localhost:$VITE_PORT"
Write-Status "----------------------------------------" "Green"

Write-Host "Press any key to stop servers..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Status "Stopping servers..." "Yellow"
Stop-Process -Id $phpProcess.Id -Force -ErrorAction SilentlyContinue
Stop-Process -Id $viteProcess.Id -Force -ErrorAction SilentlyContinue
Write-Status "Goodbye." "Cyan"
