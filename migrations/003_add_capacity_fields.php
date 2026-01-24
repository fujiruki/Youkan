<?php
require_once 'backend/db.php';

echo "=== Migration: Add Capacity Fields to Memberships ===\n";

try {
    $pdo = getDB();

    // Check if columns exist
    $columns = [];
    $stmt = $pdo->query("PRAGMA table_info(memberships)");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $col) {
        $columns[] = $col['name'];
    }

    if (!in_array('is_core', $columns)) {
        echo "Adding is_core column...\n";
        $pdo->exec("ALTER TABLE memberships ADD COLUMN is_core INTEGER DEFAULT 0");
    } else {
        echo "is_core already exists.\n";
    }

    if (!in_array('daily_capacity_minutes', $columns)) {
        echo "Adding daily_capacity_minutes column...\n";
        $pdo->exec("ALTER TABLE memberships ADD COLUMN daily_capacity_minutes INTEGER DEFAULT 480"); // 8 hours
    } else {
        echo "daily_capacity_minutes already exists.\n";
    }

    echo "Migration completed successfully.\n";

} catch (PDOException $e) {
    echo "Migration Failed: " . $e->getMessage() . "\n";
    exit(1);
}
