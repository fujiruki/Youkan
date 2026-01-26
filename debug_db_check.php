<?php
require_once 'backend/db.php';
$pdo = getDB();
$stmt = $pdo->query("SELECT id, title, tenant_id, created_by, project_type FROM items WHERE project_type IS NOT NULL ORDER BY created_at DESC LIMIT 5");
$items = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($items, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
