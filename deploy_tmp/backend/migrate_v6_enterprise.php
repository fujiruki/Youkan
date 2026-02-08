<?php
// backend/migrate_v6_enterprise.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Starting migration v6 (Enterprise Features)...\n";

    // 1. Create stocks table (Unassigned Jobs)
    // estimated_minutes: Workload weight
    // project_id: Link to projects or deliverables
    $pdo->exec("CREATE TABLE IF NOT EXISTS stocks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        project_id TEXT,
        estimated_minutes INTEGER DEFAULT 0,
        due_date TEXT,
        status TEXT DEFAULT 'open',
        created_at INTEGER
    )");
    echo "Created stocks table.\n";

    // 2. Create projects table (Project Monitor)
    // progress_rate: Cached progress percentage (0-100)
    $pdo->exec("CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        progress_rate INTEGER DEFAULT 0,
        total_weight INTEGER DEFAULT 0,
        current_weight INTEGER DEFAULT 0,
        created_at INTEGER
    )");
    echo "Created projects table.\n";

    // 3. Create user_configs table (Individual Settings)
    // calendar_configs: JSON mapping for calendars
    $pdo->exec("CREATE TABLE IF NOT EXISTS user_configs (
        user_id TEXT PRIMARY KEY,
        daily_capacity_minutes INTEGER DEFAULT 480,
        work_cal_id TEXT,
        private_cal_id TEXT
    )");
    echo "Created user_configs table.\n";

    // 4. Create daily_volumes table (Aggregated Heatmap)
    // Primary Key is Composite (user_id, date)
    $pdo->exec("CREATE TABLE IF NOT EXISTS daily_volumes (
        user_id TEXT,
        date TEXT,
        total_minutes INTEGER DEFAULT 0,
        capacity_minutes INTEGER DEFAULT 480,
        PRIMARY KEY (user_id, date)
    )");
    echo "Created daily_volumes table.\n";

    echo "Migration v6 completed successfully.\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
    exit(1);
}
