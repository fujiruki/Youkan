<?php
// backend/fix_schema_add_joined_at.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Fixing schema: Adding 'joined_at' to memberships table...\n";

    // Attempt to add column
    $pdo->exec("ALTER TABLE memberships ADD COLUMN joined_at TEXT");
    
    echo "Success: Added 'joined_at' column.\n";

} catch (PDOException $e) {
    if (strpos($e->getMessage(), 'duplicate column name') !== false) {
        echo "Info: 'joined_at' column already exists.\n";
    } else {
        echo "Error: " . $e->getMessage() . "\n";
    }
}
