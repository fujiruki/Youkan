<?php
// backend/debug_investigate_user.php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

try {
    $pdo = getDB();
    
    $result = [];

    // 1. Get All Users
    $users = $pdo->query("SELECT id, email, display_name FROM users")->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($users as $user) {
        $userData = $user;
        $userData['memberships'] = [];

        // 2. Get Memberships
        $stmt = $pdo->prepare("SELECT * FROM memberships WHERE user_id = ?");
        $stmt->execute([$user['id']]);
        $memberships = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        foreach ($memberships as $m) {
            $memData = $m;
            // 3. Get Tenant Info
            $tStmt = $pdo->prepare("SELECT * FROM tenants WHERE id = ?");
            $tStmt->execute([$m['tenant_id']]);
            $tenant = $tStmt->fetch(PDO::FETCH_ASSOC);
            $memData['tenant_name'] = $tenant ? $tenant['name'] : 'UNKNOWN';
            $userData['memberships'][] = $memData;
        }

        $result['users'][] = $userData;
    }

    // 4. Get Project Stats
    $projects = $pdo->query("SELECT id, title, tenant_id FROM items WHERE is_project = 1")->fetchAll(PDO::FETCH_ASSOC);
    $result['total_projects'] = count($projects);
    $result['projects_sample'] = array_slice($projects, 0, 5); // First 5

    // 5. Get All Tenants
    $tenants = $pdo->query("SELECT * FROM tenants")->fetchAll(PDO::FETCH_ASSOC);
    $result['all_tenants'] = $tenants;

    echo json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
