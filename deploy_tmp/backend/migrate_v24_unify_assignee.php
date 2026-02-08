<?php
/**
 * Migration v24: Unify assignee column name to assigned_to
 */
require_once __DIR__ . '/db.php';

function migrate_v24() {
    $pdo = getDB();
    echo "[v24] Unifying assignee column name...\n";
    
    try {
        $pdo->beginTransaction();
        
        // 1. Check if assigned_to already exists
        $columns = [];
        $stmt = $pdo->query("PRAGMA table_info(items)");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $columns[] = $row['name'];
        }
        
        if (in_array('assigned_to', $columns)) {
            echo "[v24] column 'assigned_to' already exists.\n";
            if (in_array('assignee_id', $columns)) {
                // If both exist, migrate data and drop assignee_id if possible
                // SQLite 3.35.0+ supports DROP COLUMN, but for compatibility we might just leave it
                echo "[v24] Both columns exist. Syncing data from assignee_id to assigned_to...\n";
                $pdo->exec("UPDATE items SET assigned_to = assignee_id WHERE assigned_to IS NULL AND assignee_id IS NOT NULL");
            }
        } else if (in_array('assignee_id', $columns)) {
            // Rename assignee_id to assigned_to
            // For SQLite < 3.25.0 we'd need a temp table, but modern enough supports RENAME COLUMN
            try {
                $pdo->exec("ALTER TABLE items RENAME COLUMN assignee_id TO assigned_to");
                echo "[v24] Renamed assignee_id to assigned_to.\n";
            } catch (Exception $e) {
                echo "[v24] RENAME COLUMN failed, attempting ADD and UPDATE...\n";
                $pdo->exec("ALTER TABLE items ADD COLUMN assigned_to TEXT DEFAULT NULL");
                $pdo->exec("UPDATE items SET assigned_to = assignee_id");
            }
        } else {
            // Neither exists
            echo "[v24] Adding assigned_to column...\n";
            $pdo->exec("ALTER TABLE items ADD COLUMN assigned_to TEXT DEFAULT NULL");
        }
        
        $pdo->commit();
        echo "[v24] Migration completed successfully!\n";
        return true;
    } catch (Exception $e) {
        $pdo->rollBack();
        echo "[v24] Migration FAILED: " . $e->getMessage() . "\n";
        return false;
    }
}

if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    migrate_v24();
}
