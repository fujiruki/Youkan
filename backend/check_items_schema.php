<?php
// backend/check_items_schema.php
require_once 'db.php';

try {
    $pdo = getDB();
    echo "Checking 'items' table schema...\n";

    $stmt = $pdo->query("PRAGMA table_info(items)");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);

    foreach ($columns as $col) {
        if ($col['name'] === 'tenant_id') {
            echo "Column: tenant_id\n";
            echo "Type: " . $col['type'] . "\n";
            echo "NotNull: " . ($col['notnull'] ? 'YES' : 'NO') . "\n";
            echo "Default: " . $col['dflt_value'] . "\n";
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
