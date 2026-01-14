$ErrorActionPreference = "Stop"

# Configuration
$serverHost = "www1045.conoha.ne.jp"
$serverUser = "c6924945"
$serverPort = "8022"
# Using relative path from home directory
$remoteDir = "public_html/door-fujita.com/contents/TateguDesignStudio"
$sshKeyPath = "key-2025-11-29-07-10.pem"
$archiveName = "deploy.tar.gz"

Write-Host "Starting upload process..."
Write-Host "Server: $serverHost"
Write-Host "Target: $remoteDir"
Write-Host "Key: $sshKeyPath"

# 1. Check if dist exists
if (-not (Test-Path "dist")) {
    Write-Error "Error: 'dist' directory not found."
    Write-Error "Please run 'build.bat' first to build the project."
    exit 1
}

# 2. Create archive
Write-Host "`n[1/3] Creating archive ($archiveName)..."
Write-Host "  → Compressing dist directory..." -ForegroundColor Cyan
try {
    # Create tar.gz from dist directory content
    # -C dist . means change to dist directory and archive everything in it
    # This prevents 'dist/' prefix in the archive, so it extracts directly into target
    tar -czf $archiveName -C dist .
    if ($LASTEXITCODE -ne 0) { throw "tar command failed with exit code $LASTEXITCODE" }
    $archiveSize = (Get-Item $archiveName).Length / 1KB
    Write-Host "  ✓ Archive created successfully ($([math]::Round($archiveSize, 2)) KB)" -ForegroundColor Green
}
catch {
    Write-Error "Failed to create archive: $_"
    exit 1
}

# 3. Upload archive and setup
Write-Host "`n[2/3] Uploading and extracting..."

# Create remote directory if not exists
$sshCommandMkdir = "mkdir -p $remoteDir"

# Extract and cleanup command
# 1. Go to remote dir
# 2. Extract archive (verbose)
# 3. List files to verify update
# 4. Remove archive
$sshCommandExtract = "cd $remoteDir && rm -f index.html && tar -xvf $archiveName && echo '--- Extraction Complete ---' && ls -l index.html && rm $archiveName"

# Upload arguments
$scpArgs = @(
    "-o", "StrictHostKeyChecking=no",
    "-P", $serverPort,
    "-i", "$sshKeyPath",
    "$archiveName",
    "$serverUser@$serverHost`:$remoteDir/$archiveName"
)

try {
    # Create remote directory
    Write-Host "  → Ensuring remote directory exists..." -ForegroundColor Cyan
    $sshArgsMkdir = @(
        "-o", "StrictHostKeyChecking=no",
        "-p", $serverPort,
        "-i", "$sshKeyPath",
        "$serverUser@$serverHost",
        $sshCommandMkdir
    )
    & ssh $sshArgsMkdir
    if ($LASTEXITCODE -ne 0) { throw "SSH mkdir failed" }
    Write-Host "  ✓ Remote directory ready" -ForegroundColor Green

    # Upload
    Write-Host "  → Uploading $archiveName to server..." -ForegroundColor Cyan
    $uploadStart = Get-Date
    & scp $scpArgs
    if ($LASTEXITCODE -ne 0) { throw "SCP upload failed" }
    $uploadTime = ((Get-Date) - $uploadStart).TotalSeconds
    Write-Host "  ✓ Upload completed ($([math]::Round($uploadTime, 1))s)" -ForegroundColor Green

    # Extract
    Write-Host "  → Extracting files on server..." -ForegroundColor Cyan
    $sshArgsExtract = @(
        "-o", "StrictHostKeyChecking=no",
        "-p", $serverPort,
        "-i", "$sshKeyPath",
        "$serverUser@$serverHost",
        $sshCommandExtract
    )
    & ssh $sshArgsExtract
    if ($LASTEXITCODE -ne 0) { throw "SSH extract failed" }
    Write-Host "  ✓ Extraction completed" -ForegroundColor Green
}
catch {
    Write-Error "Deployment failed: $_"
    # Cleanup local archive
    if (Test-Path $archiveName) { Remove-Item $archiveName }
    exit 1
}
finally {
    # Cleanup local archive
    if (Test-Path $archiveName) { Remove-Item $archiveName }
}

# 4. Fix permissions
Write-Host "`n[3/3] Fixing permissions..."
Write-Host "  → Setting directory permissions to 755..." -ForegroundColor Cyan
Write-Host "  → Setting file permissions to 644..." -ForegroundColor Cyan
$fixPermsCommand = "find $remoteDir -type d -exec chmod 755 {} + && find $remoteDir -type f -exec chmod 644 {} +"

$sshArgsPerms = @(
    "-o", "StrictHostKeyChecking=no",
    "-p", $serverPort,
    "-i", "$sshKeyPath",
    "$serverUser@$serverHost",
    $fixPermsCommand
)

try {
    & ssh $sshArgsPerms
    if ($LASTEXITCODE -ne 0) { throw "Permission fix command failed" }
    Write-Host "  ✓ Permissions fixed (Dirs: 755, Files: 644)" -ForegroundColor Green
    Write-Host "`n========================================" -ForegroundColor Green
    Write-Host "  DEPLOYMENT COMPLETED SUCCESSFULLY!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
}
catch {
    Write-Warning "Failed to fix permissions: $_"
}
