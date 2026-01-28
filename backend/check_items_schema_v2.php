<?php
require_once 'db.php';

try {
    $pdo = getDB();
    
    echo "Checking 'items' table columns...\n";
    $stmt = $pdo->query("PRAGMA table_info(items)");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    foreach ($columns as $col) {
        echo "- " . $col['name'] . " (" . $col['type'] . ")\n";
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
