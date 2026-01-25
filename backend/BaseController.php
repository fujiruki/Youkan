<?php
// backend/BaseController.php
require_once 'db.php';
require_once 'JWTService.php';

class BaseController {
    protected $pdo;
    protected $currentUser;
    protected $currentTenantId;
    protected $currentUserId; // Added for convenience

    public function __construct() {
        $this->pdo = getDB();
    }

    protected function authenticate() {
        $token = JWTService::getBearerToken();

        // [Debug Mode] Accept mock token for offline development
        if ($token === 'mock-debug-token') {
            $this->currentUser = [
                'sub' => 1,
                'name' => 'Debug User',
                'tenant_id' => 1,
                'role' => 'admin'
            ];
            $this->currentTenantId = 1;
            $this->currentUserId = 1;
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

        // [New] Load all joined tenants for Context Aware Access
        if ($this->currentUserId) {
            $stmt = $this->pdo->prepare("SELECT tenant_id FROM memberships WHERE user_id = ?");
            $stmt->execute([$this->currentUserId]);
            $this->joinedTenants = $stmt->fetchAll(PDO::FETCH_COLUMN);

            // Fail-safe: If currentTenantId from token is not in memberships (removed?), handle it.
            // But strict check might break if token is old. For now, rely on token.
        }

        if (!$this->currentTenantId) {
            // Allow tenant-less access (Personal Mode)
            // But we should prioritize Personal Tenant if exists in joinedTenants?
            // This logic is handled by Client or subsequent Controllers.
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
