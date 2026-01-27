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
            } elseif ($method === 'PUT') {
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

    private function getProfile() {
        if (!$this->currentUserId) {
            $this->sendError(400, 'User context required');
        }

        $stmt = $this->pdo->prepare("SELECT id, email, display_name, birthday, daily_capacity_minutes, non_working_hours, created_at, active_task_id FROM users WHERE id = ?");
        $stmt->execute([$this->currentUserId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $this->sendError(404, 'User not found');
        }
        
        // [JBWOS] Explicit CamelCase for frontend
        $user['activeTaskId'] = $user['active_task_id'];

        $this->sendJSON($user);
    }

    private function updateProfile() {
        if (!$this->currentUserId) {
            $this->sendError(400, 'User context required');
        }

        $input = $this->getInput();
        $updates = [];
        $params = [];

        if (isset($input['display_name'])) {
            $updates[] = "display_name = ?";
            $params[] = $input['display_name'];
        }
        if (isset($input['birthday'])) {
            $updates[] = "birthday = ?";
            $params[] = $input['birthday'];
        }
        if (isset($input['daily_capacity_minutes'])) {
            $updates[] = "daily_capacity_minutes = ?";
            $params[] = intval($input['daily_capacity_minutes']);
        }
        if (isset($input['non_working_hours'])) {
             // Expecting JSON-encoded string or array to be JSON encoded
            $val = is_array($input['non_working_hours']) ? json_encode($input['non_working_hours']) : $input['non_working_hours'];
            $updates[] = "non_working_hours = ?";
            $params[] = $val;
        }
        
        // [JBWOS] Active Task Pointer Update
        if (array_key_exists('activeTaskId', $input) || array_key_exists('active_task_id', $input)) {
            $val = $input['activeTaskId'] ?? $input['active_task_id'];
            $updates[] = "active_task_id = ?";
            $params[] = $val;
        }

        if (empty($updates)) {
            $this->sendJSON(['success' => true, 'message' => 'No changes']);
            return;
        }

        $sql = "UPDATE users SET " . implode(', ', $updates) . " WHERE id = ?";
        $params[] = $this->currentUserId;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $this->sendJSON(['success' => true]);
    }

    private function changePassword() {
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
