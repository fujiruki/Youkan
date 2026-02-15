<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

try {
    $pdo = getDB();
    // プロジェクト（is_project=1 または project_type があるもの）を取得
    $stmt = $pdo->query("SELECT id, title, tenant_id, created_by, is_archived, deleted_at FROM items WHERE is_project = 1 OR project_type IS NOT NULL ORDER BY updated_at DESC LIMIT 50");
    $projects = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($projects, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
