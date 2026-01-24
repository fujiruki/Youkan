<?php
try {
    $pdo = new PDO('sqlite:backend/jbwos.sqlite');
    $stmt = $pdo->query("PRAGMA table_info(items)");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    $cols = [];
    foreach ($columns as $col) {
        $cols[] = $col['name'];
    }
    echo "Columns: " . implode(', ', $cols) . "\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
