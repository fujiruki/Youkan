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

        // [Debug Mode] Accept mock token for offline development
        if ($token === 'mock-debug-token') {
            $this->currentUser = [
                'sub' => 'u_default', // [FIX] Match existing default user ID
                'name' => 'Debug User',
                'tenant_id' => 1,
                'role' => 'admin'
            ];
            $this->currentTenantId = 1;
            $this->currentUserId = 'u_default'; // [FIX] Match DB
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
            // But we should prioritize Personal Tenant if exists in joinedTenants?
            // Fallback: Use the first available tenant (Personal or Company)
            if (!empty($this->joinedTenants)) {
                $this->currentTenantId = $this->joinedTenants[0];
            } else {
                // [FIX] Force Personal Tenant ID if no tenant context
                // This prevents SQL NOT NULL error in items.tenant_id
                $this->currentTenantId = 'p_' . $this->currentUserId;
            }
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
}
