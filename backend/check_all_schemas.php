<?php
require_once __DIR__ . '/db.php';
try {
    $db = getDB();
    $tablesStmt = $db->query("SELECT name FROM sqlite_master WHERE type='table'");
    $tables = ['users'];
    
    foreach ($tables as $table) {
        echo "Table: $table\n";
        $stmt = $db->query("PRAGMA table_info($table)");
        $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($columns, JSON_PRETTY_PRINT) . "\n\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
