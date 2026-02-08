<?php
// backend/migrate_v23_tenant_id_nullable.php
require_once __DIR__ . '/db.php';

function migrate_v23() {
    $pdo = getDB();
    // Set busy timeout to 5 seconds
    $pdo->exec("PRAGMA busy_timeout = 5000");
    echo "[v23] Starting migration to make tenant_id nullable...\n";

    try {
        $pdo->beginTransaction();

        // 1. Get current schema to ensure we don't lose anything
        $stmt = $pdo->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'");
        $createSql = $stmt->fetchColumn();
        
        if (!$createSql) {
            throw new Exception("Table 'items' not found.");
        }

        // 2. Identify if nullable already
        if (stripos($createSql, 'tenant_id TEXT NOT NULL') === false) {
             echo "[v23] tenant_id is already nullable or schema is different. Skipping.\n";
             $pdo->rollBack();
             return;
        }

        // 3. Prepare new schema (Remove NOT NULL from tenant_id)
        $newCreateSql = str_ireplace('tenant_id TEXT NOT NULL', 'tenant_id TEXT', $createSql);

        // 4. Transform table
        $pdo->exec("ALTER TABLE items RENAME TO items_old");
        $pdo->exec($newCreateSql);
        
        // Copy columns (Identify columns dynamically)
        $colsStmt = $pdo->query("PRAGMA table_info(items_old)");
        $cols = [];
        while ($row = $colsStmt->fetch(PDO::FETCH_ASSOC)) {
            $cols[] = $row['name'];
        }
        $colList = implode(', ', $cols);
        
        $pdo->exec("INSERT INTO items ($colList) SELECT $colList FROM items_old");
        
        // 5. Drop old table
        $pdo->exec("DROP TABLE items_old");

        // 6. Update empty strings to NULL (As per Haruki's preference)
        $pdo->exec("UPDATE items SET tenant_id = NULL WHERE tenant_id = ''");

        $pdo->commit();
        echo "[v23] Migration successful! tenant_id is now nullable and empty strings converted to NULL.\n";

    } catch (Exception $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        echo "[v23] Migration FAILED: " . $e->getMessage() . "\n";
    }
}

migrate_v23();
