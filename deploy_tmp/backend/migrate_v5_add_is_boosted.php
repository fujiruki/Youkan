<?php
// backend/migrate_v5_add_is_boosted.php
require_once 'db.php';

// Enable error reporting
ini_set('display_errors', 1);
error_reporting(E_ALL);

header('Content-Type: text/plain');

$pdo = getDB();

function addColumnIfNotExists($pdo, $table, $column, $type, $default = null) {
    try {
        // Check if column exists
        $stmt = $pdo->prepare("PRAGMA table_info($table)");
        $stmt->execute();
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $exists = false;
        foreach ($columns as $col) {
            if ($col['name'] === $column) {
                $exists = true;
                break;
            }
        }
        
        if (!$exists) {
            $sql = "ALTER TABLE $table ADD COLUMN $column $type";
            if ($default !== null) {
                $sql .= " DEFAULT $default";
            }
            $pdo->exec($sql);
            echo "Added column '$column' to table '$table'.\n";
        } else {
            echo "Column '$column' already exists in table '$table'.\n";
        }
    } catch (Exception $e) {
        echo "Error adding column '$column': " . $e->getMessage() . "\n";
    }
}

echo "Starting Migration v5...\n";

// Add is_boosted
addColumnIfNotExists($pdo, 'items', 'is_boosted', 'INTEGER', 0);

// Add boosted_date (Timestamp for boost expiry)
addColumnIfNotExists($pdo, 'items', 'boosted_date', 'INTEGER', 'NULL');

// Add rdd_date (Reasonable Due Date?)
addColumnIfNotExists($pdo, 'items', 'rdd_date', 'TEXT', 'NULL');

// Add work_days (just in case)
addColumnIfNotExists($pdo, 'items', 'work_days', 'REAL', 1.0); 

// Add due_date if missing (should be there but just checking)
addColumnIfNotExists($pdo, 'items', 'due_date', 'TEXT', 'NULL');

echo "Migration v5 Completed.\n";
