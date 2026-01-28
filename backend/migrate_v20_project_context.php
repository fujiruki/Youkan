<?php
// backend/migrate_v20_project_context.php
// Purpose: Add business-specific columns to the items table for enhanced project management.

ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once __DIR__ . '/db.php';

try {
    $pdo = getDB();
    echo "Starting JBWOS Project Context Migration (v20)...\n";
    
    // 1. Add columns to 'items' table
    $columnsToAdd = [
        'client_name' => 'TEXT DEFAULT NULL',         // Customer/Site name
        'gross_profit_target' => 'INTEGER DEFAULT 0'    // Target gross profit
    ];

    $tableInfo = $pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_ASSOC);
    $existingColumns = array_column($tableInfo, 'name');

    foreach ($columnsToAdd as $col => $type) {
        if (!in_array($col, $existingColumns)) {
            echo "Adding column '$col' to 'items' table...\n";
            $pdo->exec("ALTER TABLE items ADD COLUMN $col $type");
        } else {
            echo "Column '$col' already exists in 'items' table. Skipping.\n";
        }
    }

    echo "Migration v20 (Project Context) successfully applied.\n";

} catch (PDOException $e) {
    die("Migration v20 failed: " . $e->getMessage() . "\n");
}
