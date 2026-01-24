<?php
// tests/verify_unified_logic.php
require_once 'backend/db.php';
require_once 'backend/JWTService.php';
require_once 'backend/CalendarController.php';

echo "=== Verification: Unified Logic ===\n";

// 1. Create Hack User Contexts
$userId = 'u_ver_' . uniqid();
$companyId = 't_ver_' . uniqid();

// Personal Token
$tokenPersonal = JWTService::encrypt([
    'sub' => $userId,
    'name' => 'Verify User',
    'tenant_id' => null,
    'role' => 'user'
]);

// Company Token
$tokenCompany = JWTService::encrypt([
    'sub' => $userId,
    'name' => 'Verify User',
    'tenant_id' => $companyId,
    'role' => 'admin'
]);

// Test 1: Personal Mode - Load Calendar
echo "[Test 1] Personal Mode Load\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $tokenPersonal;
$controller = new CalendarController();
$load = $controller->getLoad([]);
echo "   -> Count: " . count($load) . " (Should be 0 initially)\n";

// Test 2: Create Personal Item via SQL (Simulate ItemController)
$pdo = getDB();
$itemId = 'item_p_' . uniqid();
$pdo->prepare("
    INSERT INTO items (id, title, assigned_to, estimated_minutes, due_date, status, tenant_id, created_by, created_at, updated_at)
    VALUES (?, 'Personal Task', ?, 60, ?, 'inbox', NULL, ?, ?, ?)
")->execute([$itemId, $userId, date('Y-m-d'), $userId, time(), time()]);

// Re-check Load Personal
$load = $controller->getLoad([]);
echo "   -> Count: " . count($load) . "\n";
if (count($load) > 0 && $load[0]['title'] === 'Personal Task') {
    echo "   -> PASS: Can see Personal Task title in Personal Mode.\n";
} else {
    echo "   -> FAIL: Personal Task hidden or missing.\n";
}

// Test 3: Company Mode - Load Calendar (Viewing Self)
echo "[Test 3] Company Mode Load (Self)\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $tokenCompany;
$controller = new CalendarController(); // Re-instantiate to refresh context
$load = $controller->getLoad([]);
if (count($load) > 0 && $load[0]['title'] === 'Personal Task') {
    echo "   -> PASS: Can see Personal Task title in Company Mode (Self View).\n";
} else {
    echo "   -> FAIL: Personal Task masked for Self in Company Mode.\n";
    print_r($load);
}

// Test 4: Other User Viewing Me (Masking)
echo "[Test 4] Other User Viewing Me\n";
$otherUserId = 'u_other_' . uniqid();
$tokenOther = JWTService::encrypt([
    'sub' => $otherUserId,
    'name' => 'Other User',
    'tenant_id' => $companyId, // Same Company
    'role' => 'user'
]);
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $tokenOther;
$controller = new CalendarController();
$load = $controller->getLoad(['userId' => $userId]);

if (count($load) > 0 && strpos($load[0]['title'], 'Private') !== false) {
    echo "   -> PASS: Personal Task is MASKED for Other User.\n";
} else {
    echo "   -> FAIL: Masking failed. Title: " . ($load[0]['title'] ?? 'None') . "\n";
}
