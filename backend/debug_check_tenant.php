<?php
// backend/debug_check_tenant.php
require_once 'db.php';
$pdo = getDB();

echo "--- Users ---\n";
$users = $pdo->query("SELECT id, email, display_name FROM users")->fetchAll(PDO::FETCH_ASSOC);
foreach($users as $u) {
    echo "{$u['id']} : {$u['email']} ({$u['display_name']})\n";
}

echo "\n--- Memberships ---\n";
$mems = $pdo->query("SELECT user_id, tenant_id FROM memberships")->fetchAll(PDO::FETCH_ASSOC);
foreach($mems as $m) {
    echo "User: {$m['user_id']} -> Tenant: {$m['tenant_id']}\n";
}

echo "\n--- Items (Filtered by 'Shared' or 'Private') ---\n";
$items = $pdo->query("SELECT id, title, tenant_id, project_id, created_by, created_at FROM items WHERE title LIKE '%Shared%' OR title LIKE '%Private%'")->fetchAll(PDO::FETCH_ASSOC);

if (!is_array($items) || empty($items)) {
    echo "No items found or fetch failed.\n";
    var_dump($items);
} else {
    // Check first item type
    if (!is_array($items[0])) {
        echo "Items content is weird:\n";
        var_dump($items);
        exit;
    }
}

foreach($items as $i) {
    // Double check type
    if (!is_array($i)) {
        echo "Row is not array: " . json_encode($i) . "\n";
        continue;
    }
    
    $tid = $i['tenant_id'] ?? 'NULL';
    $pid = $i['project_id'] ?? 'NULL';
    $cby = $i['created_by'] ?? 'NULL';
    echo "Item: {$i['id']} ({$i['title']})\n  Tenant: {$tid}, Project: {$pid}, CreatedBy: {$cby}\n";
}
