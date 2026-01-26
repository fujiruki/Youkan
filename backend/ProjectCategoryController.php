<?php
// backend/ProjectCategoryController.php
require_once 'BaseController.php';

class ProjectCategoryController extends BaseController {

    public function handleRequest($method, $id = null) {
        $this->authenticate();

        if ($method === 'GET') {
            $this->index();
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

    private function index() {
        if (!$this->currentTenantId) {
            // Personal Mode: Return empty list for now (or implement personal categories later)
            $this->sendJSON([]);
            return;
        }

        $stmt = $this->pdo->prepare("SELECT * FROM project_categories WHERE tenant_id = ? ORDER BY created_at ASC");
        $stmt->execute([$this->currentTenantId]);
        $categories = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Convert SQLite integer to boolean for frontend?
        // Frontend handles 0/1 usually fine, but let's be cleaner if we want.
        // For MVP, raw is fine. frontend `!!val`.

        $this->sendJSON($categories);
    }

    private function create() {
        if (!$this->currentTenantId) {
            $this->sendError(403, 'Tenant context required');
        }

        $data = $this->getInput();
        if (empty($data['name'])) {
            $this->sendError(400, 'Name is required');
        }

        $sql = "INSERT INTO project_categories (tenant_id, name, icon, domain, is_custom) VALUES (?, ?, ?, ?, ?)";
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                $this->currentTenantId,
                $data['name'],
                $data['icon'] ?? '📋',
                $data['domain'] ?? 'general',
                isset($data['is_custom']) ? ($data['is_custom'] ? 1 : 0) : 1
            ]);
            
            $id = $this->pdo->lastInsertId();
            $this->sendJSON(['success' => true, 'id' => $id]);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }

    private function update($id) {
        if (!$this->currentTenantId) {
            $this->sendError(403, 'Tenant context required');
        }

        $data = $this->getInput();
        $fields = [];
        $params = [];

        if (isset($data['name'])) { $fields[] = "name = ?"; $params[] = $data['name']; }
        if (isset($data['icon'])) { $fields[] = "icon = ?"; $params[] = $data['icon']; }
        if (isset($data['domain'])) { $fields[] = "domain = ?"; $params[] = $data['domain']; }

        if (empty($fields)) {
            $this->sendJSON(['success' => true]);
            return;
        }

        // Only allow updating Custom categories? 
        // Backend shouldn't strictly enforce logic unless critical.
        // Frontend validates.
        
        $sql = "UPDATE project_categories SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?";
        $params[] = $id;
        $params[] = $this->currentTenantId;

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }

    private function delete($id) {
        if (!$this->currentTenantId) {
            $this->sendError(403, 'Tenant context required');
        }

        $stmt = $this->pdo->prepare("DELETE FROM project_categories WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);

        if ($stmt->rowCount() === 0) {
            $this->sendError(404, 'Category not found or denied');
        }
        $this->sendJSON(['success' => true]);
    }
}
