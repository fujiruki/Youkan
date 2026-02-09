<?php
// debug_db.php
require_once 'backend/db.php';
$pdo = getDB();
// Get current user ID (mock for now as we know it's u_697b2af132f4f in debug)
$userId = 'u_697b2af132f4f';
$sql = "SELECT id, title, due_date, assigned_to, created_by, project_id FROM items WHERE due_date LIKE '2026-02-%' LIMIT 20";
$stmt = $pdo->query($sql);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode([
    'debug_user' => $userId,
    'items' => $rows
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
