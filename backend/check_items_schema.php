<?php
require_once 'backend/db.php';
$pdo = getDB();
$cols = $pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_ASSOC);
echo "--- Items Table Columns ---\n";
foreach ($cols as $c) {
    echo $c['name'] . " (" . $c['type'] . ")\n";
}
