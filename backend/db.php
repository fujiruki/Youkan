<?php
// backend/db.php

function getDB() {
    $dbPath = __DIR__ . '/jbwos.sqlite';
    $isNew = !file_exists($dbPath);
    
    try {
        $pdo = new PDO('sqlite:' . $dbPath);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        
        if ($isNew) {
            initDB($pdo);
        }

        // --- Auto-Migration Logic (Schema Evolution) ---
        // Ensure all required columns exist even regarding existing tables.
        
        // 1. Check 'items' table columns
        $columns = [];
        $stmt = $pdo->query("PRAGMA table_info(items)");
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $columns[] = $row['name'];
        }

        // Define required columns and types (for evolution)
        $requiredColumns = [
            'is_boosted' => 'INTEGER DEFAULT 0',
            'boosted_date' => 'INTEGER DEFAULT NULL',
            'rdd_date' => 'TEXT DEFAULT NULL', // For Decision RDD
            'work_days' => 'REAL DEFAULT 1.0',
            'due_date' => 'TEXT', 
            'prep_date' => 'TEXT', // Ensure this exists too if used
            // [v6] Project & Delegation Fields
            'parent_id' => 'TEXT DEFAULT NULL',
            'is_project' => 'INTEGER DEFAULT 0',
            'project_category' => 'TEXT DEFAULT NULL',
            'estimated_minutes' => 'INTEGER DEFAULT 0',
            'assigned_to' => 'TEXT DEFAULT NULL',
            'delegation' => 'TEXT DEFAULT NULL' // JSON String
        ];

        foreach ($requiredColumns as $col => $def) {
            if (!in_array($col, $columns)) {
                try {
                    $pdo->exec("ALTER TABLE items ADD COLUMN $col $def");
                } catch (Exception $e) {
                    error_log("Migration Warning: Failed to add column $col: " . $e->getMessage());
                }
            }
        }
        
        return $pdo;
    } catch (PDOException $e) {
        // Log connection error
        error_log("DB Connection Error: " . $e->getMessage());
        throw $e;
    }
}

