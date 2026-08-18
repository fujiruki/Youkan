<?php
// backend/UserController.php
require_once 'BaseController.php';

class UserController extends BaseController {

    public function handleRequest($method, $path) {
        $this->authenticate();

        // /user/profile
        if (preg_match('#^/profile$#', $path)) {
            if ($method === 'GET') {
                $this->getProfile();
            } elseif ($method === 'PUT' || $method === 'PATCH') {
                $this->updateProfile();
            } else {
                $this->sendError(405, 'Method Not Allowed');
            }
        }
        // /user/password
        elseif (preg_match('#^/password$#', $path)) {
            if ($method === 'PUT') {
                $this->changePassword();
            } else {
                $this->sendError(405, 'Method Not Allowed');
            }
        }
        // R-140: /user/api-tokens（連携トークンの発行／一覧／失効）
        elseif (preg_match('#^/api-tokens$#', $path)) {
            if ($method === 'GET') {
                $this->listApiTokens();
            } elseif ($method === 'POST') {
                $this->createApiToken();
            } else {
                $this->sendError(405, 'Method Not Allowed');
            }
        }
        elseif (preg_match('#^/api-tokens/([^/]+)$#', $path, $m)) {
            if ($method === 'DELETE') {
                $this->revokeApiToken($m[1]);
            } else {
                $this->sendError(405, 'Method Not Allowed');
            }
        }
        else {
            $this->sendError(404, 'Endpoint Not Found');
        }
    }

    protected function listApiTokens() {
        $stmt = $this->pdo->prepare("SELECT id, label, created_at, last_used_at FROM api_tokens WHERE user_id = ? ORDER BY created_at ASC");
        $stmt->execute([$this->currentUserId]);
        $this->sendJSON(array_map(fn($r) => [
            'id' => $r['id'],
            'label' => $r['label'],
            'created_at' => $r['created_at'] !== null ? (int)$r['created_at'] : null,
            'last_used_at' => $r['last_used_at'] !== null ? (int)$r['last_used_at'] : null,
        ], $stmt->fetchAll(PDO::FETCH_ASSOC)));
    }

    protected function createApiToken() {
        $label = trim((string)($this->getInput()['label'] ?? ''));
        if ($label === '') {
            $this->sendError(400, 'label is required');
        }
        $id = 'tok_' . bin2hex(random_bytes(8));
        $token = bin2hex(random_bytes(32));
        $this->pdo->prepare("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES (?, ?, ?, ?, ?)")
            ->execute([$id, $this->currentUserId, $token, $label, time()]);
        // 平文 token はこのレスポンスでのみ返す
        $this->sendJSON(['id' => $id, 'label' => $label, 'token' => $token]);
    }

    protected function revokeApiToken($id) {
        $stmt = $this->pdo->prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?");
        $stmt->execute([$id, $this->currentUserId]);
        if ($stmt->rowCount() === 0) {
            $this->sendError(404, 'Token not found');
        }
        $this->sendJSON(['success' => true]);
    }

    protected function getProfile() {
        if (!$this->currentUserId) {
            $this->sendError(400, 'User context required');
        }

        // [New] Handle Company Account (account_type = tenant)
        if (($this->currentUser['account_type'] ?? 'user') === 'tenant') {
            $this->sendJSON([
                'id' => $this->currentTenantId,
                'email' => $this->currentUser['email'],
                'display_name' => $this->currentUser['name'],
                'birthday' => null,
                'daily_capacity_minutes' => 480,
                'non_working_hours' => null,
                'preferences' => null,
                'created_at' => null, // Or actual tenant created_at if joining
                'active_task_id' => null,
                'is_representative' => true
            ]);
            return;
        }

        $stmt = $this->pdo->prepare("SELECT id, email, display_name, birthday, daily_capacity_minutes, non_working_hours, preferences, created_at, active_task_id FROM users WHERE id = ?");
        $stmt->execute([$this->currentUserId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            // [Fix] Return 401 to trigger logout on client if user is missing (Stale Token)
            $this->sendError(401, 'User not found (Invalid Session)');
        }
        
        // [JBWOS] Explicit CamelCase for frontend
        $user['activeTaskId'] = $user['active_task_id'];

        // [FIX] Fallback for empty display name
        if (empty($user['display_name'])) {
            $parts = explode('@', $user['email']);
            $user['display_name'] = $parts[0] ?? 'User';
        }

        // Decode JSON fields
        if (!empty($user['preferences'])) {
            $user['preferences'] = json_decode($user['preferences'], true);
        }
        if (!empty($user['non_working_hours']) && is_string($user['non_working_hours'])) {
            $user['non_working_hours'] = json_decode($user['non_working_hours'], true);
        }

        $this->sendJSON($user);
    }

    protected function updateProfile() {
        if (!$this->currentUserId) {
            $this->sendError(400, 'User context required');
        }

        // [New] Prevent updates to user profile if logged in as company
        if (($this->currentUser['account_type'] ?? 'user') === 'tenant') {
            // For now, company profiles are not updated via /user/profile
            // Just return success to prevent frontend errors.
            $this->sendJSON(['success' => true]);
            return;
        }

        $allowedFields = [
            'display_name', 'birthday', 'daily_capacity_minutes', 
            'non_working_hours', 'preferences', 'active_task_id'
        ];

        $result = $this->updateEntity('users', $this->currentUserId, $allowedFields);
        $this->sendJSON(['success' => true]);
    }

    protected function changePassword() {
        if (!$this->currentUserId) {
             $this->sendError(400, 'User context required');
        }

        $input = $this->getInput();
        if (empty($input['current_password']) || empty($input['new_password'])) {
            $this->sendError(400, 'Current and new password required');
        }

        // Verify current password
        $stmt = $this->pdo->prepare("SELECT password_hash FROM users WHERE id = ?");
        $stmt->execute([$this->currentUserId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user || !password_verify($input['current_password'], $user['password_hash'])) {
            $this->sendError(403, 'Incorrect current password');
        }

        // Update to new password
        $newHash = password_hash($input['new_password'], PASSWORD_DEFAULT);
        $update = $this->pdo->prepare("UPDATE users SET password_hash = ? WHERE id = ?");
        $update->execute([$newHash, $this->currentUserId]);

        $this->sendJSON(['success' => true, 'message' => 'Password updated']);
    }
}
