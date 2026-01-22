<?php
// backend/enable_wal.php
require_once 'db.php';

try {
    $pdo = getDB();
    $mode = $pdo->query('PRAGMA journal_mode=WAL;')->fetchColumn();
    echo "Filesystem WAL Mode set to: $mode\n";
    
    // Also increase busy timeout
    $pdo->exec('PRAGMA busy_timeout = 5000;');
    echo "Busy Timeout set to 5000ms\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
