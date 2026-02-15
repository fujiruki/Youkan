<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

try {
    $pdo = getDB();
    // project_id が存在し、かつ長さが10文字未満（UUIDやprj-xxxより短い）ものを探す
    $sql = "
        SELECT id, title, project_id, tenant_id, created_at, deleted_at
        FROM items
        WHERE project_id IS NOT NULL 
        AND LENGTH(project_id) < 10
        ORDER BY created_at DESC
    ";

    $stmt = $pdo->query($sql);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($items, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
