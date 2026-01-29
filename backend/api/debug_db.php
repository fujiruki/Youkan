<?php
require_once __DIR__ . '/../db.php';
$pdo = getDB();
$stmt = $pdo->query("PRAGMA table_info(users)");
$cols = $stmt->fetchAll(PDO::FETCH_ASSOC);
echo json_encode($cols, JSON_PRETTY_PRINT);
