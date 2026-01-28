<?php
require_once 'db.php';

try {
    $pdo = getDB();
    
    echo "Checking 'users' table content...\n";
    $stmt = $pdo->query("SELECT id, display_name, email FROM users");
    $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    if (empty($users)) {
        echo "Users table is EMPTY.\n";
    } else {
        foreach ($users as $u) {
            echo "- ID: " . $u['id'] . " | Name: " . $u['display_name'] . " | Email: " . $u['email'] . "\n";
        }
    }

} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
