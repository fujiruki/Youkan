<?php
// tests/verify_members_logic.php
require_once 'backend/db.php';
require_once 'backend/JWTService.php';

echo "=== Verification: Member Management logic ===\n";

// 1. Create Hack Contexts
$ownerId = 'u_own_' . uniqid();
$companyId = 't_own_' . uniqid();

try {
    $pdo = getDB();
    $ownerEmail = 'owner_' . uniqid() . '@test.com';
    echo "Creating Owner: $ownerId / $ownerEmail\n";
    $pdo->prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")->execute([$ownerId, $ownerEmail, 'hash_dummy', 'Owner']);
    
    echo "Creating Tenant: $companyId\n";
    $pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)")->execute([$companyId, 'Test Corp ' . uniqid(), time()]);
    
    $pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES (?, ?, 'owner', datetime('now'))")->execute([$ownerId, $companyId]);
} catch (PDOException $e) {
    echo "DB Setup Failed: " . $e->getMessage() . "\n";
    print_r($pdo->errorInfo());
    exit(1);
}

// Generate Token
$tokenOwner = JWTService::encrypt([
    'sub' => $ownerId,
    'name' => 'Owner',
    'tenant_id' => $companyId,
    'role' => 'owner'
]);

// 2. Test List Members
echo "[Test 1] List Members\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . $tokenOwner;
// Removed unused controller instantiation
// Mock output capturing? 
// Actually TenantController sends JSON and exits. We need to override sendJSON for testing or just use curl.
// For PHP script testing, let's just inspect DB after calling method? 
// No, Controller methods call sendJSON() which echos and exits. 
// We can't easily unit test Controller this way without buffering output.

// Let's use direct DB checks or curl.
// Let's use curl against running server?
// Server is running at localhost:8000.
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
    
    // Parse headers for response code
    $code = 0;
    if (isset($http_response_header)) {
        preg_match('#HTTP/\d\.\d (\d+)#', $http_response_header[0], $matches);
        $code = intval($matches[1] ?? 0);
    }
    
    if ($result === false) {
        echo "Stream Error\n";
        return ['code' => 0, 'body' => null];
    }
    
    $body = json_decode($result, true);
    if ($body === null && $result) {
         echo "JSON Decode Error. Raw Body: " . substr($result, 0, 200) . "...\n";
    }
    return ['code' => $code, 'body' => $body];
}

$res = callApi('GET', $baseUrl, $tokenOwner);
echo "   -> Code: " . $res['code'] . "\n";
if (!is_array($res['body'])) {
    echo "   -> ERROR: Body is not array.\n";
    exit(1);
}
echo "   -> Count: " . count($res['body']) . " (Should be 1)\n";

// 3. Test Invite Member
echo "[Test 2] Invite New Member\n";
$newEmail = 'new_' . uniqid() . '@test.com';
$res = callApi('POST', $baseUrl, $tokenOwner, ['email' => $newEmail, 'name' => 'New Guy']);
echo "   -> Code: " . $res['code'] . "\n";
echo "   -> Success: " . ($res['body']['success'] ? 'YES' : 'NO') . "\n";

$newUserId = $res['body']['userId'] ?? '';

// 4. Verify DB
$stmt = $pdo->prepare("SELECT * FROM memberships WHERE user_id = ? AND tenant_id = ?");
$stmt->execute([$newUserId, $companyId]);
if ($stmt->fetch()) {
    echo "   -> PASS: Membership created in DB.\n";
} else {
    echo "   -> FAIL: Membership missing.\n";
}

// 5. Test Remove Member
echo "[Test 3] Remove Member\n";
$res = callApi('DELETE', $baseUrl . '/' . $newUserId, $tokenOwner);
echo "   -> Code: " . $res['code'] . "\n";

$stmt->execute([$newUserId, $companyId]);
if (!$stmt->fetch()) {
    echo "   -> PASS: Membership removed from DB.\n";
} else {
    echo "   -> FAIL: Membership still exists.\n";
}
