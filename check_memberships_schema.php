<?php
try {
    $pdo = new PDO('sqlite:backend/jbwos.sqlite');
    echo "--- Memberships Table ---\n";
    $stmt = $pdo->query("PRAGMA table_info(memberships)");
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $col) {
        echo $col['name'] . " (" . $col['type'] . ")\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
