<?php
// backend/ManufacturingController.php
require_once 'BaseController.php';
require_once 'ManufacturingSyncService.php';

class ManufacturingController extends BaseController {

    public function handleRequest($method, $subPath = null, $id = null) {
        $this->authenticate();

        if ($subPath === 'items') {
            if ($method === 'GET') {
                $itemId = $_GET['item_id'] ?? null;
                $this->getItemData($itemId);
            } elseif ($method === 'PUT') {
                $itemId = $_GET['item_id'] ?? null;
                $this->updateItemData($itemId);
            }
        } elseif ($subPath === 'members') {
            if ($method === 'GET') {
                $this->getMembers();
            } elseif ($method === 'PUT' && $id) {
                $this->updateMember($id);
            }
        } else {
            $this->sendError(404, 'Manufacturing endpoint not found');
        }
    }

    private function getItemData($itemId) {
        if (!$itemId) $this->sendError(400, 'item_id required');
        
        $stmt = $this->pdo->prepare("SELECT * FROM manufacturing_items WHERE item_id = ?");
        $stmt->execute([$itemId]);
        $data = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if ($data && !empty($data['meta'])) {
            $data['meta'] = json_decode($data['meta'], true);
        }
        
        $this->sendJSON($data ?: []);
    }

    private function updateItemData($itemId) {
        if (!$itemId) $this->sendError(400, 'item_id required');
        $data = $this->getInput();
        
        // Use the Sync Service to perform the update
        ManufacturingSyncService::syncItem($this->pdo, $itemId, $data);
        $this->sendJSON(['success' => true]);
    }

    private function getMembers() {
        // Fetch core members for the current tenant
        $stmt = $this->pdo->prepare("
            SELECT cm.*, u.display_name, u.email
            FROM company_members cm
            JOIN users u ON cm.user_id = u.id
            WHERE cm.tenant_id = ?
        ");
        $stmt->execute([$this->currentTenantId]);
        $members = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $this->sendJSON($members);
    }

    private function updateMember($id) {
        $data = $this->getInput();
        $fields = [];
        $params = [];
        
        if (isset($data['daily_capacity_minutes'])) {
            $fields[] = "daily_capacity_minutes = ?";
            $params[] = $data['daily_capacity_minutes'];
        }
        if (isset($data['is_core_member'])) {
            $fields[] = "is_core_member = ?";
            $params[] = $data['is_core_member'];
        }
        
        if (empty($fields)) $this->sendError(400, 'No fields to update');
        
        $params[] = $id;
        $params[] = $this->currentTenantId;
        
        $sql = "UPDATE company_members SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?";
        $this->pdo->prepare($sql)->execute($params);
        
        $this->sendJSON(['success' => true]);
    }
}
