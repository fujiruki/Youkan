<?php
require 'backend/db.php';

try {
    $pdo = getDB();
    
    // User check
    $stmt = $pdo->prepare('SELECT id, email, password_hash FROM users WHERE email=?');
    $stmt->execute(['fjt.suntree@gmail.com']);
    $u = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($u) {
        echo "User found: " . $u['id'] . "\n";
        echo "Hash: " . substr($u['password_hash'], 0, 10) . "...\n";
        echo "Verify passa: " . (password_verify('passa', $u['password_hash']) ? 'OK' : 'NG') . "\n";
    } else {
        echo "User fjt.suntree@gmail.com not found\n";
    }

    // Tenant check
    $stmt = $pdo->prepare('SELECT id, email, password_hash FROM tenants WHERE email=?');
    $stmt->execute(['info@door-fujita.com']);
    $t = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($t) {
        echo "Tenant found: " . $t['id'] . "\n";
        echo "Hash: " . substr($t['password_hash'], 0, 10) . "...\n";
        echo "Verify passc: " . (password_verify('passc', $t['password_hash']) ? 'OK' : 'NG') . "\n";
    } else {
        echo "Tenant info@door-fujita.com not found\n";
    }
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
