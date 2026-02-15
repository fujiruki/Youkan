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
        else {
            $this->sendError(404, 'Endpoint Not Found');
        }
    }

    protected function getProfile() {
        if (!$this->currentUserId) {
            $this->sendError(400, 'User context required');
        }

        $stmt = $this->pdo->prepare("SELECT id, email, display_name, birthday, daily_capacity_minutes, non_working_hours, preferences, created_at, active_task_id FROM users WHERE id = ?");
        $stmt->execute([$this->currentUserId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $this->sendError(404, 'User not found');
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
