<?php
// backend/DoorController.php
require_once 'BaseController.php';

class DoorController extends BaseController {

    public function handleRequest($method, $id = null) {
        $this->authenticate(); 

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
        $projectId = $_GET['projectId'] ?? null;
        
        $sql = "SELECT * FROM doors WHERE tenant_id = ?";
        $params = [$this->currentTenantId];

        if ($projectId) {
            $sql .= " AND project_id = ?";
            $params[] = $projectId;
        }
        
        $sql .= " ORDER BY updated_at DESC";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $this->sendJSON($stmt->fetchAll(PDO::FETCH_ASSOC));
    }

    private function show($id) {
        $stmt = $this->pdo->prepare("SELECT * FROM doors WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);
        $door = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$door) {
            $this->sendError(404, 'Door not found');
        }
        $this->sendJSON($door);
    }

    private function create() {
        $data = $this->getInput();
        if (empty($data['project_id']) || empty($data['name'])) {
            $this->sendError(400, 'Project ID and Name are required');
        }

        $id = $data['id'] ?? uniqid('dr-');

        $stmt = $this->pdo->prepare("
            INSERT INTO doors (
                id, tenant_id, project_id, deliverable_id, tag, name,
                dimensions_json, specs_json, count, thumbnail_url,
                status, man_hours, complexity, start_date, due_date,
                category, generic_specs_json, judgment_status, waiting_reason, weight, rough_timing,
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $now = time() * 1000;
        
        // Helper to encode JSON
        $json = function($val) { return is_array($val) ? json_encode($val) : ($val ?? '{}'); };

        $params = [
            $id,
            $this->currentTenantId,
            $data['project_id'],
            $data['deliverable_id'] ?? null,
            $data['tag'] ?? '',
            $data['name'],
            $json($data['dimensions'] ?? null),
            $json($data['specs'] ?? null),
            $data['count'] ?? 1,
            $data['thumbnail_url'] ?? null,
            $data['status'] ?? 'design',
            $data['man_hours'] ?? 0,
            $data['complexity'] ?? 1.0,
            $data['start_date'] ?? null,
            $data['due_date'] ?? null,
            $data['category'] ?? 'door',
            $json($data['generic_specs'] ?? null),
            $data['judgment_status'] ?? 'inbox',
            $data['waiting_reason'] ?? null,
            $data['weight'] ?? 1,
            $data['rough_timing'] ?? null,
            $data['created_at'] ?? $now,
            $now
        ];

        try {
            $stmt->execute($params);
            $this->show($id);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }

    private function update($id) {
        $data = $this->getInput();
        $fields = [];
        $params = [];
        
        // Map of allowed fields (Simple mapping)
        $simpleFields = [
            'tag', 'name', 'count', 'thumbnail_url', 'status', 'man_hours', 'complexity',
            'start_date', 'due_date', 'category', 'judgment_status', 'waiting_reason', 'weight', 'rough_timing', 'deliverable_id'
        ];
        
        foreach ($simpleFields as $field) {
            if (array_key_exists($field, $data)) {
                $fields[] = "$field = ?";
                $params[] = $data[$field];
            }
        }

        // JSON Fields
        $jsonFields = [
            'dimensions' => 'dimensions_json',
            'specs' => 'specs_json',
            'generic_specs' => 'generic_specs_json'
        ];
        
        foreach ($jsonFields as $key => $col) {
            if (array_key_exists($key, $data)) {
                $fields[] = "$col = ?";
                $params[] = json_encode($data[$key]);
            }
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

        $sql = "UPDATE doors SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?";

        try {
            $this->pdo->prepare($sql)->execute($params);
            $this->show($id);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error');
        }
    }

    private function delete($id) {
        $stmt = $this->pdo->prepare("DELETE FROM doors WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);
        if ($stmt->rowCount() === 0) {
            $this->sendError(404, 'Door not found');
        }
        $this->sendJSON(['success' => true]);
    }
}
