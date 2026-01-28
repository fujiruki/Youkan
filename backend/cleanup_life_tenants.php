<?php
// backend/cleanup_life_tenants.php
require_once __DIR__ . '/db.php';

function cleanup() {
    $pdo = getDB();
    echo "Starting cleanup of 'Life' tenants...\n";

    try {
        $pdo->beginTransaction();

        // 1. Find tenants to delete
        $stmt = $pdo->prepare("SELECT id, name FROM tenants WHERE name LIKE ?");
        $stmt->execute(['%\'s Life']);
        $tenants = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($tenants)) {
            echo "No 'Life' tenants found to cleanup.\n";
            $pdo->rollBack();
            return;
        }

        foreach ($tenants as $tenant) {
            echo "Cleaning up tenant: {$tenant['name']} ({$tenant['id']})\n";

            // 2. Delete memberships
            $stmtDelMem = $pdo->prepare("DELETE FROM memberships WHERE tenant_id = ?");
            $stmtDelMem->execute([$tenant['id']]);
            echo "  - Deleted memberships\n";

            // 3. Update items (Set tenant_id to '' if it was this tenant)
            // Using '' instead of NULL to satisfy NOT NULL constraint if present.
            // UI logic handles both NULL and '' as Personal Mode.
            $stmtUpdItems = $pdo->prepare("UPDATE items SET tenant_id = '' WHERE tenant_id = ?");
            $stmtUpdItems->execute([$tenant['id']]);
            echo "  - Updated items to Personal Mode (tenant_id = '')\n";

            // 4. Delete tenant
            $stmtDelTenant = $pdo->prepare("DELETE FROM tenants WHERE id = ?");
            $stmtDelTenant->execute([$tenant['id']]);
            echo "  - Deleted tenant record\n";
        }

        $pdo->commit();
        echo "Cleanup completed successfully!\n";

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo "Cleanup FAILED: " . $e->getMessage() . "\n";
    }
}

cleanup();