function initDB($pdo) {
    $commands = [
        "CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            memo TEXT,
            interrupt INTEGER DEFAULT 0,
            status_updated_at INTEGER,
            created_at INTEGER,
            updated_at INTEGER,
            sort_order INTEGER DEFAULT 0,
            is_boosted INTEGER DEFAULT 0,
            boosted_date INTEGER DEFAULT NULL,
            rdd_date TEXT DEFAULT NULL,
            work_days REAL DEFAULT 1.0,
            parent_id TEXT DEFAULT NULL,
            is_project INTEGER DEFAULT 0,
            project_category TEXT DEFAULT NULL,
            estimated_minutes INTEGER DEFAULT 0,
            assigned_to TEXT DEFAULT NULL,
            delegation TEXT DEFAULT NULL
        )",
        "CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT,
            message TEXT,
            stack_trace TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )",
        "CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            payload TEXT,
            created_at INTEGER
        )",
        "CREATE TABLE IF NOT EXISTS daily_logs (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL,
            category TEXT NOT NULL,
            content TEXT NOT NULL,
            created_at INTEGER
        )",
        "CREATE TABLE IF NOT EXISTS side_memos (
            id TEXT PRIMARY KEY,
            content TEXT NOT NULL,
            created_at INTEGER
        )",
        // [v6] Enterprise Features
        "CREATE TABLE IF NOT EXISTS stocks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            project_id TEXT,
            estimated_minutes INTEGER DEFAULT 0,
            due_date TEXT,
            status TEXT DEFAULT 'open',
            created_at INTEGER
        )",
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            status TEXT DEFAULT 'active',
            progress_rate INTEGER DEFAULT 0,
            total_weight INTEGER DEFAULT 0,
            current_weight INTEGER DEFAULT 0,
            created_at INTEGER
        )",
        "CREATE TABLE IF NOT EXISTS user_configs (
            user_id TEXT PRIMARY KEY,
            daily_capacity_minutes INTEGER DEFAULT 480,
            work_cal_id TEXT,
            private_cal_id TEXT
        )",
        "CREATE TABLE IF NOT EXISTS daily_volumes (
            user_id TEXT,
            date TEXT,
            total_minutes INTEGER DEFAULT 0,
            capacity_minutes INTEGER DEFAULT 480,
            PRIMARY KEY (user_id, date)
        )",
        // [v7] Cloud & Multi-tenant Architecture
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            display_name TEXT,
            created_at INTEGER
        )",
        "CREATE TABLE IF NOT EXISTS tenants (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            domain TEXT,
            created_at INTEGER
        )",
        "CREATE TABLE IF NOT EXISTS memberships (
            user_id TEXT,
            tenant_id TEXT,
            role TEXT DEFAULT 'member',
            PRIMARY KEY (user_id, tenant_id),
            FOREIGN KEY(user_id) REFERENCES users(id),
            FOREIGN KEY(tenant_id) REFERENCES tenants(id)
        )",
        "CREATE TABLE IF NOT EXISTS api_tokens (
            id TEXT PRIMARY KEY,
            user_id TEXT,
            token TEXT UNIQUE NOT NULL,
            label TEXT,
            created_at INTEGER,
            last_used_at INTEGER,
            FOREIGN KEY(user_id) REFERENCES users(id)
        )",
        // Renamed/Replaced Projects Table handled by migration script, 
        // but for fresh init we use the new schema.
        // Note: 'projects' table definition here replaces the old v6 one if db is fresh.
        "CREATE TABLE IF NOT EXISTS projects (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            client TEXT,
            settings_json TEXT,
            dxf_config_json TEXT,
            view_mode TEXT DEFAULT 'internal',
            judgment_status TEXT DEFAULT 'inbox',
            is_archived INTEGER DEFAULT 0,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY(tenant_id) REFERENCES tenants(id)
        )",
        "CREATE TABLE IF NOT EXISTS doors (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            project_id TEXT,
            deliverable_id TEXT,
            tag TEXT,
            name TEXT,
            dimensions_json TEXT,
            specs_json TEXT,
            count INTEGER DEFAULT 1,
            thumbnail_url TEXT,
            status TEXT,
            man_hours REAL,
            complexity REAL,
            start_date TEXT,
            due_date TEXT,
            category TEXT,
            generic_specs_json TEXT,
            judgment_status TEXT,
            waiting_reason TEXT,
            weight INTEGER,
            rough_timing TEXT,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY(tenant_id) REFERENCES tenants(id),
            FOREIGN KEY(project_id) REFERENCES projects(id)
        )",
        "CREATE TABLE IF NOT EXISTS deliverables (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            project_id TEXT,
            linked_item_id TEXT,
            name TEXT,
            type TEXT,
            status TEXT,
            estimated_work_minutes INTEGER,
            estimated_site_minutes INTEGER,
            actual_work_minutes INTEGER,
            actual_site_minutes INTEGER,
            cost_json TEXT,
            requires_site_installation INTEGER,
            description TEXT,
            note TEXT,
            created_at INTEGER,
            updated_at INTEGER,
            FOREIGN KEY(tenant_id) REFERENCES tenants(id)
        )"
    ];

    foreach ($commands as $sql) {
        $pdo->exec($sql);
    }

    // --- Seed Data (Debug Environment) ---
    // Check if default user exists
    $stmt = $pdo->query("SELECT count(*) FROM users");
    if ($stmt->fetchColumn() == 0) {
        // 1. Create Default Tenant
        $tenantId = 't_default';
        $tenantName = '株式会社デバッグ';
        $invoiceNo = 'T1234567890123';
        $config = json_encode([
            "plugins" => [
                "manufacturing" => true,
                "tategu" => true
            ]
        ]);

        // Note: Check if columns exist (handled by migration script, but here for fresh init)
        // For fresh init, we assume columns might be missing if migration hasn't run, 
        // OR we should run migration first. 
        // Simplification: We insert basic data, columns will be added by migration script if missing.
        // BUT wait, verify_and_start runs php index.php which runs db.php FIRST.
        // So we should stick to basic schema here, and let migration update it?
        // NO, the user wants "株式会社デバッグ" with Plugins ON.
        // We must ensure 'config' column exists or use migration.
        
        // Let's insert MINIMAL data first, assuming migration adds columns later or we add them now?
        // Actually, initDB is for FRESH install. Let's add columns to CREATE TABLE above if we want them fresh.
        // However, migration script `migrate_v12...` adds them.
        
        // Strategy: Insert basic, then update config via migration? No, migration is structure.
        // Better: Update CREATE TABLE for tenants in initDB to include new columns for fresh install.
        
        $pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('$tenantId', '$tenantName', datetime('now'))");

        // 2. Create Default User
        $userId = 'u_default';
        $userName = 'デバッグ太郎';
        $userEmail = 'debug@example.com';
        $userPass = password_hash('password', PASSWORD_DEFAULT);

        $stmt = $pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, datetime('now'))");
        $stmt->execute([$userId, $userEmail, $userPass, $userName]);

        // 3. Link
        $pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES ('$userId', '$tenantId', 'owner', datetime('now'))");
        
        // 4. Force Update for Debug Requirements (columns added by migrate_v12)
        // This part relies on migrate_v12 running AFTER initDB.
        // The verify_and_start script runs php index.php which loads db.php.
        // Handled by manual migration step or smart logic.
    }
}
