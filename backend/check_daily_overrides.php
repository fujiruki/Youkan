<?php
// backend/check_daily_overrides.php
require_once 'db.php';

try {
    $pdo = getDB();
    $stmt = $pdo->query("PRAGMA table_info(users)");
    $columns = $stmt->fetchAll(PDO::FETCH_COLUMN, 1);

    if (in_array('daily_overrides', $columns)) {
        echo "SUCCESS: 'daily_overrides' column exists.\n";
    } else {
        echo "FAILURE: 'daily_overrides' column is MISSING.\n";
        exit(1);
    }
} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    exit(1);
}
