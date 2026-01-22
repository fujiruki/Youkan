<?php
// backend/ProjectController.php
require_once 'BaseController.php';

class ProjectController extends BaseController {

    public function handleRequest($method, $id = null) {
        $this->authenticate(); // Enforce Auth

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

    private function index() {
        // Fetch all projects for this tenant
        // TODO: Pagination
        $stmt = $this->pdo->prepare("
            SELECT * FROM projects 
            WHERE tenant_id = ? 
            ORDER BY updated_at DESC
        ");
        $stmt->execute([$this->currentTenantId]);
        $this->sendJSON($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    private function show($id) {
        $stmt = $this->pdo->prepare("SELECT * FROM projects WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);
        $project = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$project) {
            $this->sendError(404, 'Project not found');
        }
        $this->sendJSON($project);
    }

    private function create() {
        $data = $this->getInput();
        if (empty($data['name'])) {
            $this->sendError(400, 'Project name is required');
        }

        $id = $data['id'] ?? uniqid('prj-'); // Ideally UUID from client or server
        // If client provides ID (Migration tool), use it.

        $stmt = $this->pdo->prepare("
            INSERT INTO projects (
                id, tenant_id, name, client, settings_json, dxf_config_json,
                view_mode, judgment_status, is_archived, gross_profit_target, color, 
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $now = time() * 1000; // JS timestamp
        
        // Handle Project Type (e.g. 'manufacturing')
        $settings = $data['settings'] ?? [];
        if (isset($data['type'])) {
            $settings['type'] = $data['type']; // 'standard', 'manufacturing'
        }
        
        $params = [
            $id,
            $this->currentTenantId,
            $data['name'],
            $data['client'] ?? '',
            json_encode($settings), // Store type in settings for now
            is_array($data['dxf_config'] ?? null) ? json_encode($data['dxf_config']) : ($data['dxf_config_json'] ?? '{}'),
            $data['view_mode'] ?? 'internal',
            $data['judgment_status'] ?? 'inbox',
            isset($data['is_archived']) ? ($data['is_archived'] ? 1 : 0) : 0,
            $data['gross_profit_target'] ?? 0,
            $data['color'] ?? null,
            $data['created_at'] ?? $now,
            $now
        ];

        try {
            $stmt->execute($params);
            $this->show($id); // Return created
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }

    private function update($id) {
        $data = $this->getInput();
        
        // Verify existence
        $stmt = $this->pdo->prepare("SELECT id FROM projects WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);
        if (!$stmt->fetch()) {
            $this->sendError(404, 'Project not found');
        }

        $fields = [];
        $params = [];
        $allowed = ['name', 'client', 'view_mode', 'judgment_status', 'is_archived', 'gross_profit_target', 'color'];
        
        foreach ($allowed as $field) {
            if (isset($data[$field])) {
                $fields[] = "$field = ?";
                $params[] = $data[$field];
            }
        }

        // Handle JSON fields
        if (isset($data['settings'])) {
            $fields[] = "settings_json = ?";
            $params[] = json_encode($data['settings']);
        }
        if (isset($data['dxf_config'])) {
            $fields[] = "dxf_config_json = ?";
            $params[] = json_encode($data['dxf_config']);
        }

        if (empty($fields)) {
            $this->show($id);
            return;
        }

        $now = time() * 1000;
        $fields[] = "updated_at = ?";
        $params[] = $now;

        $params[] = $id;
        $params[] = $this->currentTenantId;

        $sql = "UPDATE projects SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?";
        
        try {
            $this->pdo->prepare($sql)->execute($params);
            $this->show($id);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error');
        }
    }

    private function delete($id) {
        $stmt = $this->pdo->prepare("DELETE FROM projects WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);
        
        if ($stmt->rowCount() === 0) {
            $this->sendError(404, 'Project not found');
        }
        $this->sendJSON(['success' => true]);
    }
}
