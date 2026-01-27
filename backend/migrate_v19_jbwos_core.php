<?php
// backend/migrate_v19_jbwos_core.php
// Phase 16: JBWOS Core Refinement - Schema Update
// Goal: Add support for Focus Queue (Order), Intent (Flag), and ActiveTask (Persistence)

require_once __DIR__ . '/db.php';

try {
    $pdo = getDB();
    echo "Starting JBWOS Core Migration (v19)...\n";

    $pdo->beginTransaction();

    // 1. Add 'focus_order' to 'items'
    // Used for sorting items in the Focus Queue. Float allows insertion between items.
    $columns = $pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('focus_order', $columns)) {
        $pdo->exec("ALTER TABLE items ADD COLUMN focus_order REAL DEFAULT 0");
        echo "Added 'focus_order' to 'items'.\n";
    } else {
        echo "'focus_order' already exists in 'items'.\n";
    }

    // 2. Add 'is_intent' to 'items'
    // Flag for "Meaning Layer" items (Important but not urgent).
    if (!in_array('is_intent', $columns)) {
        $pdo->exec("ALTER TABLE items ADD COLUMN is_intent INTEGER DEFAULT 0"); // Boolean 0/1
        echo "Added 'is_intent' to 'items'.\n";
    } else {
        echo "'is_intent' already exists in 'items'.\n";
    }

    // 3. Add 'active_task_id' to 'users'
    // Persist "Current Active Task" across devices.
    $userColumns = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_COLUMN, 1);
    // Note: If 'users' table structure is different (some setups used 'members'), ensure we target the right auth table.
    // Assuming standard 'users' table from AuthController.
    if (!in_array('active_task_id', $userColumns)) {
        $pdo->exec("ALTER TABLE users ADD COLUMN active_task_id TEXT DEFAULT NULL");
        echo "Added 'active_task_id' to 'users'.\n";
    } else {
        echo "'active_task_id' already exists in 'users'.\n";
    }

    $pdo->commit();
    echo "Migration v19 Complete.\n";

} catch (PDOException $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo "Migration Failed: " . $e->getMessage() . "\n";
    exit(1);
}
