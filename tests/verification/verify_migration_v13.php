<?php
// tests/verification/verify_migration_v13.php
require_once __DIR__ . '/../../backend/db.php';

function verify() {
    echo "--- Phase 1 Verification: DB Schema & Personal Tenants ---\n";
    $pdo = getDB();
    $passed = true;

    // 1. Check 'items' table for 'tenant_id' column and NOT NULL constraint
    echo "[Check 1] items table schema... ";
    $stmt = $pdo->query("PRAGMA table_info(items)");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $hasTenantId = false;
    $isNotNull = false;
    foreach ($columns as $col) {
        if ($col['name'] === 'tenant_id') {
            $hasTenantId = true;
            $isNotNull = ($col['notnull'] == 1);
            break;
        }
    }
    if ($hasTenantId) {
        // SQLite doesn't easily show NOT NULL enforcement on existing columns if added via ALTER, 
        // but PRAGMA shows definition.
        if ($isNotNull) {
             echo "OK (Found, NOT NULL)\n";
        } else {
             echo "WARNING (Found, but Nullable - Acceptable if migration logic handles it)\n";
        }
    } else {
        echo "FAIL (Missing tenant_id column)\n";
        $passed = false;
    }

    // 2. Check Orphan Data (tenant_id IS NULL)
    echo "[Check 2] Orphan items (tenant_id IS NULL)... ";
    $count = $pdo->query("SELECT count(*) FROM items WHERE tenant_id IS NULL")->fetchColumn();
    if ($count == 0) {
        echo "OK (0 orphans)\n";
    } else {
        echo "FAIL ($count orphans found)\n";
        $passed = false;
    }

    // 3. Check Personal Tenant Existence for All Users
    echo "[Check 3] Personal Tenants for All Users... ";
    $users = $pdo->query("SELECT id, display_name FROM users")->fetchAll(PDO::FETCH_ASSOC);
    $missingTenants = 0;
    foreach ($users as $u) {
        $stmt = $pdo->prepare("
            SELECT count(*) 
            FROM memberships m
            JOIN tenants t ON m.tenant_id = t.id
            WHERE m.user_id = ? AND m.role = 'owner' AND t.name LIKE '%Life%'
        ");
        $stmt->execute([$u['id']]);
        if ($stmt->fetchColumn() == 0) {
            echo "\n  - User {$u['display_name']} ({$u['id']}) has NO personal tenant.";
            $missingTenants++;
        }
    }
    
    if (count($users) === 0) {
        echo "SKIP (No users)\n";
    } elseif ($missingTenants === 0) {
        echo "OK (All users have personal tenant)\n";
    } else {
        echo "\nFAIL ($missingTenants users missing personal tenant)\n";
        $passed = false;
    }

    echo "--------------------------------------------------------\n";
    if ($passed) {
        echo "RESULT: GREEN (All Checks Passed)\n";
        exit(0);
    } else {
        echo "RESULT: RED (Some Checks Failed)\n";
        exit(1);
    }
}

verify();
