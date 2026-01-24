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
                // Determine tenant from current user's membership (Pick the first one for now or use session if available)
                // In a multi-tenant app, the tenant_id should be in the header or computed.
                // Re-using simplified logic: Get the tenant of the current user.
                $stmt = $this->pdo->prepare("SELECT tenant_id FROM memberships WHERE user_id = ? LIMIT 1");
                $stmt->execute([$this->currentUserId]);
                $this->currentTenantId = $stmt->fetchColumn();
            }

            if (!$this->currentTenantId) {
                http_response_code(400); // Bad Request (No Tenant Context)
                echo json_encode(['error' => 'No active tenant found for user']);
                return;
            }

            // Query: Join memberships with users to get names
            $sql = "
                SELECT 
                    m.id, 
                    m.user_id, 
                    m.role, 
                    m.is_core, 
                    m.daily_capacity_minutes,
                    u.username,
                    u.display_name
                FROM memberships m
                JOIN users u ON m.user_id = u.id
                WHERE m.tenant_id = ?
            ";

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$this->currentTenantId]);
            $members = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Format response
            $response = array_map(function($row) {
                return [
                    'id' => $row['id'],
                    'userId' => $row['user_id'],
                    'username' => $row['display_name'] ?: $row['username'], // Prefer display name
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
