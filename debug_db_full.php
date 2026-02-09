<?php
// debug_db_full.php
require_once 'backend/db.php';
$pdo = getDB();
$sql = "SELECT assigned_to, count(*) as count FROM items GROUP BY assigned_to";
$stmt = $pdo->query($sql);
$rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

$sql2 = "SELECT id, title, due_date, assigned_to FROM items WHERE assigned_to IS NOT NULL LIMIT 50";
$stmt2 = $pdo->query($sql2);
$rows2 = $stmt2->fetchAll(PDO::FETCH_ASSOC);

echo json_encode([
    'counts' => $rows,
    'non_null_samples' => $rows2
], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
