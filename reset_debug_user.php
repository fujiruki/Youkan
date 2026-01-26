<?php
require_once 'backend/db.php';
$pdo = getDB();

$userId = 'u_default';
$newPass = password_hash('password', PASSWORD_DEFAULT);

$stmt = $pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
$stmt->execute([$newPass, $userId]);

if ($stmt->rowCount() > 0) {
    echo "Password for $userId updated.\n";
} else {
    // If rowCount is 0, maybe user doesn't exist or pass is same.
    // Ensure user exists.
    $stmt = $pdo->prepare("SELECT count(*) FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    if ($stmt->fetchColumn() == 0) {
        echo "User $userId not found. Creating...\n";
        $pdo->exec("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES ('$userId', 'debug@example.com', '$newPass', 'Debug Taro', datetime('now'))");
        echo "User created.\n";
    } else {
        echo "Password unchanged (already 'password').\n";
    }
}
