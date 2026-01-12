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
            sort_order INTEGER DEFAULT 0
        )",
        "CREATE TABLE IF NOT EXISTS system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT,
            message TEXT,
            stack_trace TEXT,
            created_at INTEGER DEFAULT (strftime('%s', 'now'))
        )"
    ];

    foreach ($commands as $sql) {
        $pdo->exec($sql);
    }
}
