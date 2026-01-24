<?php
try {
    $pdo = new PDO('sqlite:backend/jbwos.sqlite');
    echo "--- Items Table ---\n";
    $stmt = $pdo->query("PRAGMA table_info(items)");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $col) {
        echo $col['name'] . " (" . $col['type'] . ") notnull=" . $col['notnull'] . "\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
