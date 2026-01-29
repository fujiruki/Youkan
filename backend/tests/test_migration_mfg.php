<?php
// backend/tests/test_migration_mfg.php
require_once __DIR__ . '/../db.php';

function test_migration() {
    echo "--- Starting DB Migration Test (Manufacturing Integration) ---\n";
    $pdo = getDB();

    $tables = ['manufacturing_items', 'company_members'];
    
    foreach ($tables as $table) {
        echo "Checking table: $table... ";
        $stmt = $pdo->prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?");
        $stmt->execute([$table]);
        $exists = $stmt->fetch();
        
        if ($exists) {
            echo "EXISTS\n";
            // Check columns
            $cols = $pdo->query("PRAGMA table_info($table)")->fetchAll(PDO::FETCH_ASSOC);
            echo "Columns:\n";
            foreach ($cols as $col) {
                echo "  - " . $col['name'] . " (" . $col['type'] . ")\n";
            }
        } else {
            echo "NOT FOUND (Expected for first run)\n";
        }
    }
}

test_migration();
