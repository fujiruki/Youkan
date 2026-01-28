<?php
require_once __DIR__ . '/../db.php';
try {
    $pdo = getDB();
    $sql = "INSERT INTO items (id, tenant_id, title, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)";
    $pdo->prepare($sql)->execute(['mig_test_ready', 't_default', 'Legacy Ready Item', 'ready', time(), time()]);
    $pdo->prepare($sql)->execute(['mig_test_standby', 't_default', 'Legacy Standby Item', 'standby', time(), time()]);
    // Today Item (assuming is_today_commit exists, if not it fails but we catch)
    // Actually db.php doesn't have is_today_commit, so this might fail if I try to insert it.
    // I'll skip injecting is_today_commit unless I alter table.
    echo "Inserted legacy items.\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
