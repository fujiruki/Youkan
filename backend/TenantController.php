<?php
// backend/TenantController.php
require_once 'BaseController.php';

class TenantController extends BaseController {

    public function handleRequest($method, $path) {
        $this->authenticate();

        // /tenant/members
        if (preg_match('#^/members$#', $path)) {
            if ($method === 'GET') {
                $this->getMembers();
            } elseif ($method === 'POST') {
                $this->inviteMember();
            } elseif ($method === 'DELETE') {
                $this->removeMember(); // Need ID query or body
            } else {
                $this->sendError(405, 'Method Not Allowed');
            }
        }
        // /tenant/members/{id} (DELETE, PUT)
        elseif (preg_match('#^/members/(.+)$#', $path, $matches)) {
            if ($method === 'DELETE') {
                 $this->removeMember($matches[1]);
            } elseif ($method === 'PUT') {
                 $this->updateMember($matches[1]);
            } else {
                 $this->sendError(405, 'Method Not Allowed');
            }
        }
        // /tenant/info
        elseif (preg_match('#^/info$#', $path)) {
            if ($method === 'GET') {
                $this->getInfo();
            } elseif ($method === 'PUT') {
                 $this->updateInfo();
            } else {
                $this->sendError(405, 'Method Not Allowed');
            }
        }
        else {
             $this->sendError(404, 'Endpoint Not Found');
        }
    }

    private function getMembers() {
        if (!$this->currentTenantId) {
             $this->sendError(400, 'Company context required');
        }

        // Only owner/admin can list members? Or regular members too?
        // Let's allow everyone in tenant to see who else is in tenant.
        
        $stmt = $this->pdo->prepare("
            SELECT u.id, u.email, u.display_name, m.role, m.joined_at, m.is_core, u.daily_capacity_minutes
            FROM memberships m
            JOIN users u ON u.id = m.user_id
            WHERE m.tenant_id = ?
            ORDER BY m.joined_at ASC
        ");
        $stmt->execute([$this->currentTenantId]);
        
        $this->sendJSON($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    private function updateMember($memberId) {
        if (!$this->currentTenantId) {
             $this->sendError(400, 'Company context required');
        }
        if (($this->currentUser['role'] ?? '') !== 'owner' && ($this->currentUser['role'] ?? '') !== 'admin') {
             $this->sendError(403, 'Only admins can update members');
        }

        $input = $this->getInput();
        $updates = [];
        $params = [];

        if (isset($input['is_core'])) {
            $updates[] = "is_core = ?";
            $params[] = $input['is_core'] ? 1 : 0;
        }
        if (isset($input['daily_capacity_minutes'])) {
            $updates[] = "daily_capacity_minutes = ?";
            $params[] = intval($input['daily_capacity_minutes']);
        }
        if (isset($input['role'])) {
            $updates[] = "role = ?";
            $params[] = $input['role'];
        }

        if (empty($updates)) {
            $this->sendJSON(['success' => true, 'message' => 'No changes']);
            return;
        }

        $sql = "UPDATE memberships SET " . implode(', ', $updates) . " WHERE user_id = ? AND tenant_id = ?";
        $params[] = $memberId;
        $params[] = $this->currentTenantId;

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);

        $this->sendJSON(['success' => true]);
    }

    private function inviteMember() {
        if (!$this->currentTenantId) {
             $this->sendError(400, 'Company context required');
        }
        // Check Admin
        // (Assuming current user role is stored in token or can be fetched)
        // Token has role.
        if (($this->currentUser['role'] ?? '') !== 'owner' && ($this->currentUser['role'] ?? '') !== 'admin') {
             $this->sendError(403, 'Only admins can invite members');
        }

        $input = $this->getInput();
        $email = $input['email'] ?? null;
        if (!$email) $this->sendError(400, 'Email required');

        // 1. Check if user exists
        $stmt = $this->pdo->prepare("SELECT id FROM users WHERE email = ?");
        $stmt->execute([$email]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        $userId = null;

        $this->pdo->beginTransaction();

        try {
            if ($user) {
                // User exists. Check if already member.
                $userId = $user['id'];
                $check = $this->pdo->prepare("SELECT tenant_id FROM memberships WHERE user_id = ? AND tenant_id = ?");
                $check->execute([$userId, $this->currentTenantId]);
                if ($check->fetch()) {
                    $this->sendError(409, 'User is already a member');
                }
            } else {
                // Create Stub User
                $userId = uniqid('u_');
                // Temp password (should trigger reset flow, but simplified here)
                $tempPass = password_hash('welcome123', PASSWORD_DEFAULT); 
                $name = $input['name'] ?? explode('@', $email)[0];
                
                $create = $this->pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)");
                $create->execute([$userId, $email, $tempPass, $name, date('Y-m-d H:i:s')]);
            }

            // 2. Add Membership
            $role = $input['role'] ?? 'user';
            $add = $this->pdo->prepare("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES (?, ?, ?, ?)");
            $add->execute([$userId, $this->currentTenantId, $role, date('Y-m-d H:i:s')]);
            
            $this->pdo->commit();
            $this->sendJSON(['success' => true, 'userId' => $userId, 'message' => 'Member added']);

        } catch (Exception $e) {
            $this->pdo->rollBack();
            $this->sendError(500, 'Failed to invite: ' . $e->getMessage());
        }
    }

    private function removeMember($memberId) {
        if (!$this->currentTenantId) {
             $this->sendError(400, 'Company context required');
        }
        if (($this->currentUser['role'] ?? '') !== 'owner' && ($this->currentUser['role'] ?? '') !== 'admin') {
             $this->sendError(403, 'Only admins can remove members');
        }
        
        // Cannot remove self if owner?
        if ($memberId === $this->currentUserId) {
            $this->sendError(400, 'Cannot remove yourself');
        }

        $stmt = $this->pdo->prepare("DELETE FROM memberships WHERE user_id = ? AND tenant_id = ?");
        $stmt->execute([$memberId, $this->currentTenantId]);

        if ($stmt->rowCount() > 0) {
            $this->sendJSON(['success' => true]);
        } else {
            $this->sendError(404, 'Member not found');
        }
    }

    private function getInfo() {
        if (!$this->currentTenantId) {
             $this->sendError(400, 'Company context required');
        }
        
        // Retrieve tenant info + member count
        $stmt = $this->pdo->prepare("
            SELECT t.id, t.name, t.created_at, COUNT(m.user_id) as member_count
            FROM tenants t
            LEFT JOIN memberships m ON t.id = m.tenant_id
            WHERE t.id = ?
            GROUP BY t.id
        ");
        $stmt->execute([$this->currentTenantId]);
        $info = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$info) {
             $this->sendError(404, 'Tenant not found');
        }
        
        $this->sendJSON($info);
    }
    
    private function updateInfo() {
        if (!$this->currentTenantId) {
             $this->sendError(400, 'Company context required');
        }
        if (($this->currentUser['role'] ?? '') !== 'owner' && ($this->currentUser['role'] ?? '') !== 'admin') {
             $this->sendError(403, 'Only admins can update company info');
        }
        
        $input = $this->getInput();
        if (empty($input['name'])) {
            $this->sendError(400, 'Name is required');
        }
        
        $stmt = $this->pdo->prepare("UPDATE tenants SET name = ? WHERE id = ?");
        $stmt->execute([$input['name'], $this->currentTenantId]);
        
        $this->sendJSON(['success' => true]);
    }
}
