<?php
require_once __DIR__ . '/db.php';
header('Content-Type: application/json');

$targetProjectIds = [
    '019c33d6-72be-7f47-b362-34dc12a41cfd', // Aのさぶぷろじぇくと
    'prj-69841e60cb7ff8.68211233', // 玄関作成
    'prj-69a6dd3b246a4' // ユーザーの声にあるかもしれないプロジェクトID
];

try {
    $pdo = getDB();
    $placeholders = implode(',', array_fill(0, count($targetProjectIds), '?'));
    
    // Check items linked via project_id OR parent_id
    // Also include the project item itself
    $sql = "
        SELECT id, title, status, tenant_id, project_id, parent_id, created_by, assigned_to, is_archived, deleted_at, is_project
        FROM items
        WHERE project_id IN ($placeholders)
        OR parent_id IN ($placeholders)
        OR id IN ($placeholders)
        ORDER BY project_id, parent_id, updated_at DESC
    ";

    $params = array_merge($targetProjectIds, $targetProjectIds, $targetProjectIds);
    $stmt = $pdo->prepare($sql);
    $stmt->execute($params);
    $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode($items, JSON_PRETTY_PRINT);
} catch (Exception $e) {
    echo json_encode(['error' => $e->getMessage()]);
}
