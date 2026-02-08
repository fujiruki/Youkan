<?php
// backend/migrate_settings_schema.php
require_once 'db.php';

function addColumn($pdo, $table, $column, $type) {
    try {
        $pdo->exec("ALTER TABLE $table ADD COLUMN $column $type");
        echo "Success: Added '$column' to '$table'.\n";
    } catch (PDOException $e) {
        if (strpos($e->getMessage(), 'duplicate column name') !== false) {
            echo "Info: '$column' already exists in '$table'.\n";
        } else {
            echo "Error adding '$column' to '$table': " . $e->getMessage() . "\n";
        }
    }
}

try {
    $pdo = getDB();
    echo "Starting schema migration for Settings...\n";

    // 1. Memberships table updates
    addColumn($pdo, 'memberships', 'is_core', 'INTEGER DEFAULT 0');

    // 2. Users table updates
    addColumn($pdo, 'users', 'birthday', 'TEXT');
    addColumn($pdo, 'users', 'daily_capacity_minutes', 'INTEGER DEFAULT 480'); // 8 hours default
    addColumn($pdo, 'users', 'non_working_hours', 'TEXT'); // JSON or string for holidays/hours

    echo "Migration completed.\n";

} catch (PDOException $e) {
    echo "Fatal Error: " . $e->getMessage() . "\n";
}
