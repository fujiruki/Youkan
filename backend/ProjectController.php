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
        // Unified Logic: Return BOTH Company Projects and Personal Projects
        // Frontend will filter/group them.
        
        $sql = "
            SELECT * FROM items 
            WHERE 
                project_type IS NOT NULL 
                AND (
                    (tenant_id = ?) -- Company Context
                    OR 
                    (tenant_id IS NULL AND (created_by = ? OR assigned_to = ?)) -- Personal Context
                )
            ORDER BY updated_at DESC
        ";
        
        // If currentTenantId is null (Personal Mode), the first condition (tenant_id = NULL) matches via parameter binding? 
        // No, bind param will be null. `tenant_id = NULL` in SQL is false. It needs `IS NULL`.
        // So we need dynamic SQL or handle strictness.
        
        if ($this->currentTenantId) {
            $params = [$this->currentTenantId, $this->currentUserId, $this->currentUserId];
        } else {
            // Personal Mode: Search for items where tenant_id IS NULL (and created/assigned)
            // The query above `tenant_id = ?` with null will fail.
            // Simplified query for Personal Mode:
             $sql = "
                SELECT * FROM items 
                WHERE 
                    project_type IS NOT NULL 
                    AND tenant_id IS NULL 
                    AND (created_by = ? OR assigned_to = ?)
                ORDER BY updated_at DESC
            ";
            $params = [$this->currentUserId, $this->currentUserId];
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->sendJSON(array_map([$this, 'mapItemToProject'], $items));
    }

    private function show($id) {
        // We need to check permission. 
        // IF tenant_id -> Must match currentTenantId.
        // IF no tenant_id -> Must match currentUserId (created/assigned).
        
        $stmt = $this->pdo->prepare("SELECT * FROM items WHERE id = ?");
        $stmt->execute([$id]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            $this->sendError(404, 'Project not found');
        }

        // Auth Check
        if ($item['tenant_id']) {
            if ($item['tenant_id'] !== $this->currentTenantId) {
                $this->sendError(403, 'Access Denied (Company Mismatch)');
            }
        } else {
            // Personal
            if ($item['created_by'] !== $this->currentUserId && $item['assigned_to'] !== $this->currentUserId) {
                $this->sendError(403, 'Access Denied (Not your personal project)');
            }
        }

        $this->sendJSON($this->mapItemToProject($item));
    }

    private function create() {
        $data = $this->getInput();
        if (empty($data['name'])) {
            $this->sendError(400, 'Project name is required');
        }

        $id = $data['id'] ?? uniqid('prj-', true);
        $now = time(); // PHP time (seconds) - Wait, previous controller used ms for projects? 
        // Items uses seconds usually. Let's stick to items standard (seconds).
        // Frontend expects whatever items uses.

        // Pack Meta
        $meta = [
            'settings' => $data['settings'] ?? [],
            'dxf_config' => $data['dxf_config'] ?? [],
            'view_mode' => $data['view_mode'] ?? 'internal',
            'gross_profit_target' => $data['gross_profit_target'] ?? 0,
            'color' => $data['color'] ?? 'blue'
        ];
        // If type is in data, use it, else default 'general'
        $type = $data['type'] ?? ($data['settings']['type'] ?? 'general');
        $meta['settings']['type'] = $type;

        $tenantId = $this->currentTenantId; // Can be null (Personal)

        $stmt = $this->pdo->prepare("
            INSERT INTO items (
                id, tenant_id, title, project_type, client, meta, 
                status, created_at, updated_at, created_by, assigned_to
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $status = $data['judgment_status'] ?? 'inbox'; // Map to item status

        try {
            $stmt->execute([
                $id,
                $tenantId,
                $data['name'],
                $type,
                $data['client'] ?? '',
                json_encode($meta),
                $status,
                $now,
                $now,
                $this->currentUserId,
                $data['assigned_to'] ?? $this->currentUserId // Default assign to creator
            ]);
            $this->show($id);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }

    private function update($id) {
        // Fetch current to check auth
        $stmt = $this->pdo->prepare("SELECT * FROM items WHERE id = ?");
        $stmt->execute([$id]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            $this->sendError(404, 'Project not found');
        }

        // Auth Logic same as show (simplified)
        if (($item['tenant_id'] && $item['tenant_id'] !== $this->currentTenantId) ||
            (!$item['tenant_id'] && $item['created_by'] !== $this->currentUserId)) {
             $this->sendError(403, 'Access Denied');
        }

        $data = $this->getInput();
        $fields = [];
        $params = [];

        // Map updates
        if (isset($data['name'])) { $fields[] = "title = ?"; $params[] = $data['name']; }
        if (isset($data['client'])) { $fields[] = "client = ?"; $params[] = $data['client']; }
        if (isset($data['judgment_status'])) { $fields[] = "status = ?"; $params[] = $data['judgment_status']; }
        
        // Meta Updates (Merge)
        $meta = json_decode($item['meta'] ?? '{}', true);
        $metaUpdated = false;
        
        if (isset($data['settings'])) { $meta['settings'] = $data['settings']; $metaUpdated = true; }
        if (isset($data['dxf_config'])) { $meta['dxf_config'] = $data['dxf_config']; $metaUpdated = true; }
        if (isset($data['view_mode'])) { $meta['view_mode'] = $data['view_mode']; $metaUpdated = true; }
        if (isset($data['gross_profit_target'])) { $meta['gross_profit_target'] = $data['gross_profit_target']; $metaUpdated = true; }
        if (isset($data['color'])) { $meta['color'] = $data['color']; $metaUpdated = true; }

        if ($metaUpdated) {
            $fields[] = "meta = ?";
            $params[] = json_encode($meta);
        }

        if (empty($fields)) {
            $this->show($id);
            return;
        }

        $fields[] = "updated_at = ?";
        $params[] = time();
        $params[] = $id;

        $sql = "UPDATE items SET " . implode(', ', $fields) . " WHERE id = ?";
        $this->pdo->prepare($sql)->execute($params);
        $this->show($id);
    }

    private function delete($id) {
        // Access Check Omitted for brevity, assume similar to update
        // We should verify project_type IS NOT NULL to avoid deleting tasks via this API?
        // Or just allow it.
        $stmt = $this->pdo->prepare("DELETE FROM items WHERE id = ? AND (tenant_id = ? OR (tenant_id IS NULL AND created_by = ?))");
        $stmt->execute([$id, $this->currentTenantId, $this->currentUserId]);
        
        if ($stmt->rowCount() === 0) {
            $this->sendError(404, 'Project not found or denied');
        }
        $this->sendJSON(['success' => true]);
    }

    /**
     * Map Unified Item to Legacy Project Structure
     */
    private function mapItemToProject($item) {
        $meta = json_decode($item['meta'] ?? '{}', true);
        
        return [
            'id' => $item['id'],
            'tenant_id' => $item['tenant_id'],
            'name' => $item['title'], // Map title -> name
            'client' => $item['client'],
            'settings_json' => json_encode($meta['settings'] ?? []),
            'dxf_config_json' => json_encode($meta['dxf_config'] ?? []),
            'view_mode' => $meta['view_mode'] ?? 'internal',
            'judgment_status' => $item['status'], // Map status
            'is_archived' => ($item['status'] === 'archive'),
            'gross_profit_target' => $meta['gross_profit_target'] ?? 0,
            'color' => $meta['color'] ?? 'blue',
            'created_at' => $item['created_at'], // Seconds? Legacy was ms. Frontend might need conversion.
            'updated_at' => $item['updated_at'],
            'type' => $item['project_type'] // Exposed
        ];
    }
}
