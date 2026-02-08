<?php
// backend/migrate_v13_personal_tenants.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting Migration v13: Backfill Personal Tenants...\n";

    // 1. Get all users
    $users = $pdo->query("SELECT id, display_name FROM users")->fetchAll(PDO::FETCH_ASSOC);
    $count = 0;

    foreach ($users as $user) {
        $userId = $user['id'];
        $userName = $user['display_name'] ?: 'User';

        // 2. Check strict personal tenant existence (Owner of '{Name}'s Life')
        // Using LIKE to be safe, but ideally type='personal' column should exist.
        // For now, we rely on naming convention or just create if no owner membership exists?
        // No, user might own a company.
        // Let's check naming convention OR we can add 'type' to tenants table if we want strictness.
        // For now, let's create if NO tenant named "{Name}'s Life" is owned.

        $personalTenantName = $userName . "'s Life";
        
        $stmt = $pdo->prepare("
            SELECT count(*) 
            FROM memberships m
            JOIN tenants t ON m.tenant_id = t.id
            WHERE m.user_id = ? AND m.role = 'owner' AND t.name = ?
        ");
        $stmt->execute([$userId, $personalTenantName]);
        
        if ($stmt->fetchColumn() == 0) {
            // Create Personal Tenant
            $tenantId = 't_personal_' . uniqid();
            echo "Creating personal tenant for $userName ($userId)...\n";
            
            // Note: If 'type' column doesn't exist in tenants, we just insert standard cols.
            // Future migration should add 'type'. For now, name is the indicator.
            $pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)")
                ->execute([$tenantId, $personalTenantName, time()]);
            
            // Link
            $pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES (?, ?, 'owner', ?)")
                ->execute([$userId, $tenantId, time()]);
            
            $count++;
        }
    }

    echo "Migration v13 Completed. Created $count personal tenants.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
