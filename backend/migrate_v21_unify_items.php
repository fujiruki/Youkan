<?php
/**
 * Migration v21: Unify items and projects tables
 * 
 * This migration:
 * 1. Copies all projects into items table (with is_project = 1)
 * 2. Updates items.parent_id from items.project_id
 * 3. Drops the projects table
 * 
 * IMPORTANT: Run this migration only once. Backup database before running.
 */

require_once __DIR__ . '/db.php';

function migrate_v21() {
    $pdo = getDB();
    
    echo "[v21] Starting items/projects unification migration...\n";
    
    try {
        $pdo->beginTransaction();
        
        // 0. Check if migration is needed
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")->fetchColumn();
        if (!$tables) {
            echo "[v21] 'projects' table does not exist. Migration may have already been applied.\n";
            $pdo->rollBack();
            return true;
        }
        
        // 1. Ensure items table has required columns
        $columns = [];
        $stmt = $pdo->query("PRAGMA table_info(items)");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $columns[] = $row['name'];
        }
        
        $requiredColumns = [
            'parent_id' => 'TEXT DEFAULT NULL',
            'is_project' => 'INTEGER DEFAULT 0',
            'assignee_id' => 'TEXT DEFAULT NULL',
            'client_name' => 'TEXT DEFAULT NULL',
            'gross_profit_target' => 'INTEGER DEFAULT 0',
        ];
        
        foreach ($requiredColumns as $col => $def) {
            if (!in_array($col, $columns)) {
                $pdo->exec("ALTER TABLE items ADD COLUMN $col $def");
                echo "[v21] Added column: $col\n";
            }
        }
        
        // 2. Copy projects into items
        $stmt = $pdo->query("SELECT * FROM projects");
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo "[v21] Found " . count($projects) . " projects to migrate.\n";
        
        $insertStmt = $pdo->prepare("
            INSERT OR IGNORE INTO items (
                id, title, tenant_id, created_by, is_project, status, 
                client_name, gross_profit_target, project_type, created_at, updated_at
            ) VALUES (
                :id, :title, :tenant_id, :created_by, 1, 'active',
                :client_name, :gross_profit_target, :project_type, :created_at, :updated_at
            )
        ");
        
        foreach ($projects as $project) {
            $insertStmt->execute([
                ':id' => $project['id'],
                ':title' => $project['title'],
                ':tenant_id' => $project['tenant_id'] ?? '',
                ':created_by' => $project['created_by'] ?? '',
                ':client_name' => $project['client_name'] ?? null,
                ':gross_profit_target' => $project['gross_profit_target'] ?? 0,
                ':project_type' => $project['project_type'] ?? null,
                ':created_at' => $project['created_at'] ?? time(),
                ':updated_at' => $project['updated_at'] ?? time(),
            ]);
            echo "[v21] Migrated project: {$project['id']} - {$project['title']}\n";
        }
        
        // 3. Update items.parent_id from items.project_id
        $updated = $pdo->exec("
            UPDATE items 
            SET parent_id = project_id 
            WHERE project_id IS NOT NULL AND project_id != ''
        ");
        echo "[v21] Updated parent_id for $updated items.\n";
        
        // 4. Set is_project = 1 for items that have children
        $pdo->exec("
            UPDATE items 
            SET is_project = 1 
            WHERE id IN (SELECT DISTINCT parent_id FROM items WHERE parent_id IS NOT NULL)
        ");
        echo "[v21] Marked parent items as projects.\n";
        
        // 5. Drop project_id column (SQLite workaround - create new table)
        // Note: SQLite doesn't support DROP COLUMN directly in older versions
        // For now, we'll leave project_id but stop using it
        echo "[v21] Note: project_id column left in place (SQLite limitation). It will be ignored.\n";
        
        // 6. Drop projects table
        $pdo->exec("DROP TABLE IF EXISTS projects");
        echo "[v21] Dropped 'projects' table.\n";
        
        // 7. Create index for parent_id if not exists
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_items_parent ON items(parent_id)");
        $pdo->exec("CREATE INDEX IF NOT EXISTS idx_items_is_project ON items(is_project)");
        echo "[v21] Created indexes.\n";
        
        $pdo->commit();
        echo "[v21] Migration completed successfully!\n";
        return true;
        
    } catch (Exception $e) {
        $pdo->rollBack();
        echo "[v21] Migration FAILED: " . $e->getMessage() . "\n";
        return false;
    }
}

// Run migration if called directly
if (basename(__FILE__) === basename($_SERVER['SCRIPT_FILENAME'] ?? '')) {
    migrate_v21();
}
