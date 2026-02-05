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
}
