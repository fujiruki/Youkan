<?php
// backend/AuthController.php
require_once 'db.php';
require_once 'JWTService.php';

class AuthController {
    private $pdo;

    public function __construct() {
        $this->pdo = getDB();
    }

    public function handleRequest($method, $path) {
        // /auth/login
        if (preg_match('#^/login$#', $path) && $method === 'POST') {
            $this->login();
        } 
        // /auth/me (Verify Token)
        elseif (preg_match('#^/me$#', $path) && $method === 'GET') {
            $this->me();
        }
        else {
            http_response_code(404);
            echo json_encode(['error' => 'Auth endpoint not found']);
        }
    }

    private function login() {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input || !isset($input['email']) || !isset($input['password'])) {
            http_response_code(400);
            echo json_encode(['error' => 'Email and password required']);
            return;
        }

        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE email = ?");
        $stmt->execute([$input['email']]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if ($user && password_verify($input['password'], $user['password_hash'])) {
            // Success. Fetch primary tenant.
            $stmt = $this->pdo->prepare("
                SELECT t.id, t.name, m.role 
                FROM memberships m
                JOIN tenants t ON t.id = m.tenant_id
                WHERE m.user_id = ?
                LIMIT 1
            ");
            $stmt->execute([$user['id']]);
            $tenant = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$tenant) {
                http_response_code(500); // Should not happen with seed data
                echo json_encode(['error' => 'User has no tenant']);
                return;
            }

            // Create JWT
            $payload = [
                'sub' => $user['id'],
                'name' => $user['display_name'],
                'email' => $user['email'],
                'tenant_id' => $tenant['id'],
                'role' => $tenant['role']
            ];
            $token = JWTService::encrypt($payload);

            echo json_encode([
                'token' => $token,
                'user' => [
                    'id' => $user['id'],
                    'name' => $user['display_name'],
                    'email' => $user['email']
                ],
                'tenant' => [
                    'id' => $tenant['id'],
                    'name' => $tenant['name'],
                    'role' => $tenant['role']
                ]
            ]);
        } else {
            http_response_code(401);
            echo json_encode(['error' => 'Invalid credentials']);
        }
    }

    private function me() {
        $token = JWTService::getBearerToken();
        $payload = $token ? JWTService::decrypt($token) : null;

        if ($payload) {
            echo json_encode(['valid' => true, 'user' => $payload]);
        } else {
            http_response_code(401);
            echo json_encode(['valid' => false, 'error' => 'Invalid or expired token']);
        }
    }
}
