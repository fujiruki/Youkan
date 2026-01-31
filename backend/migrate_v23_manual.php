<?php
// backend/migrate_v23_manual.php

$originalDb = __DIR__ . '/jbwos.sqlite';
$tempDb = sys_get_temp_dir() . '/jbwos_migration_temp.sqlite';

echo "[Manual Migration] Original: $originalDb\n";
echo "[Manual Migration] Temp: $tempDb\n";

// 1. Copy DB and WAL files to TEMP
if (!file_exists($originalDb)) {
    die("Original DB not found.\n");
}

$extensions = ['', '-wal', '-shm'];
foreach ($extensions as $ext) {
    $src = $originalDb . $ext;
    $dst = $tempDb . $ext;
    if (file_exists($src)) {
        if (!copy($src, $dst)) {
             die("Failed to copy $src to temp.\n");
        }
        echo "[Manual Migration] Copied $src to Temp.\n";
    }
}

try {
    // 2. Connect to Temp DB
    $pdo = new PDO('sqlite:' . $tempDb);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Disable WAL for the temp operation to reduce complexity
    $pdo->exec("PRAGMA journal_mode = DELETE");
    
    echo "[Manual Migration] Connected to Temp DB.\n";
    
    $pdo->beginTransaction();

    // 3. Check schema
    $stmt = $pdo->query("SELECT sql FROM sqlite_master WHERE type='table' AND name='items'");
    $createSql = $stmt->fetchColumn();
    
    if (stripos($createSql, 'tenant_id TEXT NOT NULL') === false) {
        echo "[Manual Migration] tenant_id is already nullable. Skipping schema change.\n";
    } else {
        $stmt->closeCursor();
        $stmt = null;
        
        echo "[Manual Migration] Modifying schema (tenant_id TEXT NOT NULL -> TEXT)...\n";
        
        // 4. Schema Change
        $newCreateSql = str_ireplace('tenant_id TEXT NOT NULL', 'tenant_id TEXT', $createSql);

        $pdo->exec("ALTER TABLE items RENAME TO items_old");
        $pdo->exec($newCreateSql);

        $colsStmt = $pdo->query("PRAGMA table_info(items_old)");
        $cols = [];
        while ($row = $colsStmt->fetch(PDO::FETCH_ASSOC)) {
            $cols[] = $row['name'];
        }
        $colsStmt->closeCursor();
        $colsStmt = null;
        
        $colList = implode(', ', $cols);

        $pdo->exec("INSERT INTO items ($colList) SELECT $colList FROM items_old");
        $pdo->exec("DROP TABLE items_old");
        
        echo "[Manual Migration] Schema changed.\n";
    }

    // 5. Data Cleanup
    $count = $pdo->exec("UPDATE items SET tenant_id = NULL WHERE tenant_id = ''");
    echo "[Manual Migration] Converted $count empty tenant_ids to NULL.\n";

    $pdo->commit();
    
    // Close connection to release lock on temp file
    $pdo = null; 
    gc_collect_cycles();
    
    echo "[Manual Migration] DB Operations Finished.\n";

    // 6. Copy Back
    if (!copy($tempDb, $originalDb)) {
         echo "[Manual Migration] WARNING: Failed to overwrite original DB. Please manually replace 'jbwos.sqlite' with:\n$tempDb\n";
    } else {
         echo "[Manual Migration] SUCCESS! Original DB updated.\n";
    }
    
    // Cleanup
    // unlink($tempDb);

} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    die("[Manual Migration] FAILED: " . $e->getMessage() . "\n");
}
