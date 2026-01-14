<?php
ini_set('display_errors', 1);
error_reporting(E_ALL);

require_once 'db.php';

try {
    echo "Attempting to connect to DB...\n";
    $pdo = getDB();
    echo "Connection Successful!\n";
    
    // Check columns
    $stmt = $pdo->query("PRAGMA table_info(items)");
    echo "Items Table Columns:\n";
    while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
        echo "- " . $row['name'] . "\n";
    }

} catch (Exception $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo $e->getTraceAsString();
}
