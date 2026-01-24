<?php
// debug_users.php
try {
    $pdo = new PDO('sqlite:backend/jbwos.sqlite');
    $stmt = $pdo->query("SELECT id, email, display_name FROM users");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo "--- Users Table ---\n";
    print_r($users);
    
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
