<?php
try {
    $pdo = new PDO('sqlite:backend/jbwos.sqlite');
    echo "--- Users Table ---\n";
    $stmt = $pdo->query("PRAGMA table_info(users)");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $col) {
        echo $col['name'] . " (" . $col['type'] . ")\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
