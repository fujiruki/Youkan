<?php
// backend/migrate_v19_jbwos_core.php
// Purpose: Add core columns for Judgment-Centered OS (JBWOS) to prevent 500 errors and enable new logic.

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';

try {
    $pdo = getDB();
    echo "Starting JBWOS Core Migration (v19)...\n";
    
    // 1. Add columns to 'items' table
    $columnsToAdd = [
        'due_status' => 'TEXT DEFAULT NULL',   // 'overdue', 'today', 'future' etc - Used by Controller
        'focus_order' => 'INTEGER DEFAULT 0',  // Order within the Focus Queue (Today's List)
        'is_intent' => 'INTEGER DEFAULT 0'     // 1 = "Do Today" Commitment (High Priority/Active Candidate)
    ];

    $tableInfo = $pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_ASSOC);
    $existingCols = array_column($tableInfo, 'name');

    foreach ($columnsToAdd as $colName => $def) {
        if (!in_array($colName, $existingCols)) {
            echo "Adding column 'items.$colName'...\n";
            $pdo->exec("ALTER TABLE items ADD COLUMN $colName $def");
        } else {
            echo "Column 'items.$colName' already exists.\n";
        }
    }

    // 2. Add columns to 'users' table (for Active Task Pointer and display details)
    $userColumnsToAdd = [
        'active_task_id' => 'TEXT DEFAULT NULL',   // Pointer to the single item correctly being done
        'display_name' => 'TEXT DEFAULT NULL',      // User's display name for UI
        'daily_capacity_minutes' => 'INTEGER DEFAULT 480' // Default capacity (8 hours)
    ];

    $userTableInfo = $pdo->query("PRAGMA table_info(users)")->fetchAll(PDO::FETCH_ASSOC);
    $existingUserCols = array_column($userTableInfo, 'name');

    foreach ($userColumnsToAdd as $colName => $def) {
         if (!in_array($colName, $existingUserCols)) {
            echo "Adding column 'users.$colName'...\n";
            $pdo->exec("ALTER TABLE users ADD COLUMN $colName $def");
        } else {
            echo "Column 'users.$colName' already exists.\n";
        }
    }

    echo "Migration v19 completed successfully.\n";

} catch (PDOException $e) {
    echo "Migration Failed: " . $e->getMessage() . "\n";
    exit(1);
}
