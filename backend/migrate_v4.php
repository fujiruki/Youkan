<?php
// backend/migrate_v4.php
// Add prep_date (Preparation Target / Blurry Date) to items table
// Rule: This is a "Weak" column. Nullable, No Index.

require_once 'db.php';

try {
    $db = getDB();
    echo "Migrating v4...<br>";
    
    // Add prep_date
    // Using INTEGER (timestamp) to allow easy calendar plotting, but it represents a "fuzzy" target.
    // It should NOT be used for strict deadline logic.
    try {
        $db->exec("ALTER TABLE items ADD COLUMN prep_date INTEGER DEFAULT NULL");
        echo "Added prep_date column (Nullable, No Index).<br>";
    } catch (PDOException $e) {
        echo "prep_date column might already exist: " . $e->getMessage() . "<br>";
    }

    echo "Migration v4 Complete!";
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
