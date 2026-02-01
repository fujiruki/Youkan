<?php
// backend/debug_check_fujita.php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

try {
    $pdo = getDB();
    $email = 'fjt.suntree@gmail.com';
    
    $result = [];

    // 1. Get User
    $stmt = $pdo->prepare("SELECT id, email, display_name FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        $result['error'] = "User $email NOT FOUND";
    } else {
        $result['user'] = $user;
        $result['memberships'] = [];

        // 2. Get Memberships
        $mStmt = $pdo->prepare("SELECT * FROM memberships WHERE user_id = ?");
        $mStmt->execute([$user['id']]);
        $memberships = $mStmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($memberships as $m) {
            $memData = $m;
            // 3. Get Tenant Info
            $tStmt = $pdo->prepare("SELECT * FROM tenants WHERE id = ?");
            $tStmt->execute([$m['tenant_id']]);
            $tenant = $tStmt->fetch(PDO::FETCH_ASSOC);
            $memData['tenant_name'] = $tenant ? $tenant['name'] : 'UNKNOWN';
            
            // Check if this is the "Debug Co" (デバッグ社)
            $memData['is_debug_company'] = ($tenant && strpos($tenant['name'], 'デバッグ') !== false);
            
            $result['memberships'][] = $memData;
        }
    }

    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
