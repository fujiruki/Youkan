<?php
// backend/migrate_v8_execution_tracking.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v8 (Execution & Life Persistence)...\n";

    // --- 1. Modify projects table ---
    $columns = $pdo->query("PRAGMA table_info(projects)")->fetchAll(PDO::FETCH_ASSOC);
    $hasGrossProfit = false;
    $hasColor = false;
    foreach ($columns as $col) {
        if ($col['name'] === 'gross_profit_target') $hasGrossProfit = true;
        if ($col['name'] === 'color') $hasColor = true;
    }

    if (!$hasGrossProfit) {
        $pdo->exec("ALTER TABLE projects ADD COLUMN gross_profit_target INTEGER DEFAULT 0");
        echo "Added gross_profit_target to projects.\n";
    }
    if (!$hasColor) {
        $pdo->exec("ALTER TABLE projects ADD COLUMN color TEXT");
        echo "Added color to projects.\n";
    }

    // --- 2. Modify items table ---
    $itemColumns = $pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_ASSOC);
    $hasProjectId = false;
    foreach ($itemColumns as $col) {
        if ($col['name'] === 'project_id') $hasProjectId = true;
    }

    if (!$hasProjectId) {
        $pdo->exec("ALTER TABLE items ADD COLUMN project_id TEXT DEFAULT NULL");
        echo "Added project_id to items.\n";
    }

    // --- 3. Modify daily_logs table ---
    $logColumns = $pdo->query("PRAGMA table_info(daily_logs)")->fetchAll(PDO::FETCH_ASSOC);
    $hasLogProjectId = false;
    $hasLogItemId = false;
    $hasDuration = false;
    $hasProfitShare = false;

    foreach ($logColumns as $col) {
        if ($col['name'] === 'project_id') $hasLogProjectId = true;
        if ($col['name'] === 'item_id') $hasLogItemId = true;
        if ($col['name'] === 'duration_minutes') $hasDuration = true;
        if ($col['name'] === 'gross_profit_share') $hasProfitShare = true;
    }

    if (!$hasLogProjectId) {
        $pdo->exec("ALTER TABLE daily_logs ADD COLUMN project_id TEXT DEFAULT NULL");
        echo "Added project_id to daily_logs.\n";
    }
    if (!$hasLogItemId) {
        $pdo->exec("ALTER TABLE daily_logs ADD COLUMN item_id TEXT DEFAULT NULL");
        echo "Added item_id to daily_logs.\n";
    }
    if (!$hasDuration) {
        $pdo->exec("ALTER TABLE daily_logs ADD COLUMN duration_minutes INTEGER DEFAULT 0");
        echo "Added duration_minutes to daily_logs.\n";
    }
    if (!$hasProfitShare) {
        $pdo->exec("ALTER TABLE daily_logs ADD COLUMN gross_profit_share INTEGER DEFAULT 0");
        echo "Added gross_profit_share to daily_logs.\n";
    }

    echo "Migration v8 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
