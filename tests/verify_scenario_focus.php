<?php
// tests/verify_scenario_focus.php
require_once __DIR__ . '/../backend/db.php';
require_once __DIR__ . '/../backend/JWTService.php';

// 1. Setup Mock User (Debug User)
$debugUserId = 'u_697b2af132f4f'; // Default Debug User
$token = JWTService::encrypt([
    'sub' => $debugUserId,
    'name' => 'Debug Verified User',
    'tenant_id' => 't_697b2af180467', // Default Tenant
    'role' => 'admin'
]);
$pdo = getDB();

echo "--- 1. Finding a Target Project (Company Scope) ---\n";
// Find a project that belongs to a tenant
$stmt = $pdo->prepare("SELECT * FROM items WHERE is_project = 1 AND tenant_id IS NOT NULL LIMIT 1");
$stmt->execute();
$project = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$project) {
    echo "Usage Error: No company project found to test against. Creating one...\n";
    // Create dummy project
    $projId = uniqid('prj_test_', true);
    $tenantId = 't_697b2af180467';
    $pdo->prepare("INSERT INTO items (id, tenant_id, title, is_project, client_name, created_by, updated_at) VALUES (?, ?, 'TestProject', 1, 'TestCompany', ?, ?)")
        ->execute([$projId, $tenantId, $debugUserId, time()]);
    $project = ['id' => $projId, 'tenant_id' => $tenantId, 'client_name' => 'TestCompany', 'title' => 'TestProject'];
    echo "Created Project: {$project['id']} ({$project['title']})\n";
} else {
    echo "Target Project: {$project['title']} (ID: {$project['id']}, Tenant: {$project['tenant_id']})\n";
}

echo "\n--- 2. Simulating 'Throw-in' from Dashboard (Project Focused) ---\n";
// Scenario: User creates a task with projectId, BUT NOT tenantId (simulating UI input)
$newItemId = uniqid('item_test_', true);
$payload = [
    'id' => $newItemId,
    'title' => 'Scenario_Verify_Task_' . date('His'),
    'projectId' => $project['id'], // Focus context
    // 'tenantId' is MISSING, as per user scenario (or legacy UI behavior)
    // The backend should infer it provided by the fix.
];

// [FIX] Close DB connection to avoid SQLite locking issues during API call
$pdo = null;
unset($stmt);

// Call Create API Logic (Using strict HTTP stream to avoid curl dependency)
$apiUrl = 'http://localhost:8000/items'; 
$options = [
    'http' => [
        'header'  => "Content-Type: application/json\r\n" .
                     "Authorization: Bearer $token\r\n" .
                     "Content-Length: " . strlen(json_encode($payload)) . "\r\n",
        'method'  => 'POST',
        'content' => json_encode($payload),
        'ignore_errors' => true
    ]
];
$context  = stream_context_create($options);
$response = file_get_contents($apiUrl, false, $context);
$httpCode = 0;
if (isset($http_response_header) && is_array($http_response_header)) {
    foreach ($http_response_header as $hdr) {
        if (preg_match('#HTTP/[0-9\.]+\s+([0-9]+)#', $hdr, $matches)) {
            $httpCode = (int)$matches[1];
            break;
        }
    }
}

echo "API Response ({$httpCode}): " . substr($response, 0, 100) . "...\n";

if ($httpCode !== 200 && $httpCode !== 201) {
    die("FAILED: API Creation failed. Output: $response\n");
}

echo "\n--- 3. Verifying Inheritance (The Fix) ---\n";
// Reconnect DB
$pdo = getDB();

// Fetch the created item from DB to be sure
$stmt = $pdo->prepare("SELECT * FROM items WHERE id = ?");
$stmt->execute([$newItemId]);
$item = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$item) {
    die("FAILED: Item not found in DB.\n");
}

echo "Created Item: {$item['title']}\n";
echo "  - Item Tenant ID: " . ($item['tenant_id'] ?? 'NULL') . "\n";
echo "  - Project Tenant ID: {$project['tenant_id']}\n";
echo "  - Item Client Name: " . ($item['client_name'] ?? 'NULL') . "\n";

if ($item['tenant_id'] === $project['tenant_id']) {
    echo "✅ SUCCESS: Tenant ID was correctly inherited!\n";
} else {
    echo "❌ FAILED: Tenant ID mismatch or missing.\n";
}

if (!empty($item['client_name']) && $item['client_name'] === $project['client_name']) {
    echo "✅ SUCCESS: Client Name was correctly inherited!\n";
} else {
    // Client name might be optional so warning
    echo "⚠️ INFO: Client Name inheritance check: " . ($item['client_name'] === $project['client_name'] ? 'Matched' : 'Unmatched/Null') . "\n";
}


echo "\n--- 4. Verifying Dashboard Reflection ---\n";
// Call valid Dashboard API to see if it appears
$dashUrl = "http://localhost:8000/items?project_id={$project['id']}";
$optionsDash = [
    'http' => [
        'header'  => "Authorization: Bearer $token\r\n",
        'method'  => 'GET',
        'ignore_errors' => true
    ]
];
$contextDash  = stream_context_create($optionsDash);
$dashResponse = file_get_contents($dashUrl, false, $contextDash);

$dashItems = json_decode($dashResponse, true);
$found = false;
foreach ($dashItems as $dItem) {
    if ($dItem['id'] === $newItemId) {
        $found = true;
        break;
    }
}

if ($found) {
    echo "✅ SUCCESS: Item appears in Project Dashboard list.\n";
} else {
    echo "❌ FAILED: Item NOT found in Project Dashboard list.\n";
}
