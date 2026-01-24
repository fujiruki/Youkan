<?php
try {
    $pdo = new PDO('sqlite:backend/jbwos.sqlite');
    echo "--- Tenants Table ---\n";
    $stmt = $pdo->query("PRAGMA table_info(tenants)");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $col) {
        echo $col['name'] . " (" . $col['type'] . ") pk=" . $col['pk'] . " notnull=" . $col['notnull'] . " dflt=" . $col['dflt_value'] . "\n";
    }
    // Check indices
    echo "--- Indices ---\n";
    $stmt = $pdo->query("PRAGMA index_list(tenants)");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $idx) {
        echo $idx['name'] . " unique=" . $idx['unique'] . "\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
