<?php
try {
    $pdo = new PDO('sqlite:backend/jbwos.sqlite');
    echo "--- Projects Table ---\n";
    $stmt = $pdo->query("PRAGMA table_info(projects)");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    foreach ($columns as $col) {
        echo $col['name'] . " (" . $col['type'] . ")\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
