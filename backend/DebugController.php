<?php
// backend/DebugController.php
// デバッグ用コントローラー - 本番環境では無効化すること

require_once 'db.php';
require_once 'JWTService.php';

class DebugController {
    private $pdo;

    public function __construct() {
        $this->pdo = getDB();
    }

    public function handleRequest($method, $path) {
        // /debug/users - ユーザー一覧
        if (preg_match('#^/users$#', $path) && $method === 'GET') {
            $this->listUsers();
        }
        // /debug/users/:id - ユーザー削除
        elseif (preg_match('#^/users/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
            $this->deleteUser($matches[1]);
        }
        // /debug/tenants - テナント一覧
        elseif (preg_match('#^/tenants$#', $path) && $method === 'GET') {
            $this->listTenants();
        }
        // /debug/logs - システムログ（従来の機能）
        elseif (preg_match('#^/logs$#', $path) && $method === 'GET') {
            $this->getLogs();
        }
        else {
            http_response_code(404);
            echo json_encode(['error' => 'Debug endpoint not found']);
        }
    }

    /**
     * ユーザー一覧取得
     */
    private function listUsers() {
        try {
            $stmt = $this->pdo->query("
                SELECT 
                    u.id,
                    u.email,
                    u.display_name,
                    u.created_at,
                    GROUP_CONCAT(m.tenant_id || ':' || m.role, ', ') as memberships
                FROM users u
                LEFT JOIN memberships m ON m.user_id = u.id
                GROUP BY u.id
                ORDER BY u.created_at DESC
            ");
            $users = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'count' => count($users),
                'users' => $users
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch users: ' . $e->getMessage()]);
        }
    }

    /**
     * ユーザー削除
     */
    private function deleteUser($userId) {
        try {
            $this->pdo->beginTransaction();

            // 1. メンバーシップ削除
            $stmt = $this->pdo->prepare("DELETE FROM memberships WHERE user_id = ?");
            $stmt->execute([$userId]);

            // 2. ユーザー削除
            $stmt = $this->pdo->prepare("DELETE FROM users WHERE id = ?");
            $stmt->execute([$userId]);

            if ($stmt->rowCount() === 0) {
                $this->pdo->rollBack();
                http_response_code(404);
                echo json_encode(['error' => 'User not found']);
                return;
            }

            $this->pdo->commit();

            echo json_encode([
                'success' => true,
                'message' => "User {$userId} deleted"
            ]);
        } catch (Exception $e) {
            $this->pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => 'Failed to delete user: ' . $e->getMessage()]);
        }
    }

    /**
     * テナント一覧取得
     */
    private function listTenants() {
        try {
            $stmt = $this->pdo->query("
                SELECT 
                    t.id,
                    t.name,
                    t.created_at,
                    COUNT(m.user_id) as member_count
                FROM tenants t
                LEFT JOIN memberships m ON m.tenant_id = t.id
                GROUP BY t.id
                ORDER BY t.created_at DESC
            ");
            $tenants = $stmt->fetchAll(PDO::FETCH_ASSOC);

            echo json_encode([
                'count' => count($tenants),
                'tenants' => $tenants
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to fetch tenants: ' . $e->getMessage()]);
        }
    }

    /**
     * システムログ取得（従来の機能）
     */
    public function getLogs() {
        $logs = [];
        
        $targetLog = 'php_error.log';
        
        if (file_exists($targetLog)) {
            $logs['php_error'] = $this->tailFile($targetLog, 50);
        } else {
            $logs['php_error'] = "Log file '$targetLog' not found.";
        }

        $logs['system'] = [
            'php_version' => phpversion(),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
            'timestamp' => date('Y-m-d H:i:s'),
            'extensions' => get_loaded_extensions(),
            'sqlite_path' => 'jbwos.sqlite'
        ];

        echo json_encode(['data' => $logs], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    private function tailFile($filepath, $lines = 50) {
        if (!is_readable($filepath)) return "File not readable.";
        
        $data = file($filepath);
        if ($data === false) return "Failed to read file.";
        
        return array_slice($data, -$lines);
    }
}
