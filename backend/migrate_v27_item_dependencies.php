<?php
// backend/migrate_v27_item_dependencies.php
// item_dependencies テーブルを作成するマイグレーション
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v27 (item_dependencies)...\n";

    $tables = [];
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $tables[] = $row['name'];
    }

    if (!in_array('item_dependencies', $tables)) {
        echo "Creating item_dependencies table...\n";
        $pdo->exec("
            CREATE TABLE IF NOT EXISTS item_dependencies (
                id TEXT PRIMARY KEY,
                tenant_id TEXT,
                source_item_id TEXT NOT NULL,
                target_item_id TEXT NOT NULL,
                created_at INTEGER,
                FOREIGN KEY(source_item_id) REFERENCES items(id),
                FOREIGN KEY(target_item_id) REFERENCES items(id),
                UNIQUE(source_item_id, target_item_id)
            )
        ");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_dep_source ON item_dependencies(source_item_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_dep_target ON item_dependencies(target_item_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_dep_tenant ON item_dependencies(tenant_id)");
        echo "item_dependencies table created.\n";
    } else {
        echo "item_dependencies table already exists.\n";
    }

    echo "Migration v27 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
