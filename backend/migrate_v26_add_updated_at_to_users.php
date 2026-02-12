<?php
// backend/migrate_v26_add_updated_at_to_users.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v26 (Add updated_at to users)...\n";

    $columns = [];
    $stmt = $pdo->query("PRAGMA table_info(users)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $columns[] = $row['name'];
    }

    if (!in_array('updated_at', $columns)) {
        echo "Adding updated_at column to users table...\n";
        $pdo->exec("ALTER TABLE users ADD COLUMN updated_at INTEGER DEFAULT 0");
        echo "Added updated_at.\n";
        
        // Populate existing rows with current time
        $now = time();
        $pdo->exec("UPDATE users SET updated_at = $now WHERE updated_at = 0");
        echo "Populated existing rows with current timestamp.\n";
    } else {
        echo "updated_at column already exists in users table.\n";
    }

    echo "Migration v26 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
