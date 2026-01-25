<?php
// backend/migrate_v14_cleanup_orphans.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting Migration v14: Cleanup Orphan Items...\n";

    // 1. Find Orphan Items (tenant_id IS NULL)
    // We also need to fetch created_by to map to personal tenant.
    $stmt = $pdo->query("SELECT id, title, created_by FROM items WHERE tenant_id IS NULL OR tenant_id = ''");
    $orphans = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "Found " . count($orphans) . " orphan items.\n";
    $fixed = 0;
    $deleted = 0;

    foreach ($orphans as $item) {
        $creatorId = $item['created_by'];
        
        if ($creatorId) {
            // Find creator's personal tenant
            // We assume v13 ran, so they MUST have one named "...'s Life"
            // Or just pick ANY tenant they own? No, be specific.
            $stmtPt = $pdo->prepare("
                SELECT t.id 
                FROM memberships m
                JOIN tenants t ON m.tenant_id = t.id
                WHERE m.user_id = ? AND m.role = 'owner' AND t.name LIKE '%Life%'
                LIMIT 1
            ");
            $stmtPt->execute([$creatorId]);
            $personalTenantId = $stmtPt->fetchColumn();

            if ($personalTenantId) {
                // Fix it
                $pdo->prepare("UPDATE items SET tenant_id = ? WHERE id = ?")
                    ->execute([$personalTenantId, $item['id']]);
                $fixed++;
            } else {
                echo "Warning: Creator $creatorId has no personal tenant. Moving to Default or Delete?\n";
                // Failsafe: Move to first tenant they belong to?
                // Or just leave it?
                // Let's leave it and log warning.
            }
        } else {
             // No creator? Zombie data.
             // Delete or Archive?
             // Let's delete to be safe/clean.
             $pdo->prepare("DELETE FROM items WHERE id = ?")->execute([$item['id']]);
             echo "Deleted zombie item {$item['id']} (no creator)\n";
             $deleted++;
        }
    }

    echo "Migration v14 Completed. Fixed: $fixed, Deleted: $deleted.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
