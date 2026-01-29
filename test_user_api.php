<?php
// test_user_api.php
require_once 'backend/UserController.php';

class TestController extends UserController {
    public function testGetProfile($userId) {
        $this->currentUserId = $userId;
        $this->getProfile();
    }
    
    protected function sendJSON($data) {
        echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) . "\n";
        exit;
    }
    protected function sendError($code, $message) {
        echo "Error $code: $message\n";
        exit;
    }
}

// Get the first user ID from the database
require_once 'backend/db.php';
$pdo = getDB();
$user = $pdo->query("SELECT id FROM users LIMIT 1")->fetch(PDO::FETCH_ASSOC);

if ($user) {
    echo "Testing Profile for User: " . $user['id'] . "\n";
    $controller = new TestController();
    $controller->testGetProfile($user['id']);
} else {
    echo "No users found in database.\n";
}
