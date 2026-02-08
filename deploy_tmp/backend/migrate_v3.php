<?php
// backend/migrate_v3.php
// Add is_boosted and boosted_date to items table

require_once 'db.php';

try {
    $db = getDB();
    
    // Check if column exists (mock check by selecting one item)
    // SQLite doesn't support IF NOT EXISTS in ADD COLUMN easily in old versions,
    // but modern ones do. Or we just try catch.
    
    echo "Migrating v3...<br>";
    
    try {
        $db->exec("ALTER TABLE items ADD COLUMN is_boosted INTEGER DEFAULT 0");
        echo "Added is_boosted column.<br>";
    } catch (PDOException $e) {
        echo "is_boosted column might already exist: " . $e->getMessage() . "<br>";
    }

    try {
        $db->exec("ALTER TABLE items ADD COLUMN boosted_date INTEGER DEFAULT NULL");
        echo "Added boosted_date column.<br>";
    } catch (PDOException $e) {
        echo "boosted_date column might already exist: " . $e->getMessage() . "<br>";
    }
    
    echo "Migration v3 Complete!";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
