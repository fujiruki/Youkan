<?php
// backend/debug_check_login_issues.php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

try {
    $pdo = getDB();
    $result = [];

    // 1. Check User: fjt.suntree@gmail.com / passa
    $emailUser = 'fjt.suntree@gmail.com';
    $passUser = 'passa';

    $stmt = $pdo->prepare("SELECT id, email, password_hash FROM users WHERE email = ?");
    $stmt->execute([$emailUser]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$user) {
        $result['user'] = "NOT FOUND";
    } else {
        $verify = password_verify($passUser, $user['password_hash']);
        $result['user'] = [
            'found' => true,
            'id' => $user['id'],
            'password_verify' => $verify ? 'OK' : 'FAIL'
        ];
    }

    // 2. Check Tenant: info@door-fujita.com / passc (For Company Login)
    $emailTenant = 'info@door-fujita.com';
    $passTenant = 'passc';

    // Check in Tenants table
    $stmt = $pdo->prepare("SELECT id, name, email, password_hash FROM tenants WHERE email = ?");
    $stmt->execute([$emailTenant]);
    $tenant = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$tenant) {
        // Also check if this email exists in USERS table, maybe user is confused
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$emailTenant]);
        $userAsTenant = $stmt->fetch(PDO::FETCH_ASSOC);
        
        $result['tenant'] = [
            'found_in_tenants' => false,
            'found_in_users' => (bool)$userAsTenant
        ];
    } else {
        $verify = password_verify($passTenant, $tenant['password_hash']);
        $result['tenant'] = [
            'found' => true,
            'id' => $tenant['id'],
            'name' => $tenant['name'],
            'password_verify' => $verify ? 'OK' : 'FAIL'
        ];
    }

    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
