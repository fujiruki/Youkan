<?php
require_once 'BaseController.php';

class MemberController extends BaseController {
    
    // GET /members
    public function index() {
        $this->authenticate();
        
        try {
            // Fetch memberships with user details for the current tenant
            // Assuming tenant_id is available in current user or request context
            // Since BaseController sets currentUserId, let's look up the tenant.
            // Wait, we need to know WHICH tenant context we are in.
            // For now, assume a User belongs to ONE active tenant or we fetch ALL their memberships?
            // "List Members" implies listing CO-WORKERS in the same tenant.
            
            if (!$this->currentTenantId) {
                // If NO tenant (Personal Account), return ONLY the current user as a virtual team
                $sql = "SELECT id as user_id, email, 'owner' as role, 1 as is_core, daily_capacity_minutes, display_name FROM users WHERE id = ?";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$this->currentUserId]);
                $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
            } else {
                // Query: Join memberships with users to get names
                $sql = "
                    SELECT 
                        m.user_id, 
                        m.role, 
                        m.is_core, 
                        u.daily_capacity_minutes,
                        u.display_name,
                        u.email
                    FROM memberships m
                    JOIN users u ON m.user_id = u.id
                    WHERE m.tenant_id = ?
                ";
                $stmt = $this->pdo->prepare($sql);
                $stmt->execute([$this->currentTenantId]);
                $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
            }

            // Format response
            $response = array_map(function($row) {
                return [
                    'id' => $row['user_id'], // Use user_id as unique ID for membership in this context
                    'userId' => $row['user_id'],
                    'display_name' => $row['display_name'], 
                    'email' => $row['email'] ?? null,
                    'role' => $row['role'],
                    'isCore' => (bool)$row['is_core'],
                    'dailyCapacityMinutes' => (int)$row['daily_capacity_minutes']
                ];
            }, $members);

            echo json_encode($response);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }

    // PUT /members/{id}
    public function update($id, $data) {
        $this->authenticate();

        try {
            // Security: Ensure the membership ID belongs to the current tenant
            if (!$this->currentTenantId) {
                 // Resolve tenant again if needed
                 $stmt = $this->pdo->prepare("SELECT tenant_id FROM memberships WHERE user_id = ? LIMIT 1");
                 $stmt->execute([$this->currentUserId]);
                 $this->currentTenantId = $stmt->fetchColumn();
            }

            // Verify target membership belongs to same tenant
            $checkSql = "SELECT tenant_id FROM memberships WHERE id = ?";
            $checkStmt = $this->pdo->prepare($checkSql);
            $checkStmt->execute([$id]);
            $targetTenantId = $checkStmt->fetchColumn();

            if ($targetTenantId !== $this->currentTenantId) {
                http_response_code(403);
                echo json_encode(['error' => 'Unauthorized access to this membership']);
                return;
            }

            // Update allowed fields
            $updates = [];
            $params = [];

            if (isset($data['is_core'])) {
                $updates[] = "is_core = ?";
                $params[] = $data['is_core'] ? 1 : 0;
            }

            if (isset($data['daily_capacity_minutes'])) {
                $updates[] = "daily_capacity_minutes = ?";
                $params[] = (int)$data['daily_capacity_minutes'];
            }

            if (empty($updates)) {
                http_response_code(400);
                echo json_encode(['error' => 'No fields to update']);
                return;
            }

            $sql = "UPDATE memberships SET " . implode(', ', $updates) . " WHERE id = ?";
            $params[] = $id;

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);

            echo json_encode(['success' => true]);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}
