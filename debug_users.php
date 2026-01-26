<?php
require_once 'backend/db.php';
$pdo = getDB();
$stmt = $pdo->query("SELECT id, email, display_name FROM users");
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo "### USERS ###\n";
echo json_encode($users, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
echo "\n\n### ORPHAN ITEMS ###\n";
$stmt = $pdo->query("SELECT id, title, tenant_id FROM items WHERE created_by IS NULL");
echo json_encode($stmt->fetchAll(PDO::FETCH_ASSOC), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
