<?php
// backend/migrate_v2.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Connected to DB.\n";

    // defined tables check
    $stm = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='items'");
    if (!$stm->fetch()) {
        die("Table 'items' does not exist. Run migrate_v1.php first.\n");
    }

    // Check columns
    $stm = $pdo->query("PRAGMA table_info(items)");
    $columns = $stm->fetchAll(PDO::FETCH_ASSOC);
    $colNames = array_column($columns, 'name');

    $colsToAdd = [
        'due_date' => 'TEXT', // Date string YYYY-MM-DD or null
        'due_status' => "TEXT DEFAULT 'waiting_external'" // 'confirmed', 'waiting_external'
    ];

    foreach ($colsToAdd as $colName => $colType) {
        if (!in_array($colName, $colNames)) {
            echo "Adding column '$colName'...\n";
            $pdo->exec("ALTER TABLE items ADD COLUMN $colName $colType");
        } else {
            echo "Column '$colName' already exists.\n";
        }
    }

    echo "Migration v2 completed.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
