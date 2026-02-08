<?php
// backend/migrate_v10_fix_items_tenant.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v10 (Fix Items Tenant & CreatedBy)...\n";

    // Modify items table
    $columns = $pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_ASSOC);
    $hasTenantId = false;
    $hasCreatedBy = false;

    foreach ($columns as $col) {
        if ($col['name'] === 'tenant_id') $hasTenantId = true;
        if ($col['name'] === 'created_by') $hasCreatedBy = true;
    }

    if (!$hasTenantId) {
        $pdo->exec("ALTER TABLE items ADD COLUMN tenant_id TEXT DEFAULT NULL");
        echo "Added tenant_id to items.\n";
        
        // BACKFILL: If migrating existing data, we might want to default to a single tenant or handle it.
        // For development, leaving as NULL might be okay IF the code handles it, 
        // but ItemController enforces `WHERE tenant_id = ?`.
        // So NULL items will become invisible. 
        // Let's assume the first tenant found is the owner of orphaned items for dev convenience.
        // OR just leave them invisible/orphan. Let's leave them invisible for safety in true multi-tenant style.
        // BUT for a dev setup, invisible items are confusing.
        // Let's NOT backfill for now to be safe.
    }
    
    if (!$hasCreatedBy) {
        $pdo->exec("ALTER TABLE items ADD COLUMN created_by TEXT DEFAULT NULL");
        echo "Added created_by to items.\n";
    }

    echo "Migration v10 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
