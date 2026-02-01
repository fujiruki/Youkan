<?php
// backend/debug_find_active_users.php
require_once __DIR__ . '/db.php';

try {
    $pdo = getDB();
    
    $stmt = $pdo->query("
        SELECT u.id, u.email, u.display_name, COUNT(m.tenant_id) as membership_count
        FROM users u
        JOIN memberships m ON u.id = m.user_id
        GROUP BY u.id
    ");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($users)) {
        echo "NON-EXISTENT: No users have any memberships.\n";
    } else {
        echo "Users with memberships:\n";
        foreach ($users as $user) {
            echo "- " . $user['display_name'] . " (" . $user['email'] . ") -> " . $user['membership_count'] . " tenants\n";
        }
    }
    
    // Check if tenants exist at all
    $tCount = $pdo->query("SELECT count(*) FROM tenants")->fetchColumn();
    echo "Total Tenants in DB: $tCount\n";

} catch (Exception $e) {
    echo "Error: " . $e->getMessage();
}
