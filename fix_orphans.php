<?php
require_once 'backend/db.php';
$pdo = getDB();

// 1. Get a valid user ID (Prefer u_default or the first user)
$stmt = $pdo->query("SELECT id FROM users WHERE id = 'u_default' OR id LIKE 'u_%' LIMIT 1");
$userId = $stmt->fetchColumn();

if (!$userId) {
    echo "No valid user found to assign items to.\n";
    exit;
}

echo "Assigning orphaned items to User ID: $userId\n";

// 2. Update orphaned items
$stmt = $pdo->prepare("UPDATE items SET created_by = ? WHERE created_by IS NULL");
$stmt->execute([$userId]);
$count = $stmt->rowCount();

echo "Updated $count items.\n";
