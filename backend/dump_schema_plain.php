<?php
require_once 'db.php';
$pdo = getDB();
$stmt = $pdo->query("PRAGMA table_info(items)");
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo $row['name'] . ": " . $row['type'] . "\n";
}
