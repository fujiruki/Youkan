$ErrorActionPreference = "Stop"
$sshKeyPath = "docs/01_RULES/UPLOAD/key-2025-11-29-07-10.pem"
$commonSshOptions = @("-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=10")
$sshArgs = $commonSshOptions + @("-p", "8022", "-i", $sshKeyPath, "c6924945@www1045.conoha.ne.jp", "echo Connection OK")

Write-Host "Running ssh..."
try {
    $out = & ssh $sshArgs 2>&1
    Write-Host "Output Received: $($out -join "`n")"
    Write-Host "LASTEXITCODE: $LASTEXITCODE"
}
catch {
    Write-Host "Caught Exception: $($_.Exception.Message)"
}
