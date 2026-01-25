# svp.ps1 (Launcher)
# ASCII only - Safe from encoding issues
$Source = ".\verify_and_start.ps1"
$Runner = ".\.svp_runner.ps1"

# Convert to BOM-UTF8 automatically
Get-Content $Source -Encoding UTF8 | Set-Content $Runner -Encoding UTF8

# Run with protection
Write-Host "Launcher: Launching SVP..." -ForegroundColor Cyan
powershell -ExecutionPolicy Bypass -File $Runner

# Cleanup
Remove-Item $Runner -ErrorAction SilentlyContinue
