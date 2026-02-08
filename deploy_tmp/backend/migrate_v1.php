<?php
// backend/migrate_v1.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v1...\n";

    // 1. Create events table
    $pdo->exec("CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        payload TEXT,
        created_at INTEGER
    )");
    echo "Created events table.\n";

    // 2. Create daily_logs table
    $pdo->exec("CREATE TABLE IF NOT EXISTS daily_logs (
        id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        category TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at INTEGER
    )");
    echo "Created daily_logs table.\n";

    // 3. Create side_memos table
    $pdo->exec("CREATE TABLE IF NOT EXISTS side_memos (
        id TEXT PRIMARY KEY,
        content TEXT NOT NULL,
        created_at INTEGER
    )");
    echo "Created side_memos table.\n";

    // 4. Update items table (Add RDD columns)
    // Check if columns exist first to avoid error on re-run
    $columns = $pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_ASSOC);
    $hasRddDate = false;
    foreach ($columns as $col) {
        if ($col['name'] === 'rdd_date') {
            $hasRddDate = true;
            break;
        }
    }

    if (!$hasRddDate) {
        $pdo->exec("ALTER TABLE items ADD COLUMN rdd_date INTEGER");
        $pdo->exec("ALTER TABLE items ADD COLUMN rdd_note TEXT");
        echo "Added RDD columns to items table.\n";
    } else {
        echo "RDD columns already exist.\n";
    }

    echo "Migration v1 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
