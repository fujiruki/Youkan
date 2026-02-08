<?php
// backend/migrate_v9_security_logs.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v9 (Security Hardening for Logs)...\n";

    // Modify daily_logs table
    $columns = $pdo->query("PRAGMA table_info(daily_logs)")->fetchAll(PDO::FETCH_ASSOC);
    $hasTenantId = false;
    $hasCreatedBy = false;

    foreach ($columns as $col) {
        if ($col['name'] === 'tenant_id') $hasTenantId = true;
        if ($col['name'] === 'created_by') $hasCreatedBy = true;
    }

    if (!$hasTenantId) {
        $pdo->exec("ALTER TABLE daily_logs ADD COLUMN tenant_id TEXT DEFAULT NULL");
        echo "Added tenant_id to daily_logs.\n";
        
        // Optional: Backfill tenant_id for existing logs if we assume single tenant dev env
        // $pdo->exec("UPDATE daily_logs SET tenant_id = '...' WHERE tenant_id IS NULL");
    }
    
    if (!$hasCreatedBy) {
        $pdo->exec("ALTER TABLE daily_logs ADD COLUMN created_by TEXT DEFAULT NULL");
        echo "Added created_by to daily_logs.\n";
    }

    // Also check side_memos just in case (though less critical)
    $memoColumns = $pdo->query("PRAGMA table_info(side_memos)")->fetchAll(PDO::FETCH_ASSOC);
    $hasMemoTenant = false;
    $hasMemoUser = false;
    foreach ($memoColumns as $col) {
        if ($col['name'] === 'tenant_id') $hasMemoTenant = true;
        if ($col['name'] === 'created_by') $hasMemoUser = true;
    }

    if (!$hasMemoTenant) {
        $pdo->exec("ALTER TABLE side_memos ADD COLUMN tenant_id TEXT DEFAULT NULL");
        echo "Added tenant_id to side_memos.\n";
    }
    if (!$hasMemoUser) {
        $pdo->exec("ALTER TABLE side_memos ADD COLUMN created_by TEXT DEFAULT NULL");
        echo "Added created_by to side_memos.\n";
    }

    echo "Migration v9 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
