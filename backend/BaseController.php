<?php
// backend/BaseController.php
require_once 'db.php';
require_once 'JWTService.php';

class BaseController {
    protected $pdo;
    protected $currentUser;
    protected $currentTenantId;
    protected $currentUserId; // Added for convenience
    protected $joinedTenants = []; // [Fix] PHP 8.2 Dynamic Property Deprecation

    public function __construct() {
        $this->pdo = getDB();
    }

    protected function authenticate() {
        $token = JWTService::getBearerToken();
        
        // [Debug/Repair] Also check query param if header fails (useful for debugging/some environments)
        if (!$token && isset($_GET['token'])) {
            $token = $_GET['token'];
        }

        // [Debug Mode] Accept mock token for offline development
        if ($token === 'mock-debug-token') {
            $this->currentUser = [
                'sub' => 'u_697b2af132f4f', 
                'name' => 'Debug User',
                'tenant_id' => 't_697b2af180467',
                'role' => 'admin'
            ];
            $this->currentTenantId = 't_697b2af180467';
            $this->currentUserId = 'u_697b2af132f4f'; 
            $this->joinedTenants = ['t_697b2af180467']; 
            return;
        }

        if (!$token) {
            $this->sendError(401, 'No token provided');
        }

        $payload = JWTService::decrypt($token);
        if (!$payload) {
            $this->sendError(401, 'Invalid or expired token');
        }

        $this->currentUser = $payload;
        $this->currentTenantId = $payload['tenant_id'] ?? null;
        $this->currentUserId = $payload['sub'] ?? null;

        if (!$this->currentUserId) {
            error_log("BaseController: Token missing 'sub' claim. Payload: " . json_encode($payload));
            $this->sendError(401, 'Invalid token: User ID missing');
        }

        // [New] Load all joined tenants for Context Aware Access
        if ($this->currentUserId) {
            $stmt = $this->pdo->prepare("SELECT tenant_id FROM memberships WHERE user_id = ?");
            $stmt->execute([$this->currentUserId]);
            $this->joinedTenants = $stmt->fetchAll(PDO::FETCH_COLUMN);

            // [Modified] Self-Healing Disabled: Allow Tenant-less (Personal) User.
            // If user exists but has NO tenant, do not force create one.
        }

        if (!$this->currentTenantId) {
            // Allow tenant-less access (Personal Mode)
            // Always default to empty string for Personal context
            // This matches the logic in ProjectController and ItemController
            $this->currentTenantId = ''; 
        }
    }

    protected function sendJSON($data) {
        header('Content-Type: application/json');
        echo json_encode($data);
        exit;
    }

    protected function sendError($code, $message) {
        header('Content-Type: application/json', true, $code);
        echo json_encode(['error' => $message]);
        exit;
    }

    protected function getInput() {
        return json_decode(file_get_contents('php://input'), true) ?? [];
    }

