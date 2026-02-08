<?php
// backend/migrate_v16_add_missing_cols.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v16 (Fix Missing Columns)...\n";

    // Check project_id
    $columns = [];
    $stmt = $pdo->query("PRAGMA table_info(items)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $columns[] = $row['name'];
    }

    if (!in_array('project_id', $columns)) {
        echo "Adding project_id column...\n";
        $pdo->exec("ALTER TABLE items ADD COLUMN project_id TEXT DEFAULT NULL");
        echo "Added project_id.\n";
    } else {
        echo "project_id already exists.\n";
    }

    echo "Migration v16 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
