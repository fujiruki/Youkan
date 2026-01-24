<?php
// backend/migrate_unified_items.php
require_once 'db.php';
$pdo = getDB();

echo "=== Migration: Unified Item Architecture ===\n";

try {
    $pdo->beginTransaction();

    // 1. Add Columns to Items
    echo "1. Adding columns to items table...\n";
    $columnsToAdd = [
        'project_type' => 'TEXT',
        'client' => 'TEXT',
        'meta' => 'TEXT' 
        // assigned_to, created_by, tenant_id already exist
        // parent_id exists
    ];

    $existingCols = [];
    $stmt = $pdo->query("PRAGMA table_info(items)");
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        $existingCols[] = $row['name'];
    }

    foreach ($columnsToAdd as $col => $type) {
        if (!in_array($col, $existingCols)) {
            $pdo->exec("ALTER TABLE items ADD COLUMN $col $type");
            echo "   -> Added $col\n";
        } else {
            echo "   -> Skipped $col (exists)\n";
        }
    }

    // 2. Migrate Projects Data
    echo "2. Migrating data from projects to items...\n";
    
    // Check if projects table exists
    $check = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")->fetch();
    if ($check) {
        $stmt = $pdo->query("SELECT * FROM projects");
        $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $insert = $pdo->prepare("
            INSERT INTO items (
                id, tenant_id, title, project_type, client, meta, 
                status, created_at, updated_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, 
                ?, ?, ?
            )
        ");

        $updates = 0;
        foreach ($projects as $p) {
            // Check if already migrated
            $exists = $pdo->query("SELECT id FROM items WHERE id = '{$p['id']}'")->fetch();
            if ($exists) {
                // Determine if we should update or skip. Let's skip to be safe, or update type.
                $pdo->exec("UPDATE items SET project_type = 'general' WHERE id = '{$p['id']}'");
                continue; 
            }

            // Map Fields
            // meta includes: settings_json, dxf_config_json, gross_profit_target, color, view_mode
            $meta = [
                'settings' => json_decode($p['settings_json'] ?? '{}', true),
                'dxf_config' => json_decode($p['dxf_config_json'] ?? '{}', true),
                'gross_profit_target' => $p['gross_profit_target'],
                'color' => $p['color'],
                'view_mode' => $p['view_mode']
            ];

            // Determine Project Type from settings if possible, default to 'general' (or 'manufacturing' if logic implies)
            // For now, map all to 'general' unless settings says otherwise
            $type = 'general';
            if (isset($meta['settings']['type'])) {
                $type = $meta['settings']['type'];
            }

            // Status Map
            // projects.judgment_status -> items.status (inbox, confirmed, etc)
            $status = $p['judgment_status'] ?? 'inbox'; // Default logic

            $insert->execute([
                $p['id'],
                $p['tenant_id'],
                $p['name'],
                $type,
                $p['client'],
                json_encode($meta),
                $status,
                $p['created_at'],
                $p['updated_at']
            ]);
            $updates++;
        }
        echo "   -> Migrated $updates projects.\n";

        // 3. Rename/Drop Projects Table
        // For safety, rename to projects_backup
        echo "3. Renaming projects table to projects_backup...\n";
        $pdo->exec("ALTER TABLE projects RENAME TO projects_backup_" . time());
        
    } else {
        echo "   -> Projects table not found (Already migrated?).\n";
    }

    $pdo->commit();
    echo "=== Migration Complete ===\n";

} catch (Exception $e) {
    $pdo->rollBack();
    echo "ERROR: " . $e->getMessage() . "\n";
}
