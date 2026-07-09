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
            $apiUser = $this->authenticateByApiToken($token);
            if ($apiUser) {
                $this->currentUser = $apiUser;
                $this->currentUserId = $apiUser['id'];

                $stmt = $this->pdo->prepare("SELECT tenant_id FROM memberships WHERE user_id = ?");
                $stmt->execute([$this->currentUserId]);
                $this->joinedTenants = $stmt->fetchAll(PDO::FETCH_COLUMN);
                $this->currentTenantId = $this->joinedTenants[0] ?? '';
                return;
            }
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
        // R-029: 初期行に parent_id = ? を追加し、3階層以上の子孫を正しく取得
        $sql = "
            WITH RECURSIVE project_tree AS (
                SELECT id FROM items WHERE id = ? OR project_id = ? OR parent_id = ?
                UNION ALL
                SELECT i.id FROM items i
                JOIN project_tree pt ON i.parent_id = pt.id OR i.project_id = pt.id
            )
            SELECT id FROM project_tree
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$projectId, $projectId, $projectId]);
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
        $item['projectTitle'] = $item['real_project_title'] ?? null;
        $item['parentTitle'] = $item['parent_title'] ?? null;
        $item['projectType'] = $item['project_type'] ?? null;
        $item['projectCategory'] = $item['project_category'] ?? null;
        
        $item['clientName'] = $item['client_name'] ?? $item['client'] ?? null;
        $item['siteName'] = $item['site_name'] ?? $item['site'] ?? null;
        $item['grossProfitTarget'] = (int)($item['gross_profit_target'] ?? 0);

        // Assignee Info (R-050 Phase1: u_ プレフィックス判定を一覧系に横展開)
        $assigneeInfo = $this->resolveAssigneeInfo($item['assignedTo']);
        $item['assigneeName'] = $assigneeInfo['name'];
        $item['assigneeColor'] = $assigneeInfo['color'];
        $item['assigneeKind'] = $assigneeInfo['kind'];

        // Dates & Trash
        $item['deletedAt'] = isset($item['deleted_at']) ? (int)$item['deleted_at'] : null;
        $item['completedAt'] = isset($item['completed_at']) ? (int)$item['completed_at'] : null;
        $item['prep_date'] = isset($item['prep_date']) ? (int)$item['prep_date'] : null;
        $item['work_days'] = (int)($item['work_days'] ?? 1);

        // Timestamps: Unix秒→ミリ秒変換（楽観的更新の Date.now() と単位統一）
        $item['createdAt'] = isset($item['created_at']) ? (int)$item['created_at'] * 1000 : null;
        $item['updatedAt'] = isset($item['updated_at']) ? (int)$item['updated_at'] * 1000 : null;

        // JSON handling
        if (!empty($item['delegation']) && is_string($item['delegation'])) {
            $item['delegation'] = json_decode($item['delegation'], true);
        }

        // meta (JSON) - フローView等で使用
        if (!empty($item['meta']) && is_string($item['meta'])) {
            $item['meta'] = json_decode($item['meta'], true);
        } elseif (!isset($item['meta'])) {
            $item['meta'] = null;
        }

        return $item;
    }

    /**
     * assigned_to の値域解決（R-050 Phase1、docs/SPEC/04_データ設計.md §3.8）
     * u_ プレフィックス形式は users テーブル、それ以外は assignees テーブルから解決する。
     * どちらにも一致しない場合は孤児データとしてログ出力し、未割当（null）扱いにする。
     */
    protected function resolveAssigneeInfo($assignedTo) {
        if (empty($assignedTo)) {
            return ['name' => null, 'color' => null, 'kind' => null];
        }

        if (strpos((string)$assignedTo, 'u_') === 0) {
            $stmt = $this->pdo->prepare("SELECT display_name, email FROM users WHERE id = ?");
            $stmt->execute([$assignedTo]);
            $user = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($user) {
                return ['name' => $user['display_name'] ?: $user['email'], 'color' => null, 'kind' => 'user'];
            }
            error_log("[R-050] orphaned assigned_to (u_ prefix, not found in users): $assignedTo");
            return ['name' => null, 'color' => null, 'kind' => null];
        }

        $stmt = $this->pdo->prepare("SELECT name, color FROM assignees WHERE id = ?");
        $stmt->execute([$assignedTo]);
        $assignee = $stmt->fetch(PDO::FETCH_ASSOC);
        if ($assignee) {
            return ['name' => $assignee['name'], 'color' => $assignee['color'], 'kind' => 'assignee'];
        }

        error_log("[R-050] orphaned assigned_to (not found in assignees): $assignedTo");
        return ['name' => null, 'color' => null, 'kind' => null];
    }

    /**
     * 管理者スコープの権限判定（R-050 Phase1、docs/SPEC/04_データ設計.md §5.3 4番目のルール）
     * JWTの role は信頼せず、対象テナントに対する role を都度 memberships から取得する。
     * 本人指定は常に許可。他者指定は owner/admin のみ許可し、対象がテナントに実在しない場合もエラーにする。
     */
    protected function assertAdminScopeAllowed($tenantId, $targetAssignedTo) {
        if ((string)$targetAssignedTo === (string)$this->currentUserId) {
            return;
        }

        $stmt = $this->pdo->prepare("SELECT role FROM memberships WHERE user_id = ? AND tenant_id = ?");
        $stmt->execute([$this->currentUserId, $tenantId]);
        $role = $stmt->fetchColumn();

        if ($role !== 'owner' && $role !== 'admin') {
            $this->sendError(403, 'Access Denied: Admin scope requires owner/admin role');
            return;
        }

        if (strpos((string)$targetAssignedTo, 'u_') === 0) {
            $checkStmt = $this->pdo->prepare("SELECT 1 FROM memberships WHERE user_id = ? AND tenant_id = ?");
            $checkStmt->execute([$targetAssignedTo, $tenantId]);
        } else {
            $checkStmt = $this->pdo->prepare("SELECT 1 FROM assignees WHERE id = ? AND tenant_id = ?");
            $checkStmt->execute([$targetAssignedTo, $tenantId]);
        }

        if (!$checkStmt->fetchColumn()) {
            $this->sendError(404, 'Assignee not found in tenant');
        }
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

    protected function authenticateByApiToken($token) {
        $stmt = $this->pdo->prepare("SELECT * FROM api_tokens WHERE token = ?");
        $stmt->execute([$token]);
        $apiToken = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$apiToken) {
            return null;
        }

        $this->pdo->prepare("UPDATE api_tokens SET last_used_at = ? WHERE id = ?")
            ->execute([time(), $apiToken['id']]);

        $stmt = $this->pdo->prepare("SELECT * FROM users WHERE id = ?");
        $stmt->execute([$apiToken['user_id']]);
        return $stmt->fetch(PDO::FETCH_ASSOC) ?: null;
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
