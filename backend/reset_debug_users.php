<?php
require_once __DIR__ . '/db.php';

function resetDebugAccounts() {
    $pdo = getDB();
    
    $users = [
        [
            'email' => 'fjt.suntree@gmail.com',
            'name' => '藤田ローカル',
            'password' => 'passa',
            'type' => 'user'
        ],
        [
            'email' => 'info@door-fujita.com',
            'name' => 'デバッグ社',
            'password' => 'passc',
            'type' => 'company'
        ]
    ];

    echo "Starting Account Reset...\n";

    foreach ($users as $u) {
        echo "Processing {$u['email']}...\n";
        
        // 1. Find User
        $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$u['email']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user) {
            echo "  Found existing user ID: {$user['id']}. Deleting...\n";
            $uid = $user['id'];
            
            // Delete related data
            $pdo->prepare("DELETE FROM api_tokens WHERE user_id = ?")->execute([$uid]);
            $pdo->prepare("DELETE FROM memberships WHERE user_id = ?")->execute([$uid]);
            // If checking tenant owner
            if ($u['type'] === 'company') {
                 $stmtT = $pdo->prepare("SELECT id FROM tenants WHERE email = ?");
                 $stmtT->execute([$u['email']]);
                 $tenant = $stmtT->fetch(PDO::FETCH_ASSOC);
                 if ($tenant) {
                     $tid = $tenant['id'];
                     echo "  Found related tenant ID: {$tid}. Deleting...\n";
                     $pdo->prepare("DELETE FROM memberships WHERE tenant_id = ?")->execute([$tid]);
                     $pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$tid]);
                 }
            }
            $pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$uid]);
            echo "  Deleted.\n";
        }

        // 2. Create User
        echo "  Creating new user...\n";
        $newId = uniqid('u_');
        $hash = password_hash($u['password'], PASSWORD_DEFAULT);
        
        $pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, is_representative, created_at) VALUES (?, ?, ?, ?, 0, datetime('now'))")->execute([$newId, $u['email'], $hash, $u['name']]);
        
        if ($u['type'] === 'company') {
            $tid = uniqid('t_');
            echo "  Creating company tenant {$tid}...\n";
            $pdo->prepare("INSERT INTO tenants (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, datetime('now'))")->execute([$tid, $u['name'], $u['email'], $hash]);
            // Membership
            $pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES (?, ?, 'owner', datetime('now'))")->execute([$newId, $tid]);
        }

        echo "  Done.\n";
    }
    echo "All Debug Accounts Reset Successfully.\n";
}

try {
    resetDebugAccounts();
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
