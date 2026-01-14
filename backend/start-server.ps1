param (
    [string]$ServerHost = "127.0.0.1",
    [int]$Port = 8000
)

Write-Host "Starting PHP Server on $ServerHost`:$Port..." -ForegroundColor Cyan

# 1. Check PHP Version
try {
    $phpVersion = php -r "echo PHP_VERSION;"
    Write-Host "PHP Version: $phpVersion" -ForegroundColor Green
}
catch {
    Write-Error "PHP not found in PATH."
    exit 1
}

# 2. Check Port Availability
$netstat = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($netstat) {
    Write-Warning "Port $Port is already in use. Killing process..."
    Stop-Process -Id $netstat.OwningProcess -Force
    Start-Sleep -Seconds 1
}

# 3. Start Server
$cmd = "php -S $ServerHost`:$Port -t ."
Write-Host "Running: $cmd" -ForegroundColor Gray
Invoke-Expression $cmd
