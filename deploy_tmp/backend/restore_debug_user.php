<?php
// backend/restore_debug_user.php
require_once 'db.php';

try {
    $pdo = getDB();
    
    // 1. Define Default Data
    $tenantId = 't_default';
    $tenantName = '株式会社デバッグ';
    $userId = 'u_default';
    $userName = 'デバッグ太郎';
    $userEmail = 'debug@example.com';
    $userPass = password_hash('password', PASSWORD_DEFAULT);

    // 2. Clean up existing (if any)
    $pdo->prepare("DELETE FROM company_members WHERE tenant_id = ? OR user_id = ?")->execute([$tenantId, $userId]);
    $pdo->prepare("DELETE FROM memberships WHERE tenant_id = ? OR user_id = ?")->execute([$tenantId, $userId]);
    $pdo->prepare("DELETE FROM tenants WHERE id = ? OR email = ?")->execute([$tenantId, $userEmail]);
    $pdo->prepare("DELETE FROM users WHERE id = ? OR email = ?")->execute([$userId, $userEmail]);

    echo "Cleaning up old data...\n";

    // 3. Create Tenant
    $stmt = $pdo->prepare("INSERT INTO tenants (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, datetime('now'))");
    $stmt->execute([$tenantId, $tenantName, $userEmail, $userPass]);
    echo "Tenant '$tenantName' created.\n";

    // 4. Create User (as Representative)
    $stmt = $pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, is_representative, created_at) VALUES (?, ?, ?, ?, 1, datetime('now'))");
    $stmt->execute([$userId, $userEmail, $userPass, $userName]);
    echo "User '$userName' created (Representative: YES).\n";

    // 5. Link (Membership as Owner)
    $stmt = $pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES (?, ?, 'owner', datetime('now'))");
    $stmt->execute([$userId, $tenantId]);
    echo "Membership established (Role: owner).\n";

    // 6. Company Member (Core Member)
    $stmt = $pdo->prepare("INSERT INTO company_members (id, tenant_id, user_id, daily_capacity_minutes, is_core_member, created_at) VALUES (?, ?, ?, 480, 1, datetime('now'))");
    $stmt->execute(['cm_debug', $tenantId, $userId]);
    echo "Company member record added.\n";

    echo "\nSuccess! You can now login with:\n";
    echo "Email: $userEmail\n";
    echo "Password: password\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
