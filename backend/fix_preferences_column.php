<?php
$dbFile = __DIR__ . '/jbwos.sqlite';
if (!file_exists($dbFile)) {
    echo "Database file not found: $dbFile\n";
    exit(1);
}

$pdo = new PDO('sqlite:' . $dbFile);
$stmt = $pdo->query("PRAGMA table_info(users)");
$cols = [];
while($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    $cols[] = $row['name'];
}

echo "Columns in 'users' table:\n";
foreach ($cols as $col) {
    echo "- $col\n";
}

if (!in_array('preferences', $cols)) {
    echo "\nWARNING: 'preferences' column is MISSING!\n";
    echo "Attempting to add 'preferences' column...\n";
    $pdo->exec("ALTER TABLE users ADD COLUMN preferences TEXT DEFAULT NULL");
    echo "Done.\n";
} else {
    echo "\n'preferences' column is present.\n";
}
