<?php
require_once 'backend/db.php';
$pdo = getDB();
$stmt = $pdo->query("PRAGMA table_info(users)");
$columns = $stmt->fetchAll(PDO::FETCH_ASSOC);
print_r($columns);
