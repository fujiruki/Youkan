<?php
require_once 'db.php';
$pdo = getDB();

$email = 'debug@example.com';
$stmt = $pdo->prepare("SELECT id, email, display_name FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();

if ($user) {
    echo "Found user with email $email:\n";
    print_r($user);
} else {
    echo "No user found with email $email.\n";
}