    /**
     * Helper: Get all descendant IDs for a project (Recursive CTE)
     * [UUID v7] Simplified: No prefix conversion needed
     */
    protected function getProjectDescendantIds($projectId) {
        // SQLite Recursive Query to get tree
        $sql = "
            WITH RECURSIVE project_tree AS (
                SELECT id FROM items WHERE id = ? OR project_id = ?
                UNION ALL
                SELECT i.id FROM items i
                JOIN project_tree pt ON i.parent_id = pt.id OR i.project_id = pt.id
            )
            SELECT id FROM project_tree
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$projectId, $projectId]);
        $ids = $stmt->fetchAll(PDO::FETCH_COLUMN);
        
        // Ensure source ID is included
        if (!in_array($projectId, $ids)) $ids[] = $projectId;
        
        return array_unique($ids);
    }

    /**
     * Common Item Mapping (DB -> Frontend JSON)
     * Centralized logic to prevent property loss across controllers
     */
    protected function mapItemRow($item) {
        // Standard Boolean conversion
        $item['interrupt'] = (bool)($item['interrupt'] ?? 0);
        $item['is_boosted'] = (bool)($item['is_boosted'] ?? 0);
        $item['isProject'] = (bool)($item['is_project'] ?? 0);
        $item['isIntent'] = (bool)($item['is_intent'] ?? 0);
        $item['isArchived'] = (bool)($item['is_archived'] ?? 0);

        // Standard ID mapping (camelCase for Frontend)
        $item['parentId'] = $item['parent_id'] ?? null;
        $item['projectId'] = $item['project_id'] ?? null;
        $item['tenantId'] = $item['tenant_id'] ?? null;
        $item['assignedTo'] = $item['assigned_to'] ?? null;
        $item['createdBy'] = $item['created_by'] ?? null;

        // Standard Property mapping
        $item['estimatedMinutes'] = (int)($item['estimated_minutes'] ?? 0);
        $item['focusOrder'] = (int)($item['focus_order'] ?? 0);
        $item['dueStatus'] = $item['due_status'] ?? null;
        
        // Project Context
        $item['projectTitle'] = $item['real_project_title'] ?? $item['parent_title'] ?? null;
        $item['projectType'] = $item['project_type'] ?? null;
        $item['projectCategory'] = $item['project_category'] ?? null;
        
        $item['clientName'] = $item['client_name'] ?? $item['client'] ?? null;
        $item['siteName'] = $item['site_name'] ?? $item['site'] ?? null;
        $item['grossProfitTarget'] = (int)($item['gross_profit_target'] ?? 0);

        // Assignee Info
        $item['assigneeName'] = $item['assignee_name'] ?? null;
        $item['assigneeColor'] = $item['assignee_color'] ?? null;

        // Dates & Trash
        $item['deletedAt'] = $item['deleted_at'] ?? null;
        $item['prep_date'] = $item['prep_date'] ?? null;
        $item['work_days'] = (int)($item['work_days'] ?? 1);

        // JSON handling
        if (!empty($item['delegation']) && is_string($item['delegation'])) {
            $item['delegation'] = json_decode($item['delegation'], true);
        }

        return $item;
    }

    /**
     * Common Update Logic for Entities (Supports PATCH/PUT)
     * Automatically maps camelCase inputs to snake_case DB columns.
     */
    protected function updateEntity(string $table, string $id, array $allowedFields) {
        $data = $this->getInput();
        if (empty($data)) {
            return ['success' => true, 'changed' => false];
        }

        $fields = [];
        $params = [];

        foreach ($allowedFields as $dbCol) {
            $apiKey = $this->toCamel($dbCol);
            
            // Allow both snake_case and camelCase in input
            $val = null;
            $found = false;

            if (array_key_exists($apiKey, $data)) {
                $val = $data[$apiKey];
                $found = true;
            } elseif (array_key_exists($dbCol, $data)) {
                $val = $data[$dbCol];
                $found = true;
            }

            if ($found) {
                // Type conversion
                if (is_bool($val)) {
                    $val = $val ? 1 : 0;
                } elseif (is_array($val)) {
                    $val = json_encode($val);
                }

                $fields[] = "$dbCol = ?";
                $params[] = $val;
            }
        }

        if (empty($fields)) {
            return ['success' => true, 'changed' => false];
        }

        // Always update updated_at if exists in table (assumed for standard tables)
        $fields[] = "updated_at = ?";
        $params[] = time();

        $sql = "UPDATE $table SET " . implode(', ', $fields) . " WHERE id = ?";
        $params[] = $id;

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            return ['success' => true, 'count' => $stmt->rowCount()];
        } catch (PDOException $e) {
            error_log("[BaseController] Update Error on $table ($id): " . $e->getMessage());
            $this->sendError(500, 'Database Error during update');
        }
    }

    /**
     * Helper to convert snake_case to camelCase
     */
    protected function toCamel($str) {
        $str = str_replace('_', ' ', $str);
        $str = ucwords($str);
        $str = str_replace(' ', '', $str);
        return lcfirst($str);
    }
}
