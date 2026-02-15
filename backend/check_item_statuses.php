<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

try {
    $pdo = getDB();
    $stmt = $pdo->query("SELECT status, COUNT(*) as count, MIN(date(created_at, 'unixepoch')) as first_seen, MAX(date(created_at, 'unixepoch')) as last_seen FROM items GROUP BY status");
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

    // Also check keys if 'design' is in project_type or category
    $stmt2 = $pdo->query("SELECT project_category, COUNT(*) as count FROM items WHERE is_project = 1 GROUP BY project_category");
    $categories = $stmt2->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode(['statuses' => $results, 'categories' => $categories], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
