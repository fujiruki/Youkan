<?php
/**
 * Migration v22: Add authentication fields to tenants table
 * 
 * This migration:
 * 1. Adds email and password_hash columns to tenants table
 * 2. Migrates existing company accounts from users to tenants
 */

require_once __DIR__ . '/db.php';

function migrate_v22() {
    $pdo = getDB();
    
    echo "[v22] Starting authentication separation migration...\n";
    
    try {
        $pdo->beginTransaction();
        
        // 1. Check current tenants schema
        $columns = [];
        $stmt = $pdo->query("PRAGMA table_info(tenants)");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $columns[] = $row['name'];
        }
        
        // 2. Add email column if not exists
        if (!in_array('email', $columns)) {
            $pdo->exec("ALTER TABLE tenants ADD COLUMN email TEXT");
            echo "[v22] Added 'email' column to tenants\n";
        }
        
        // 3. Add password_hash column if not exists
        if (!in_array('password_hash', $columns)) {
            $pdo->exec("ALTER TABLE tenants ADD COLUMN password_hash TEXT");
            echo "[v22] Added 'password_hash' column to tenants\n";
        }
        
        // 4. Migrate existing company accounts from users table
        // Find users who registered as 'company' type (their email matches a tenant)
        // Note: This is a heuristic based on current data structure
        
        // First, find tenants without credentials
        $tenantsWithoutCreds = $pdo->query("
            SELECT t.id, t.name 
            FROM tenants t 
            WHERE (t.email IS NULL OR t.email = '') 
            AND t.id NOT LIKE 'personal_%'
        ")->fetchAll(PDO::FETCH_ASSOC);
        
        echo "[v22] Found " . count($tenantsWithoutCreds) . " tenants without credentials\n";
        
        // For each tenant without credentials, try to find the owner in memberships
        foreach ($tenantsWithoutCreds as $tenant) {
            $stmt = $pdo->prepare("
                SELECT u.email, u.password_hash 
                FROM memberships m 
                JOIN users u ON m.user_id = u.id 
                WHERE m.tenant_id = ? AND m.role = 'owner'
                LIMIT 1
            ");
            $stmt->execute([$tenant['id']]);
            $owner = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if ($owner && !empty($owner['email'])) {
                // Copy owner's credentials to tenant (for company login)
                $updateStmt = $pdo->prepare("
                    UPDATE tenants 
                    SET email = ?, password_hash = ? 
                    WHERE id = ?
                ");
                $updateStmt->execute([$owner['email'], $owner['password_hash'], $tenant['id']]);
                echo "[v22] Migrated credentials for tenant: {$tenant['name']}\n";
            }
        }
        
        // 5. Create index for tenant email lookup
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_tenants_email ON tenants(email)");
        echo "[v22] Created index on tenants.email\n";
        
        $pdo->commit();
        echo "[v22] Migration completed successfully!\n";
        return true;
        
    } catch (Exception $e) {
        $pdo->rollBack();
        echo "[v22] Migration FAILED: " . $e->getMessage() . "\n";
        return false;
    }
}

// Run migration if called directly
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    migrate_v22();
}
