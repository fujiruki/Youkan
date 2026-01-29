<?php
// backend/AssigneeController.php
require_once 'BaseController.php';

class AssigneeController extends BaseController {

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
            $this->sendError(403, 'Tenant context required');
        }

        $stmt = $this->pdo->prepare("SELECT * FROM assignees WHERE tenant_id = ? ORDER BY created_at ASC");
        $stmt->execute([$this->currentTenantId]);
        $assignees = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->sendJSON($assignees);
    }

    private function create() {
        if (!$this->currentTenantId) {
            $this->sendError(403, 'Tenant context required');
        }

        $data = $this->getInput();
        if (empty($data['name'])) {
            $this->sendError(400, 'Name is required');
        }

        $sql = "INSERT INTO assignees (tenant_id, name, type, email, color) VALUES (?, ?, ?, ?, ?)";
        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                $this->currentTenantId,
                $data['name'],
                $data['type'] ?? 'external',
                $data['email'] ?? null,
                $data['color'] ?? '#cccccc'
            ]);
            
            $id = $this->pdo->lastInsertId();
            $this->sendJSON(['success' => true, 'id' => $id]); // Frontend expects ID
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
        if (isset($data['type'])) { $fields[] = "type = ?"; $params[] = $data['type']; }
        if (isset($data['email'])) { $fields[] = "email = ?"; $params[] = $data['email']; }
        if (isset($data['color'])) { $fields[] = "color = ?"; $params[] = $data['color']; }

        if (empty($fields)) {
            $this->sendJSON(['success' => true]); // No-op
            return;
        }

        $sql = "UPDATE assignees SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?";
        $params[] = $id;
        $params[] = $this->currentTenantId;

        try {
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            
            if ($stmt->rowCount() === 0) {
                // Determine if it was naive "no changes" or "not found"
                // But simplified response is fine.
            }
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }

    private function delete($id) {
        if (!$this->currentTenantId) {
            $this->sendError(403, 'Tenant context required');
        }

        $stmt = $this->pdo->prepare("DELETE FROM assignees WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);

        if ($stmt->rowCount() === 0) {
            $this->sendError(404, 'Assignee not found or denied');
        }
        $this->sendJSON(['success' => true]);
    }
}
