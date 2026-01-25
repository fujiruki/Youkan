<?php
// backend/migrate_v17_cloud_normalization.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v17 (Cloud Normalization)...\n";

    // 1. Add 'preferences' to users table
    $columns = [];
    $stmt = $pdo->query("PRAGMA table_info(users)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $columns[] = $row['name'];
    }
    if (!in_array('preferences', $columns)) {
        echo "Adding preferences to users table...\n";
        $pdo->exec("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT '{}'");
    }

    // 2. Add 'preferences' to tenants table
    $columns = [];
    $stmt = $pdo->query("PRAGMA table_info(tenants)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $columns[] = $row['name'];
    }
    if (!in_array('preferences', $columns)) {
        echo "Adding preferences to tenants table...\n";
        $pdo->exec("ALTER TABLE tenants ADD COLUMN preferences TEXT DEFAULT '{}'");
    }

    // 3. Create 'assignees' table
    $pdo->exec("CREATE TABLE IF NOT EXISTS assignees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'external',
        email TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )");
    echo "Ensured assignees table exists.\n";

    // 4. Create 'project_categories' table
    $pdo->exec("CREATE TABLE IF NOT EXISTS project_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tenant_id TEXT NOT NULL,
        name TEXT NOT NULL,
        icon TEXT,
        domain TEXT DEFAULT 'general',
        is_custom INTEGER DEFAULT 1,
        created_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    )");
    echo "Ensured project_categories table exists.\n";

    // 5. Create 'life_logs' table
    $pdo->exec("CREATE TABLE IF NOT EXISTS life_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        item_id TEXT NOT NULL,
        checked_at INTEGER DEFAULT (strftime('%s', 'now')),
        FOREIGN KEY (user_id) REFERENCES users(id)
    )");
    // Create Index
    $pdo->exec("CREATE INDEX IF NOT EXISTS idx_life_logs_user_date ON life_logs(user_id, checked_at)");
    echo "Ensured life_logs table exists.\n";

    echo "Migration v17 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
