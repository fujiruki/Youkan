<?php
// backend/debug_db.php
require_once 'db.php';
header('Content-Type: application/json');

try {
    $pdo = getDB();
    $dbPath = __DIR__ . '/jbwos.sqlite';
    $realPath = realpath($dbPath);
    $now = time();
    
    $countStmt = $pdo->query("SELECT COUNT(*) FROM items");
    $totalCount = $countStmt->fetchColumn();
    
    $stmt = $pdo->query("SELECT id, tenant_id, title, project_type, created_by, created_at FROM items ORDER BY created_at DESC LIMIT 50");
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode([
        'server_time' => $now,
        'db_path' => $realPath,
        'total_items' => $totalCount,
        'items' => $items
    ], JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
