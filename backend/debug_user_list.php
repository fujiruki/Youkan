<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

try {
    $pdo = getDB();
    $sql = "SELECT id, email, display_name, created_at FROM users";
    $stmt = $pdo->query($sql);
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($users, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
