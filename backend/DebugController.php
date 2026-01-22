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
        // /debug/users/:id/password - パスワードリセット
        elseif (preg_match('#^/users/([^/]+)/password$#', $path, $matches) && $method === 'PUT') {
            $this->resetPassword($matches[1]);
        }
        // /debug/users/:id - ユーザー削除
        elseif (preg_match('#^/users/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
            $this->deleteUser($matches[1]);
        }
        // /debug/tenants - テナント一覧
        elseif (preg_match('#^/tenants$#', $path) && $method === 'GET') {
            $this->listTenants();
        }
        // /debug/migrate/:version - マイグレーション実行 (例: v7)
        elseif (preg_match('#^/migrate/(v[0-9]+)$#', $subPath, $matches) && $method === 'GET') {
            $this->migrate($matches[1]);
        }
        else {
            http_response_code(404);
            echo json_encode(['error' => 'Debug endpoint not found']);
        }
    }

    /**
     * マイグレーション実行
     * @param string $version 'v7', 'v11' など
     */
    private function migrate($version) {
        $filename = "migrate_{$version}_cloud_tables.php";
        
        // バージョンごとのファイル名マッピング（安全のため）
        $map = [
            'v7' => 'migrate_v7_cloud_tables.php',
            'v9' => 'migrate_v9_security_logs.php',
            'v11' => 'migrate_v11_manufacturing.php',
        ];

        if (!isset($map[$version])) {
            http_response_code(400);
            echo json_encode(['error' => "Unknown migration version: $version"]);
            return;
        }

        $file = __DIR__ . '/' . $map[$version];
        if (!file_exists($file)) {
            http_response_code(500);
            echo json_encode(['error' => "Migration file not found: {$map[$version]}"]);
            return;
        }

        // 実行ログをキャプチャするためにバッファリング
        ob_start();
        try {
            // 変数スコープを分離するためにクロージャで実行したいが、
            // ファイルがグローバルスコープを想定しているかもしれないので直接include
            include $file;
            $output = ob_get_clean();
            
            echo json_encode([
                'success' => true,
                'message' => "Migration $version executed.",
                'output' => $output
            ]);
        } catch (Exception $e) {
            $output = ob_get_clean();
            http_response_code(500);
            echo json_encode([
                'error' => 'Migration failed: ' . $e->getMessage(),
                'output' => $output
            ]);
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
                    u.password_hash,
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
     * パスワードリセット
     */
    private function resetPassword($userId) {
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (!$input || !isset($input['newPassword']) || strlen($input['newPassword']) < 4) {
            http_response_code(400);
            echo json_encode(['error' => 'newPassword is required (min 4 chars)']);
            return;
        }

        try {
            $newHash = password_hash($input['newPassword'], PASSWORD_DEFAULT);
            
            $stmt = $this->pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
            $stmt->execute([$newHash, $userId]);

            if ($stmt->rowCount() === 0) {
                http_response_code(404);
                echo json_encode(['error' => 'User not found']);
                return;
            }

            echo json_encode([
                'success' => true,
                'message' => "Password for user {$userId} has been reset"
            ]);
        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Failed to reset password: ' . $e->getMessage()]);
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
