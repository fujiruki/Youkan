<?php
// backend/migrate_fix_user_schema.php
// ユーザーテーブルに active_task_id カラムを追加するスクリプト

require_once 'db.php';

try {
    $pdo = getDB();
    echo "Checking 'users' table schema...\n";

    // check if column exists
    $stmt = $pdo->query("PRAGMA table_info(users)");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    $hasActiveTaskId = false;
    foreach ($columns as $col) {
        if ($col['name'] === 'active_task_id') {
            $hasActiveTaskId = true;
            break;
        }
    }

    if ($hasActiveTaskId) {
        echo "[OK] 'active_task_id' column already exists.\n";
    } else {
        echo "[INFO] Adding 'active_task_id' column to 'users' table...\n";
        $pdo->exec("ALTER TABLE users ADD COLUMN active_task_id TEXT DEFAULT NULL");
        echo "[SUCCESS] Column added.\n";
    }

    // Also check for project creation error potential: tenant_id
    // items table schema check?
    // ProjectController.php line 147 inserts into items.
    // Ensure items table is robust enough? 
    // It is likely items table is already fine, usually issues are logic based.
    
    echo "Migration check complete.\n";

} catch (Exception $e) {
    echo "[ERROR] Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
