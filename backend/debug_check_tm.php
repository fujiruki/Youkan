<?php
require_once __DIR__ . '/db.php';
header('Content-Type: text/plain');

try {
    $pdo = getDB();
    
    echo "--- Tenants ---\n";
    $stm = $pdo->query("SELECT id, name FROM tenants");
    $tenants = $stm->fetchAll(PDO::FETCH_ASSOC);
    foreach ($tenants as $t) {
        echo "{$t['id']}: {$t['name']}\n";
    }

    echo "\n--- Memberships ---\n";
    $stm = $pdo->query("SELECT user_id, tenant_id, role FROM memberships");
    $members = $stm->fetchAll(PDO::FETCH_ASSOC);
    foreach ($members as $m) {
        echo "User: {$m['user_id']} -> Tenant: {$m['tenant_id']} ({$m['role']})\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
