<?php
require_once 'db.php';
$pdo = getDB();

try {
    $userId = 'u_default';
    $stmt = $pdo->prepare("SELECT * FROM users WHERE id = ?");
    $stmt->execute([$userId]);
    $user = $stmt->fetch();

    if (!$user) {
        echo "User $userId not found. Inserting...\n";
        $stmt = $pdo->prepare("INSERT INTO users (id, email, display_name, password_hash, is_representative, created_at) VALUES (?, ?, ?, ?, ?, datetime('now'))");
        $stmt->execute([$userId, 'debug@example.com', 'Debug User', password_hash('password', PASSWORD_DEFAULT), 1]);
        echo "User $userId inserted.\n";
    } else {
        echo "User $userId already exists.\n";
    }

    // Also check tenant
    $tenantId = 't_default';
    $stmt = $pdo->prepare("SELECT * FROM tenants WHERE id = ?");
    $stmt->execute([$tenantId]);
    $tenant = $stmt->fetch();

    if (!$tenant) {
        echo "Tenant $tenantId not found. Inserting...\n";
        $stmt = $pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, datetime('now'))");
        $stmt->execute([$tenantId, 'Debug Tenant']);
        echo "Tenant $tenantId inserted.\n";
    } else {
        echo "Tenant $tenantId already exists.\n";
    }

    // Membership
    $stmt = $pdo->prepare("SELECT * FROM memberships WHERE user_id = ? AND tenant_id = ?");
    $stmt->execute([$userId, $tenantId]);
    $membership = $stmt->fetch();

    if (!$membership) {
        echo "Membership not found. Inserting...\n";
        $stmt = $pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES (?, ?, 'owner', datetime('now'))");
        $stmt->execute([$userId, $tenantId]);
        echo "Membership inserted.\n";
    } else {
        echo "Membership exists.\n";
    }
} catch (PDOException $e) {
    echo "ERROR: " . $e->getMessage() . "\n";
    echo "Code: " . $e->getCode() . "\n";
} catch (Exception $e) {
    echo "GENERAL ERROR: " . $e->getMessage() . "\n";
}
