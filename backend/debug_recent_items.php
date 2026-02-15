<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

try {
    $pdo = getDB();
    // 直近作成されたアイテム50件を取得
    $sql = "
        SELECT id, title, tenant_id, project_id, parent_id, created_at, updated_at, deleted_at, created_by
        FROM items
        ORDER BY created_at DESC
        LIMIT 50
    ";

    $stmt = $pdo->query($sql);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($items, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
