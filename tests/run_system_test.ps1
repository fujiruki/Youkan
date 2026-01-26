# tests/run_system_test.ps1
$ErrorActionPreference = "Stop"

$baseUrl = "http://localhost:8000" # Local Dev Server
# $baseUrl = "https://door-fujita.com/contents/TateguDesignStudio" # Production (Comment out to use)

Write-Host "=== Tategu Design Studio System Test ===" -ForegroundColor Cyan
Write-Host "Target: $baseUrl" -ForegroundColor Gray

# 1. Login (Get Token)
Write-Host "`n[1] Authenticaton..."
$loginBody = @{
    email    = "debug@example.com"
    password = "password"
} | ConvertTo-Json

try {
    $loginRes = Invoke-RestMethod -Uri "$baseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $token = $loginRes.token
    $headers = @{ "Authorization" = "Bearer $token" }
    Write-Host "   PASS: Login Successful (User: $($loginRes.user.name))" -ForegroundColor Green
}
catch {
    Write-Host "   FAIL: Login Failed. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Project CRUD
Write-Host "`n[2] Project CRUD..."
$prjId = "test-prj-" + (Get-Date -Format "yyyyMMddHHmmss")
$prjBody = @{
    id       = $prjId
    name     = "System Test Project"
    settings = @{ type = "general" }
} | ConvertTo-Json

# Create
try {
    $createRes = Invoke-RestMethod -Uri "$baseUrl/api/projects" -Method Post -Body $prjBody -ContentType "application/json" -Headers $headers
    if ($createRes.id -eq $prjId) {
        Write-Host "   PASS: Project Created" -ForegroundColor Green
    }
    else {
        throw "ID mismatch"
    }
}
catch {
    Write-Host "   FAIL: Project Creation Failed. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Read (Verify Persistence)
try {
    $getRes = Invoke-RestMethod -Uri "$baseUrl/api/projects/$prjId" -Method Get -Headers $headers
    if ($getRes.name -eq "System Test Project") {
        Write-Host "   PASS: Project Persistence Verified" -ForegroundColor Green
    }
    else {
        throw "Name mismatch"
    }
}
catch {
    Write-Host "   FAIL: Project Read Failed. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Delete
try {
    $delRes = Invoke-RestMethod -Uri "$baseUrl/api/projects/$prjId" -Method Delete -Headers $headers
    Write-Host "   PASS: Project Deleted" -ForegroundColor Green
}
catch {
    Write-Host "   FAIL: Project Delete Failed. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Task CRUD (Items)
Write-Host "`n[3] Task CRUD..."
$taskId = "test-task-" + (Get-Date -Format "yyyyMMddHHmmss")
$taskBody = @{
    id     = $taskId
    title  = "System Test Task"
    status = "inbox"
    type   = "task"
} | ConvertTo-Json

# Create
try {
    $createTaskRes = Invoke-RestMethod -Uri "$baseUrl/api/items" -Method Post -Body $taskBody -ContentType "application/json" -Headers $headers
    if ($createTaskRes.id -eq $taskId) {
        Write-Host "   PASS: Task Created" -ForegroundColor Green
    }
    else {
        throw "ID mismatch"
    }
}
catch {
    Write-Host "   FAIL: Task Creation Failed. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Read (Verify Persistence)
try {
    $getTaskRes = Invoke-RestMethod -Uri "$baseUrl/api/items/$taskId" -Method Get -Headers $headers
    if ($getTaskRes.title -eq "System Test Task") {
        Write-Host "   PASS: Task Persistence Verified" -ForegroundColor Green
    }
    else {
        throw "Title mismatch"
    }
}
catch {
    Write-Host "   FAIL: Task Read Failed. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Delete
try {
    $delTaskRes = Invoke-RestMethod -Uri "$baseUrl/api/items/$taskId" -Method Delete -Headers $headers
    Write-Host "   PASS: Task Deleted" -ForegroundColor Green
}
catch {
    Write-Host "   FAIL: Task Delete Failed. $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n=== All System Tests Passed ===" -ForegroundColor Cyan
