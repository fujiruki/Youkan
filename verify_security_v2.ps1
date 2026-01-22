# verify_security_v2.ps1
# Phase 3.5 Security Verification Script
# Tests Item/Log visibility between User A (Manager) and User B (Staff)

$baseUrl = "http://localhost:8005/api"
$tenantId = "tenant_demo"

function Test-Api($method, $endpoint, $token, $body = $null) {
    $headers = @{
        "Authorization" = "Bearer $token"
        "Content-Type"  = "application/json"
    }
    try {
        if ($body) {
            $json = $body | ConvertTo-Json -Depth 10 -Compress
            $response = Invoke-RestMethod -Uri "$baseUrl$endpoint" -Method $method -Headers $headers -Body $json -ErrorAction Stop
        }
        else {
            $response = Invoke-RestMethod -Uri "$baseUrl$endpoint" -Method $method -Headers $headers -ErrorAction Stop
        }
        return $response
    }
    catch {
        # Check if it's a 409 Conflict (User exists) or 401 (Auth fail) to handle gracefully in calling code
        if ($_.Exception.Response) {
            # Return the error response status for manual handling if needed
            # But here just returning null or throwing acts as fail.
            # Let's return $null and print error
            $stream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            $errBody = $reader.ReadToEnd()
            Write-Host "API Error: $($_.Exception.Message) - Body: $errBody" -ForegroundColor Yellow
        }
        return $null
    }
}

# 1. Setup Mock Users
Write-Host "--- 1. Authenticating Users ---" -ForegroundColor Cyan

function Get-AuthToken($roleName, $email, $password) {
    # Try Login
    Write-Host "Attempting Login for $roleName..."
    $loginData = @{ email = $email; password = $password }
    $loginRes = Test-Api "POST" "/auth/login" $null $loginData
    
    if ($loginRes -and $loginRes.token) {
        Write-Host "Login Success: $($loginRes.user.name)"
        return $loginRes
    }

    # Try Register
    Write-Host "Login failed. Attempting Register for $roleName..."
    $regData = @{ 
        name     = $roleName; 
        email    = $email; 
        password = $password 
    }
    $regRes = Test-Api "POST" "/auth/register" $null $regData
    
    if ($regRes -and $regRes.token) {
        Write-Host "Register Success: $($regRes.user.name)"
        return $regRes
    }
    
    return $null
}

# User A (Manager)
$userA = Get-AuthToken "Manager Tokugawa" "manager@example.com" "password123"
if ($userA) { $tokenA = $userA.token; $idA = $userA.user.id; Write-Host "User A ID: $idA" }

# User B (Staff)
$userB = Get-AuthToken "Staff Mitsunari" "staff@example.com" "password123"
if ($userB) { $tokenB = $userB.token; $idB = $userB.user.id; Write-Host "User B ID: $idB" }

if (-not $tokenA -or -not $tokenB) {
    Write-Error "Authentication failed. Aborting."
    exit
}

# --- CRITICAL FIX: Align Tenants ---
# Default Register creates separate tenants. We need User B to be in User A's tenant.
# We will manipulate the DB directly using PHP CLI for this test setup.
Write-Host "--- Aligning Tenants (User B -> User A's Tenant) ---" -ForegroundColor Yellow

$phpCode = @"
<?php
require_once 'backend/db.php';
`$pdo = getDB();
// Get A's tenant
`$stmt = `$pdo->prepare('SELECT tenant_id FROM memberships WHERE user_id = ? LIMIT 1');
`$stmt->execute(['$idA']);
`$tenantA = `$stmt->fetchColumn();

