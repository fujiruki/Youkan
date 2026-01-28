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
        } else {
            // --- Auto-Migration Logic (Schema Evolution) ---
            // Ensure all required tables exist (Migration for existing DBs)
            ensureTables($pdo);
        }

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
            'project_id' => 'TEXT DEFAULT NULL', // [FIX] Added missing column
            'is_project' => 'INTEGER DEFAULT 0',
            'project_category' => 'TEXT DEFAULT NULL',
            'estimated_minutes' => 'INTEGER DEFAULT 0',
            'assigned_to' => 'TEXT DEFAULT NULL',
            'delegation' => 'TEXT DEFAULT NULL', // JSON String
            'client' => 'TEXT DEFAULT NULL', // [FIX] Added missing column for Projects
            'meta' => 'TEXT DEFAULT NULL' // [FIX] Added for Project Settings/Config
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

function ensureTables($pdo) {
    $commands = [
        "CREATE TABLE IF NOT EXISTS items (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            title TEXT NOT NULL,
            status TEXT NOT NULL,
            created_by TEXT,
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
            delegation TEXT DEFAULT NULL,
            project_id TEXT DEFAULT NULL,
            project_type TEXT DEFAULT NULL
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
            created_at INTEGER,
            preferences TEXT -- JSON for UI settings
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
            joined_at INTEGER,
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
        // New tables for Phase 9
        "CREATE TABLE IF NOT EXISTS assignees (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            role TEXT,
            color TEXT,
            is_active INTEGER DEFAULT 1,
            created_at INTEGER,
            updated_at INTEGER
        )",
        "CREATE TABLE IF NOT EXISTS project_categories (
            id TEXT PRIMARY KEY,
            tenant_id TEXT NOT NULL,
            name TEXT NOT NULL,
            color TEXT,
            description TEXT,
            is_active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            created_at INTEGER,
            updated_at INTEGER
        )",
        "CREATE TABLE IF NOT EXISTS life_logs (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            item_id TEXT, -- 'today' or UUID
            action TEXT NOT NULL, -- 'clean', 'mail', 'planning', 'workout'
            value INTEGER DEFAULT 1,
            logged_at INTEGER,
            created_at INTEGER
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
}

function initDB($pdo) {
    ensureTables($pdo);

    // --- Seed Data (Debug Environment) ---
    // Check if default user exists
    $stmt = $pdo->query("SELECT count(*) FROM users");
    if ($stmt->fetchColumn() == 0) {
        // 1. Create Default Tenant
        $tenantId = 't_default';
        $tenantName = '株式会社デバッグ';
        $invoiceNo = 'T1234567890123';
        // Note: Check if columns exist (handled by migration script, but here for fresh init)
        
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
    }
}
