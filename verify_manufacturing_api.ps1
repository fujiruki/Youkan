# verify_manufacturing_api.ps1
# Phase 4 Verification Script

$baseUrl = "http://localhost:8005/api"
$email = "manager@example.com"
$password = "password123"

# 1. Login
Write-Host "--- 1. Login ---" -ForegroundColor Cyan
$loginBody = @{ email = $email; password = $password }
$loginJson = $loginBody | ConvertTo-Json
$loginRes = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginJson -ContentType "application/json"
$token = $loginRes.token
Write-Host "Logged in as $($loginRes.user.name)"

$headers = @{
    "Authorization" = "Bearer $token"
    "Content-Type"  = "application/json"
}

# 2. Master Item CRUD
Write-Host "`n--- 2. Master Item CRUD ---" -ForegroundColor Cyan

# Create Master (Cedar Wood)
$masterBody = @{
    category  = "material";
    name      = "Cedar Plank 2000x30x20";
    unitPrice = 1200;
    supplier  = "Yamada Wood";
    specs     = @{ length = 2000; width = 30; thickness = 20 }
}
$masterRes = Invoke-RestMethod -Uri "$baseUrl/masters" -Method Post -Headers $headers -Body ($masterBody | ConvertTo-Json)
$masterId = $masterRes.id
Write-Host "Created Master Item: $masterId"

# Get Master
$fetchedMaster = Invoke-RestMethod -Uri "$baseUrl/masters/$masterId" -Method Get -Headers $headers
if ($fetchedMaster.name -eq $masterBody.name) {
    Write-Host "[PASS] Master Item Fetch Success" -ForegroundColor Green
}
else {
    Write-Host "[FAIL] Master Item Fetch Mismatch" -ForegroundColor Red
}

# 3. Document (Estimate) Creation
Write-Host "`n--- 3. Document (Estimate) Creation ---" -ForegroundColor Cyan

# Need a project ID first (Use Dummy or fetch one)
# Fetch existing projects
$projects = Invoke-RestMethod -Uri "$baseUrl/projects" -Method Get -Headers $headers
if ($projects.Count -eq 0) {
    # Create Project
    $projRes = Invoke-RestMethod -Uri "$baseUrl/projects" -Method Post -Headers $headers -Body (@{name = "Manu Project" } | ConvertTo-Json)
    $projectId = $projRes.id
}
else {
    $projectId = $projects[0].id
}
Write-Host "Using Project: $projectId"

$estBody = @{
    projectId   = $projectId;
    type        = "estimate";
    status      = "draft";
    totalAmount = 50000;
    items       = @(
        @{ name = "Door A"; quantity = 2; unitPrice = 20000; costDetail = @{ material = 5000; labor = 10000 } },
        @{ name = "Installation"; quantity = 1; unitPrice = 10000 }
    )
}
$estRes = Invoke-RestMethod -Uri "$baseUrl/documents" -Method Post -Headers $headers -Body ($estBody | ConvertTo-Json -Depth 5)
$estId = $estRes.id
Write-Host "Created Estimate: $estId"

# 4. Conversion (Estimate -> Sales) CHECK SNAPSHOT
Write-Host "`n--- 4. Conversion (Estimate -> Sales) ---" -ForegroundColor Cyan

$convertRes = Invoke-RestMethod -Uri "$baseUrl/documents/$estId/convert" -Method Post -Headers $headers
$salesId = $convertRes.id
Write-Host "Converted to Sales Document: $salesId"

# Verify Sales Document
$salesDoc = Invoke-RestMethod -Uri "$baseUrl/documents/$salesId" -Method Get -Headers $headers
if ($salesDoc.type -eq "sales" -and $salesDoc.total_amount -eq 50000) {
    Write-Host "[PASS] Sales Conversion Success (Type: $($salesDoc.type), Amount: $($salesDoc.total_amount))" -ForegroundColor Green
}
else {
    Write-Host "[FAIL] Sales Conversion Failed" -ForegroundColor Red
    Write-Host "Got: $($salesDoc | ConvertTo-Json)"
}

# Check Items copied
if ($salesDoc.items.Count -eq 2) {
    Write-Host "[PASS] Items Copied Successfully" -ForegroundColor Green
}
else {
    Write-Host "[FAIL] Items Not Copied (Count: $($salesDoc.items.Count))" -ForegroundColor Red
}

Write-Host "`nTest Complete."
