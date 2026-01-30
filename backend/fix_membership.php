<?php
require_once 'db.php';
$pdo = getDB();

$userId = 'u_697b2af132f4f';
$stmt = $pdo->prepare("SELECT tenant_id, role FROM memberships WHERE user_id = ?");
$stmt->execute([$userId]);
$memberships = $stmt->fetchAll(PDO::FETCH_ASSOC);

if ($memberships) {
    echo "Memberships for $userId:\n";
    print_r($memberships);
} else {
    echo "No memberships found for $userId. Creating one...\n";
    
    // Create Debug Tenant if not exists
    $tenantId = 't_default';
    $stmt = $pdo->prepare("INSERT OR IGNORE INTO tenants (id, name, created_at) VALUES (?, ?, datetime('now'))");
    $stmt->execute([$tenantId, 'Debug Tenant']);
    
    // Link
    $stmt = $pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES (?, ?, 'owner', datetime('now'))");
    $stmt->execute([$userId, $tenantId]);
    echo "Linked $userId to $tenantId as owner.\n";
}
