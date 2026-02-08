<?php
// backend/IntegrationController.php
require_once 'db.php';

class IntegrationController {
    private $pdo;

    public function __construct() {
        $this->pdo = getDB();
    }

    public function handleRequest($method, $path) {
        // /integrations/inbox
        if (preg_match('#^/inbox$#', $path) && $method === 'POST') {
            $this->createInboxItem();
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Integration endpoint not found']);
        }
    }

    private function authenticate() {
        $headers = null;
        // Same header logic as JWTService ideally, but simplified here
        if (isset($_SERVER['Authorization'])) {
            $headers = trim($_SERVER["Authorization"]);
        } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
            $headers = trim($_SERVER["HTTP_AUTHORIZATION"]);
        }

        $token = null;
        if (!empty($headers)) {
            if (preg_match('/Bearer\s(\S+)/', $headers, $matches)) {
                $token = $matches[1];
            }
        }

        if (!$token) {
            return null;
        }

        // Validate Token
        $stmt = $this->pdo->prepare("SELECT * FROM api_tokens WHERE token = ?");
        $stmt->execute([$token]);
        $apiToken = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$apiToken) {
            return null;
        }

        // Update Last Used
        $this->pdo->prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
            ->execute([time(), $apiToken['id']]);

        // Get User
        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$apiToken['user_id']]);
        return $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function createInboxItem() {
        $user = $this->authenticate();
        if (!$user) {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid API Token']);
            return;
        }

        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['title'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Title is required']);
            return;
        }

        // Get Tenant (Default)
        // For shortcuts, we assume the user's primary tenant or default to the first one found.
        $stmt = $this->pdo->prepare("SELECT tenant_id FROM memberships WHERE user_id = ? LIMIT 1");
        $stmt->execute([$user['id']]);
        $tenantId = $stmt->fetchColumn();

        if (!$tenantId) {
            http_response_code(500);
            echo json_encode(['error' => 'User has no tenant']);
            return;
        }

        // Create Item
        // Using UUID for ID
        $id = uniqid('item-temp-'); // Or standard UUID generator if available in PHP env without deps
        // Actually uniqid is fine for temp, but strictly we might want UUID v4.
        // Let's use simple uniqid for speed as per deps constraint, or random_bytes.
        $id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );

        $now = time() * 1000; // items table uses MS timestamp?
        // Wait, items in JBWOSRepository `createdAt: number` (JS timestamp)
        // DB Schema in migrate_v7: `created_at INTEGER` (Unix TS usually).
        // Standardize: Use Unix Timestamp (Seconds) for SQLite compatibility, multiply by 1000 for JS frontend if needed.
        // But existing items table? Let's check `ItemController`.
        // `ItemController`: $now = time() * 1000;
        
        $stmt = $this->pdo->prepare("
            INSERT INTO items (id, title, status, memo, created_at, updated_at)
            VALUES (?, ?, 'inbox', ?, ?, ?)
        ");
        
        $title = $input['title'];
        $memo = $input['memo'] ?? '';
        
        $stmt->execute([$id, $title, $memo, $now, $now]);

        echo json_encode(['id' => $id, 'message' => 'Added to Inbox via Shortcut']);
    }
}
