<?php
require_once 'db.php';
try {
    $pdo = getDB();
    $stmt = $pdo->query("PRAGMA table_info(items)");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    echo json_encode($columns, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
