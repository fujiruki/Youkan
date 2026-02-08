<?php
// backend/test_db_connect.php

// Error reporting ON
ini_set('display_errors', 1);
ini_set('display_startup_errors', 1);
error_reporting(E_ALL);

echo "Starting DB Connection Test...\n";

// Check PDO Driver
$drivers = pdo_drivers();
if (in_array('sqlite', $drivers)) {
    echo "PDO SQLite Driver: OK\n";
} else {
    echo "PDO SQLite Driver: NOT FOUND (Drivers: " . implode(', ', $drivers) . ")\n";
    exit(1);
}

// Check DB File
$dbFile = __DIR__ . '/jbwos.sqlite';
echo "DB File Path: $dbFile\n";
if (file_exists($dbFile)) {
    echo "DB File Exists: YES\n";
    echo "File Permissions: " . substr(sprintf('%o', fileperms($dbFile)), -4) . "\n";
    echo "Is Writable: " . (is_writable($dbFile) ? "YES" : "NO") . "\n";
} else {
    echo "DB File Exists: NO (Will be created)\n";
    // Check directory writable
    echo "Dir Writable: " . (is_writable(__DIR__) ? "YES" : "NO") . "\n";
}

// Try Connect
try {
    $pdo = new PDO("sqlite:" . $dbFile);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    echo "Connection: SUCCESS\n";
    
    // Try Query
    $stmt = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' LIMIT 1");
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    echo "Test Query: SUCCESS\n";
    if ($row) {
        echo "Found Table: " . $row['name'] . "\n";
    } else {
        echo "No tables found (Fresh DB?)\n";
    }

} catch (PDOException $e) {
    echo "Connection FAILED: " . $e->getMessage() . "\n";
    exit(1);
} catch (Exception $e) {
    echo "Unexpected Error: " . $e->getMessage() . "\n";
    exit(1);
}
