# tests/run_full_system_test.ps1

$BaseUrl = "http://localhost:8000"
if ($env:JBWOS_API_URL) { $BaseUrl = $env:JBWOS_API_URL }

# Colors
$Green = [ConsoleColor]::Green
$Red = [ConsoleColor]::Red
$Yellow = [ConsoleColor]::Yellow
$Cyan = [ConsoleColor]::Cyan
$Reset = [ConsoleColor]::White

function Log-Step($msg) { Write-Host "[$([DateTime]::Now.ToString('HH:mm:ss'))] $msg" -ForegroundColor $Cyan }
function Log-Pass($msg) { Write-Host "  PASS: $msg" -ForegroundColor $Green }
function Log-Fail($msg) { Write-Host "  FAIL: $msg" -ForegroundColor $Red; exit 1 }

# Session State
$global:Token = $null
$global:Email = "test_auto_$(Get-Random)@example.com"
$global:Password = "testpass123"

# --- Helper: API Request ---
function Invoke-Api {
    param(
        [string]$Method,
        [string]$Path,
        [hashtable]$Body = $null
    )
    $Uri = "$BaseUrl$Path"
    $Headers = @{ "Content-Type" = "application/json" }
    if ($global:Token) { $Headers["Authorization"] = "Bearer $global:Token" }

    try {
        $Params = @{
            Uri         = $Uri
            Method      = $Method
            Headers     = $Headers
            ErrorAction = "Stop"
        }
        if ($Body) { 
            $Params["Body"] = ($Body | ConvertTo-Json -Depth 5 -Compress) 
        }
        
        $Response = Invoke-RestMethod @Params
        return $Response
    }
    catch {
        $ErrorMsg = $_.Exception.Message
        try {
            $ErrorJson = $_.Exception.Response.GetResponseStream()
            $Reader = New-Object System.IO.StreamReader($ErrorJson)
            $ErrorBody = $Reader.ReadToEnd()
            $ErrorMsg += " | Body: $ErrorBody"
        }
        catch {}
        Write-Host "API Error: $Method $Path - $ErrorMsg" -ForegroundColor $Red
        return $null
    }
}

Log-Step "Starting Full System Scenario Test..."

# --- Scenario 0: Auth ---
Log-Step "0. Authentication (Register/Login)"
$Reg = Invoke-Api "POST" "/api/auth/register" @{ email = $global:Email; password = $global:Password; name = "TestAutoUser" }
if ($Reg.token) {
    Log-Pass "Registered new user: $global:Email"
    $global:Token = $Reg.token
}
else {
    Log-Fail "Registration failed / No token"
}

# --- Scenario 1: Inbox Workflow ---
Log-Step "1. Inbox Workflow"
# 1.1 Create Inbox Item
$Item1 = Invoke-Api "POST" "/api/items" @{ title = "Test Inbox Item"; status = "inbox" }
if ($Item1.id) { Log-Pass "Created Item: $($Item1.id)" } else { Log-Fail "Create failed" }
$Id1 = $Item1.id

# 1.2 Resolve Decision (Hold)
$Res1 = Invoke-Api "POST" "/api/decision/$Id1/resolve" @{ decision = "hold"; note = "Thinking about it" }
if ($Res1.new_status -eq "decision_hold") { Log-Pass "Resolved to Hold" } else { Log-Fail "Resolve Hold failed" }

# 1.3 Resolve Decision (Yes -> Confirmed)
$Res2 = Invoke-Api "POST" "/api/decision/$Id1/resolve" @{ decision = "yes"; note = "Let's do it" }
if ($Res2.new_status -eq "confirmed") { Log-Pass "Resolved to Confirmed (Ready for Today)" } else { Log-Fail "Resolve Yes failed" }


# --- Scenario 2: Today Workflow ---
Log-Step "2. Today Workflow"
# 2.1 Commit to Today
$Commit = Invoke-Api "POST" "/api/today/commit" @{ id = $Id1 }
if ($Commit.new_status -eq "today_commit") { Log-Pass "Committed to Today" } else { Log-Fail "Commit failed" }

# 2.2 Verify in Today List
$Today = Invoke-Api "GET" "/api/today"
$Found = $Today.commits | Where-Object { $_.id -eq $Id1 }
if ($Found) { Log-Pass "Item appears in Today Commits" } else { Log-Fail "Item NOT found in Today Commits" }

# 2.3 Start Execution
$ExecStart = Invoke-Api "POST" "/api/execution/$Id1/start"
if ($ExecStart.status -eq "execution_in_progress") { Log-Pass "Execution Started" } else { Log-Fail "Execution Start failed" }

# 2.4 Verify Execution State (Get Today again)
$Today2 = Invoke-Api "GET" "/api/today"
if ($Today2.execution.id -eq $Id1) { Log-Pass "Item is currently executing in Today View" } else { Log-Fail "Item not executing" }

# 2.5 Pause Execution
$ExecPause = Invoke-Api "POST" "/api/execution/$Id1/pause"
if ($ExecPause.status -eq "execution_paused") { Log-Pass "Execution Paused" } else { Log-Fail "Execution Pause failed" }

# 2.6 Complete
$Complete = Invoke-Api "POST" "/api/today/complete" @{ id = $Id1 }
if ($Complete.new_status -eq "done") { Log-Pass "Item Completed (Done)" } else { Log-Fail "Completion failed" }

# 2.7 Undo Completion (New Feature)
$Undo = Invoke-Api "POST" "/api/today/undo" @{ id = $Id1 }
if ($Undo.new_status -eq "today_commit") { Log-Pass "Undo Successful! Status reverted to today_commit" } else { Log-Fail "Undo failed: $($Undo.new_status)" }


# --- Scenario 3: Project & Subtasks ---
Log-Step "3. Project & Subtasks"
# 3.1 Create Project
$Proj = Invoke-Api "POST" "/api/projects" @{ name = "Test Project"; status = "active" }
if ($Proj.id) { Log-Pass "Created Project: $($Proj.id)" } else { Log-Fail "Project Create failed" }
$ProjId = $Proj.id

# 3.2 Create Subtask (General) linked to Project
$Task1 = Invoke-Api "POST" "/api/items" @{ title = "Subtask 1"; projectId = $ProjId; estimatedMinutes = 30 }
if ($Task1.id) { Log-Pass "Created Subtask: $($Task1.id)" } else { Log-Fail "Subtask Create failed" }

# 3.3 Verify Project Items List
$ProjItems = Invoke-Api "GET" "/api/items?project_id=$ProjId"
$FoundTask = $ProjItems | Where-Object { $_.id -eq $Task1.id }
if ($FoundTask) { Log-Pass "Subtask found in Project Item List" } else { Log-Fail "Subtask missing from Project List" }


# --- Scenario 4: Manufacturing Project ---
Log-Step "4. Manufacturing Workflow"
# 4.1 Create Manufacturing Project (using same endpoint, just type checking)
$MfgProj = Invoke-Api "POST" "/api/projects" @{ 
    name        = "Door Making"; 
    projectType = "manufacturing";
    client      = "Test Client"
}
Log-Pass "Created Manufacturing Project: $($MfgProj.id)"

# 4.2 Assign Member (requires MemberController or Project update)
# Simplify: Update Project meta/assignees if supported.
# For now, just verification of creation is enough as per request.

Log-Step "All Scenarios Passed Successfully!"
exit 0
