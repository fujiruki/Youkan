<?php
// backend/MasterItemController.php
require_once 'BaseController.php';

class MasterItemController extends BaseController {

    public function handleRequest($method, $id = null) {
        $this->authenticate(); // Enforce Tenant Scope

        if ($method === 'GET') {
            if ($id) {
                $this->show($id);
            } else {
                $this->index();
            }
        } elseif ($method === 'POST') {
            $this->create();
        } elseif ($method === 'PUT' && $id) {
            $this->update($id);
        } elseif ($method === 'DELETE' && $id) {
            $this->delete($id);
        } else {
            $this->sendError(405, 'Method Not Allowed');
        }
    }

    // GET /api/masters
    private function index() {
        $category = $_GET['category'] ?? null;
        $sql = "SELECT * FROM master_items WHERE tenant_id = ?";
        $params = [$this->currentTenantId];

        if ($category) {
            $sql .= " AND category = ?";
            $params[] = $category;
        }
        
        $sql .= " ORDER BY updated_at DESC";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Decode specs_json
        $items = array_map(function($i) {
            if ($i['specs_json']) $i['specs_json'] = json_decode($i['specs_json'], true);
            return $i;
        }, $items);

        $this->sendJSON($items);
    }

    // GET /api/masters/{id}
    private function show($id) {
        $sql = "SELECT * FROM master_items WHERE id = ? AND tenant_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$id, $this->currentTenantId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            $this->sendError(404, 'Master Item not found');
        }
        
        if ($item['specs_json']) $item['specs_json'] = json_decode($item['specs_json'], true);
        $this->sendJSON($item);
    }

    // POST /api/masters
    private function create() {
        $input = $this->getInput();
        if (empty($input['name'])) {
            $this->sendError(400, 'Name is required');
        }

        $id = uniqid('mst_');
        $now = time();
        
        $sql = "INSERT INTO master_items (
            id, tenant_id, category, name, unit_price, supplier, image_url, specs_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            $id,
            $this->currentTenantId,
            $input['category'] ?? 'material',
            $input['name'],
            $input['unitPrice'] ?? 0,
            $input['supplier'] ?? null,
            $input['imageUrl'] ?? null,
            isset($input['specs']) ? json_encode($input['specs']) : null,
            $now, $now
        ]);
        
        $this->sendJSON(['id' => $id, 'success' => true]);
    }

    // PUT /api/masters/{id}
    private function update($id) {
        $input = $this->getInput();

        // Verify existence
        $stmt = $this->pdo->prepare("SELECT id FROM master_items WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);
        if (!$stmt->fetch()) $this->sendError(404, 'Master Item not found');
        
        $updates = [];
        $params = [];
        $fields = ['category', 'name', 'unit_price', 'supplier', 'image_url'];

        // Simple mapping
        if (isset($input['category'])) { $updates[] = "category = ?"; $params[] = $input['category']; }
        if (isset($input['name'])) { $updates[] = "name = ?"; $params[] = $input['name']; }
        if (isset($input['unitPrice'])) { $updates[] = "unit_price = ?"; $params[] = $input['unitPrice']; }
        if (isset($input['supplier'])) { $updates[] = "supplier = ?"; $params[] = $input['supplier']; }
        if (isset($input['imageUrl'])) { $updates[] = "image_url = ?"; $params[] = $input['imageUrl']; }

        if (isset($input['specs'])) {
             $updates[] = "specs_json = ?";
             $params[] = json_encode($input['specs']);
        }

        if (empty($updates)) {
            $this->sendJSON(['success' => true, 'changed' => false]);
            return;
        }

        $updates[] = "updated_at = ?";
        $params[] = time();
        $params[] = $id;
        $params[] = $this->currentTenantId;

        $sql = "UPDATE master_items SET " . implode(', ', $updates) . " WHERE id = ? AND tenant_id = ?";
        $this->pdo->prepare($sql)->execute($params);
        
        $this->sendJSON(['success' => true]);
    }

    // DELETE /api/masters/{id}
    private function delete($id) {
        $stmt = $this->pdo->prepare("DELETE FROM master_items WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);
        
        if ($stmt->rowCount() === 0) {
            $this->sendError(404, 'Master Item not found');
        }
        
        $this->sendJSON(['success' => true]);
    }
}
