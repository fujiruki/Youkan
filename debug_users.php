<?php
// debug_users.php (Modified for reproduction)
try {
    $pdo = new PDO('sqlite:backend/jbwos.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    echo "Executing Complex Query...\n";
    $stmt = $pdo->query("
        SELECT 
            u.id,
            u.email,
            u.display_name,
            u.password_hash,
            u.created_at,
            GROUP_CONCAT(m.tenant_id || ':' || m.role, ', ') as memberships
        FROM users u
        LEFT JOIN memberships m ON m.user_id = u.id
        GROUP BY u.id
        ORDER BY u.created_at DESC
    ");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "--- Users Table (Complex) ---\n";
    print_r($users);
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
