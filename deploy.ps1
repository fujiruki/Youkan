$ErrorActionPreference = "Stop"

# Configuration
$serverHost = "www1045.conoha.ne.jp"
$serverUser = "c6924945"
$serverPort = "8022"
# Target Project Directory
$remoteDir = "public_html/door-fujita.com/contents/TateguDesignStudio"
# SSH Key Path (Relative to project root)
$sshKeyPath = "docs/AI_DEVELOP_RULES/UPLOAD/key-2025-11-29-07-10.pem"
$archiveName = "deploy.tar.gz"

Write-Host "🚀 Starting Deployment Process..." -ForegroundColor Cyan
Write-Host "   Server: $serverHost"
Write-Host "   Target: $remoteDir"
Write-Host "   Key   : $sshKeyPath"

# 1. Build Frontend
Write-Host "`n[1/4] Building Frontend..." -ForegroundColor Yellow
if (Test-Path "JWCADTategu.Web") {
    Push-Location "JWCADTategu.Web"
    try {
        npm.cmd run build
        if ($LASTEXITCODE -ne 0) { throw "Build failed" }
    }
    finally {
        Pop-Location
    }
}
else {
    Write-Error "Frontend directory 'JWCADTategu.Web' not found."
    exit 1
}

# 2. Prepare Dist (Merge Backend & Frontend)
Write-Host "`n[2/4] Preparing Distribution Package..." -ForegroundColor Yellow
$deployTmp = "deploy_tmp"
if (Test-Path $deployTmp) { Remove-Item $deployTmp -Recurse -Force }
New-Item -ItemType Directory -Path $deployTmp | Out-Null

# Copy Backend PHP Files & .htaccess
# Copy Backend PHP Files & .htaccess (Preserving Directory Structure)
Copy-Item -Path "backend\*" -Destination $deployTmp -Recurse -Force

# Copy Frontend Assets (from JWCADTategu.Web/dist)
# Copy Frontend Assets (from JWCADTategu.Web/dist) - Exclude 'api' (mocks)
Get-ChildItem "JWCADTategu.Web/dist" -Exclude "api" | Copy-Item -Destination $deployTmp -Recurse -Force

# 3. Create Archive
Write-Host "`n[3/4] Creating Archive ($archiveName)..." -ForegroundColor Yellow
try {
    # Use tar to archive the temporary deploy folder content
    tar -czf $archiveName -C $deployTmp .
    if ($LASTEXITCODE -ne 0) { throw "tar command failed" }
    $size = (Get-Item $archiveName).Length / 1KB
    Write-Host "   ✓ Archive created ($([math]::Round($size, 2)) KB)" -ForegroundColor Green
}
catch {
    Write-Error "Failed to create archive: $_"
    Remove-Item $deployTmp -Recurse -Force
    exit 1
}
finally {
    Remove-Item $deployTmp -Recurse -Force
}

# 4. Upload & Deploy
Write-Host "`n[4/4] Uploading & Deploying to Server..." -ForegroundColor Yellow

# Commands
$scpArgs = @("-o", "StrictHostKeyChecking=no", "-P", $serverPort, "-i", $sshKeyPath, $archiveName, "$serverUser@$serverHost`:$remoteDir/$archiveName")
$sshCommandMkdir = "mkdir -p $remoteDir"
# Extract command: cd -> remove old index.html    # Extract and set permissions (777 for SQLite creation)
$sshCommandExtract = "cd $remoteDir && tar -xzf $archiveName && chmod -R 777 . && rm $archiveName && find . -type d -exec chmod 755 {} + && find . -type f -exec chmod 644 {} +"
$sshArgsExtract = @("-o", "StrictHostKeyChecking=no", "-p", $serverPort, "-i", $sshKeyPath, "$serverUser@$serverHost", $sshCommandExtract)

try {
    # Ensure Directory
    Write-Host "   → Ensuring remote directory..."
    $sshArgsMkdir = @("-o", "StrictHostKeyChecking=no", "-p", $serverPort, "-i", $sshKeyPath, "$serverUser@$serverHost", $sshCommandMkdir)
    & ssh $sshArgsMkdir
    
    # Upload
    Write-Host "   → Uploading..."
    & scp $scpArgs
    
    # Extract & Perms
    Write-Host "   → Extracting & Setting Permissions..."
    & ssh $sshArgsExtract
    
    Write-Host "`n✅ DEPLOYMENT SUCCESSFUL!" -ForegroundColor Green
    Write-Host "   URL: http://door-fujita.com/contents/TateguDesignStudio/" -ForegroundColor Cyan
}
catch {
    Write-Error "Deployment failed: $_"
    exit 1
}
finally {
    if (Test-Path $archiveName) { Remove-Item $archiveName }
}
