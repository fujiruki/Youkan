<?php
// backend/debug_check_test_user.php
require_once __DIR__ . '/db.php';

try {
    $pdo = getDB();
    $email = 'test@example.com';
    
    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch(PDO::FETCH_ASSOC);
    
    if (!$user) {
        echo "User $email NOT FOUND.\n";
    } else {
        echo "User: " . $user['email'] . " (ID: " . $user['id'] . ")\n";
        
        $mStmt = $pdo->prepare("SELECT * FROM memberships WHERE user_id = ?");
        $mStmt->execute([$user['id']]);
        $memberships = $mStmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "Membership Count: " . count($memberships) . "\n";
        if (count($memberships) === 0) {
            echo "CONFIRMED: No memberships linked.\n";
        } else {
            foreach ($memberships as $m) {
                echo " - Tenant: " . $m['tenant_id'] . "\n";
            }
        }
    }
    
    // Also check for 'u_default'
    $stmt = $pdo->query("SELECT * FROM users WHERE id = 'u_default'");
    $defaultUser = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($defaultUser) {
        echo "\nDefault User (u_default):\n";
        $mStmt = $pdo->prepare("SELECT * FROM memberships WHERE user_id = ?");
        $mStmt->execute(['u_default']);
        $memberships = $mStmt->fetchAll(PDO::FETCH_ASSOC);
         echo "Membership Count: " . count($memberships) . "\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
