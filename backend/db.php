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
            'prep_date' => 'TEXT' // Ensure this exists too if used
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
            work_days REAL DEFAULT 1.0
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
        )"
    ];

    foreach ($commands as $sql) {
        $pdo->exec($sql);
    }
}
