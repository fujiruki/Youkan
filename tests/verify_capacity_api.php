<?php
// tests/verify_capacity_api.php
require_once 'backend/db.php';
require_once 'backend/JWTService.php';

echo "=== Verification: Member Capacity API ===\n";

// 1. Setup Context
$ownerId = 'u_cap_' . uniqid();
$companyId = 't_cap_' . uniqid();
$pdo = getDB();

try {
    // Cleanup first
    $pdo->prepare("DELETE FROM memberships WHERE tenant_id = ?")->execute([$companyId]);
    $pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$companyId]);
    $pdo->prepare("DELETE FROM users WHERE email = ?")->execute(['cap_owner@test.com']);
    
    // Create User & Tenant
    $pdo->prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
        ->execute([$ownerId, 'cap_owner@test.com', 'hash', 'Owner']);
    $pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)")
        ->execute([$companyId, 'Capacity Corp', time()]);
    // Add as Admin
    $pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at, is_core, daily_capacity_minutes) VALUES (?, ?, 'owner', datetime('now'), 0, 480)")
        ->execute([$ownerId, $companyId]);
} catch (Exception $e) {
    echo "Setup Failed: " . $e->getMessage() . "\n";
    exit(1);
}

$token = JWTService::encrypt([
    'sub' => $ownerId,
    'tenant_id' => $companyId,
    'role' => 'owner'
]);

$baseUrl = 'http://127.0.0.1:8000/api/tenant/members';

function callApi($method, $url, $token, $data = null) {
    $opts = [
        'http' => [
            'method' => $method,
            'header' => "Content-Type: application/json\r\n" .
                        "Authorization: Bearer " . $token . "\r\n",
            'ignore_errors' => true
        ]
    ];
    if ($data) {
        $opts['http']['content'] = json_encode($data);
    }
    $context = stream_context_create($opts);
    $result = file_get_contents($url, false, $context);
    
    // Parse response headers for status code
    $code = 0;
    if (isset($http_response_header)) {
        preg_match('#HTTP/\d\.\d (\d+)#', $http_response_header[0], $matches);
        $code = intval($matches[1] ?? 0);
    }
    
    return ['code' => $code, 'body' => json_decode($result, true)];
}

// 2. Test GET (Check Default)
echo "[Test 1] Get Members (Default Check)\n";
$res = callApi('GET', $baseUrl, $token);
echo "   -> Code: " . $res['code'] . "\n";
$member = $res['body'][0];
echo "   -> is_core: " . $member['is_core'] . " (Expect 0)\n";
echo "   -> daily: " . $member['daily_capacity_minutes'] . " (Expect 480)\n";

if ($member['is_core'] != 0 || $member['daily_capacity_minutes'] != 480) {
    echo "FAIL: Default values incorrect.\n";
    exit(1);
}

// 3. Test PUT (Update)
echo "[Test 2] Update capacity (is_core=1, daily=360)\n";
$updateData = ['is_core' => true, 'daily_capacity_minutes' => 360];
$res = callApi('PUT', $baseUrl . '/' . $ownerId, $token, $updateData);
echo "   -> Code: " . $res['code'] . " (Expect 200)\n";

if ($res['code'] !== 200) {
    echo "FAIL: Update failed.\n";
    print_r($res['body']);
    exit(1);
}

// 4. Verify Update
echo "[Test 3] Verify Update\n";
$res = callApi('GET', $baseUrl, $token);
$member = $res['body'][0];
echo "   -> is_core: " . $member['is_core'] . " (Expect 1)\n";
echo "   -> daily: " . $member['daily_capacity_minutes'] . " (Expect 360)\n";

if ($member['is_core'] != 1 || $member['daily_capacity_minutes'] != 360) {
    echo "FAIL: Values not updated.\n";
    exit(1);
}

echo "PASS: Capacity API verified.\n";
