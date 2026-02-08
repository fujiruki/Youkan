<?php
// backend/migrate_v25_archive_trash.php
require_once __DIR__ . '/db.php';

try {
    $pdo = getDB();
    echo "Starting Migration v25: Archive & Trash Columns...\n";
    
    // Check columns in 'items' table
    $columns = [];
    $stmt = $pdo->query("PRAGMA table_info(items)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $columns[] = $row['name'];
    }
    
    // Add is_archived if missing
    if (!in_array('is_archived', $columns)) {
        echo "Adding 'is_archived' column...\n";
        $pdo->exec("ALTER TABLE items ADD COLUMN is_archived INTEGER DEFAULT 0");
    } else {
        echo "'is_archived' column already exists.\n";
    }
    
    // Add deleted_at if missing
    if (!in_array('deleted_at', $columns)) {
        echo "Adding 'deleted_at' column...\n";
        $pdo->exec("ALTER TABLE items ADD COLUMN deleted_at INTEGER DEFAULT NULL");
    } else {
        echo "'deleted_at' column already exists.\n";
    }
    
    echo "Migration v25 Complete.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