// Update B's membership to A's tenant
`$stmt = `$pdo->prepare('UPDATE memberships SET tenant_id = ? WHERE user_id = ?');
`$stmt->execute([`$tenantA, '$idB']);
echo `$tenantA;
"@

$tenantA_ID = $phpCode | php
Write-Host "Moved User B ($idB) to Tenant: $tenantA_ID"

# Re-Login User B to get new token with correct Tenant ID
Write-Host "Re-Logging in User B to refresh token..."
$userB = Get-AuthToken "Staff Mitsunari" "staff@example.com" "password123"
$tokenB = $userB.token
Write-Host "User B Token Refreshed."
# -----------------------------------

# 2. Project Setup
Write-Host "`n--- 2. Project Setup ---" -ForegroundColor Cyan
# Manager creates a shared project
$project = Test-Api "POST" "/projects" $tokenA @{
    name     = "Sekigahara Campaign";
    settings = @{ type = "standard" }
}
$projectId = $project.id
Write-Host "Project Created: $projectId (Shared)"

# 3. Item Creation (The Core Test)
Write-Host "`n--- 3. Item Visibility Test ---" -ForegroundColor Cyan

# Case 1: Staff creates Private Task (Inbox)
$privateTask = Test-Api "POST" "/items" $tokenB @{
    title            = "Secret Plot (Private)";
    status           = "inbox";
    estimatedMinutes = 60
}
Write-Host "Staff created Private Task: $($privateTask.id)"

# Case 2: Staff creates Shared Task (Project)
$sharedTask = Test-Api "POST" "/items" $tokenB @{
    title            = "Mobilize Troops (Shared)";
    status           = "next";
    projectId        = $projectId;
    isProject        = $false;
    estimatedMinutes = 120
}
Write-Host "Staff created Shared Task: $($sharedTask.id)"

# 4. Access Verification
Write-Host "`n--- 4. Access Verification ---" -ForegroundColor Cyan

# Test 4-1: Manager tries to see Staff's Private Task in Inbox List
# Manager calls getMyItems (should only show Manager's items)
$managerInbox = Test-Api "GET" "/items?type=inbox" $tokenA
$visiblePrivate = $managerInbox | Where-Object { $_.id -eq $privateTask.id }

if ($visiblePrivate) {
    Write-Host "[FAIL] Manager COULD see Staff's Private Task!" -ForegroundColor Red
}
else {
    Write-Host "[PASS] Manager could NOT see Staff's Private Task." -ForegroundColor Green
}

# Test 4-2: Manager tries to see Shared Task in Project
$managerProject = Test-Api "GET" "/items?project_id=$projectId" $tokenA
$visibleShared = $managerProject | Where-Object { $_.id -eq $sharedTask.id }

if ($visibleShared) {
    Write-Host "[PASS] Manager COULD see Shared Task." -ForegroundColor Green
}
else {
    Write-Host "[FAIL] Manager could NOT see Shared Task!" -ForegroundColor Red
}

# 5. Capacity View Test (New Feature)
Write-Host "`n--- 5. Manager Capacity View Test ---" -ForegroundColor Cyan

# Manager checks Staff's capacity
$capacity = Test-Api "GET" "/users/$idB/capacity" $tokenA

# Should see both tasks (Private and Shared) but as anonymous 'busy' blocks
$capPrivate = $capacity | Where-Object { $_.id -eq $privateTask.id }
$capShared = $capacity | Where-Object { $_.id -eq $sharedTask.id }

if ($capPrivate) {
    Write-Host "[PASS] Manager saw Private Task Capacity." -ForegroundColor Green
    # Check if title is obfuscated (Should NOT be the original title)
    if ($capPrivate.title -ne "Secret Plot (Private)") {
        Write-Host "      Title Obfuscated? : Yes (Content: $($capPrivate.title))" -ForegroundColor Green
    }
    else {
        Write-Host "      Title Obfuscated? : NO! (Leak Detected)" -ForegroundColor Red
    }
}
else {
    # It might fail if Staff has many items and page limit? No, getCapacity is all active.
    Write-Host "[FAIL] Manager missed Private Task Capacity." -ForegroundColor Red
}

if ($capShared) {
    Write-Host "[PASS] Manager saw Shared Task Capacity." -ForegroundColor Green
}
else {
    Write-Host "[FAIL] Manager missed Shared Task Capacity." -ForegroundColor Red
}

Write-Host "`nTest Complete."
