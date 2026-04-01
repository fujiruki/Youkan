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
        } elseif (($method === 'PUT' || $method === 'PATCH') && $id) {
            $this->update($id);
        } elseif ($method === 'DELETE' && $id) {
            $this->delete($id);
        } else {
            $this->sendError(405, 'Method Not Allowed');
        }
    }

    private function index() {
        $scope = $_GET['scope'] ?? 'personal'; // Default to personal if not specified
        
        $sql = "";
        $params = [];

        if ($scope === 'dashboard') {
            // Dashboard: Personal items + Company items assigned to me
            // (Strictly: Created by me in Personal Scope OR Assigned to me in ANY Scope)
            // But for now: "Personal Scope" + "Company Items Assigned to Me"
            
            // Personal Items: tenant_id IS NULL or ''
            // Company Items: tenant_id IS NOT NULL AND assigned_to = ?
            
            $sql = "
                SELECT items.*, t.name as tenant_name
                FROM items 
                LEFT JOIN tenants t ON items.tenant_id = t.id
                WHERE items.is_project = 1 
                AND (
                    ((items.tenant_id IS NULL OR items.tenant_id = '') AND (items.created_by = ? OR items.assigned_to = ?))
                    OR
                    (items.tenant_id IS NOT NULL AND items.assigned_to = ?)
                )
                AND items.id IS NOT NULL
                AND items.is_archived = 0 AND items.deleted_at IS NULL
                ORDER BY items.updated_at DESC
            ";
             $params = [$this->currentUserId, $this->currentUserId, $this->currentUserId];

        } elseif ($scope === 'company') {
            // Company Tab: All projects in ALL joined tenants
            if (empty($this->joinedTenants)) {
                $this->sendJSON([]);
                return;
            }
            $placeholders = implode(',', array_fill(0, count($this->joinedTenants), '?'));
            $sql = "
                SELECT items.*, t.name as tenant_name
                FROM items 
                LEFT JOIN tenants t ON items.tenant_id = t.id
                WHERE 
                    items.is_project = 1 
                    AND items.tenant_id IN ($placeholders)
                    AND items.id IS NOT NULL
                    AND items.is_archived = 0 AND items.deleted_at IS NULL
                ORDER BY t.name ASC, items.updated_at DESC
            ";
            $params = $this->joinedTenants;

        } elseif ($scope === 'aggregated') {
            // Aggregated: Personal + All joined companies
            $tenantIds = $this->joinedTenants;
            $placeholders = !empty($tenantIds) ? implode(',', array_fill(0, count($tenantIds), '?')) : "'__NONE__'";
            
            $sql = "
                SELECT items.*, t.name as tenant_name
                FROM items 
                LEFT JOIN tenants t ON items.tenant_id = t.id
                WHERE items.is_project = 1 
                AND (
                    ((items.tenant_id IS NULL OR items.tenant_id = '') AND (items.created_by = ? OR items.assigned_to = ?))
                    OR
                    (items.tenant_id IN ($placeholders))
                )
                AND items.id IS NOT NULL
                AND items.is_archived = 0 AND items.deleted_at IS NULL
                ORDER BY items.updated_at DESC
            ";
            $params = array_merge([$this->currentUserId, $this->currentUserId], $tenantIds);

        } else { // scope === 'personal'
            // Personal Tab: Strictly Personal items
            $sql = "
                SELECT items.*, 'Personal' as tenant_name
                FROM items 
                WHERE 
                    items.is_project = 1 
                    AND (items.tenant_id IS NULL OR items.tenant_id = '') 
                    AND (items.created_by = ? OR items.assigned_to = ?)
                    AND items.id IS NOT NULL
                    AND items.is_archived = 0 AND items.deleted_at IS NULL
                ORDER BY items.updated_at DESC
            ";
            $params = [$this->currentUserId, $this->currentUserId];
        }

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $this->sendJSON(array_map(function($row) {
            $proj = $this->mapItemToProject($row);
            $proj['tenantName'] = $row['tenant_name'] ?? ($row['tenant_id'] ? 'Company' : 'Personal');
            return $proj;
        }, $items));
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
        $itemTenantId = (string)($item['tenant_id'] ?? '');
        if ($itemTenantId !== '') {
            if (!in_array($itemTenantId, $this->joinedTenants)) {
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
        $pTitle = $data['title'] ?? $data['name'] ?? null;
        if (empty($pTitle)) {
            $this->sendError(400, 'Project title/name is required');
        }

        $id = $data['id'] ?? uniqid('prj-', true);
        $now = time(); 

        // Pack Meta
        $meta = [
            'settings' => $data['settings'] ?? [],
            'dxf_config' => $data['dxf_config'] ?? [],
            'view_mode' => $data['view_mode'] ?? 'internal',
            'color' => $data['color'] ?? 'blue'
        ];
        // If type is in data, use it, else default 'general'
        $type = $data['type'] ?? ($data['settings']['type'] ?? 'general');
        $meta['settings']['type'] = $type;

        // Determine tenant_id: use current tenant ONLY if not explicitly personal
        $isPersonal = isset($data['isPersonal']) && $data['isPersonal'] === true;
        $tenantId = (!$isPersonal && !empty($this->currentTenantId)) ? $this->currentTenantId : ''; 

        $stmt = $this->pdo->prepare("
            INSERT INTO items (
                id, tenant_id, title, project_type, client_name, meta, 
                status, created_at, updated_at, created_by, assigned_to,
                gross_profit_target, is_project
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        ");

        $status = $data['judgment_status'] ?? 'inbox'; // Map to item status

        try {
            $stmt->execute([
                $id,
                $tenantId,
                $pTitle,
                $type,
                $data['clientName'] ?? $data['client'] ?? '',
                json_encode($meta),
                $status,
                $now,
                $now,
                $this->currentUserId,
                $data['assigned_to'] ?? $this->currentUserId, // Default assign to creator
                $data['grossProfitTarget'] ?? $data['gross_profit_target'] ?? 0
            ]);
            $this->show($id);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }

    private function update($id) {
        $stmt = $this->pdo->prepare("SELECT * FROM items WHERE id = ?");
        $stmt->execute([$id]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            $this->sendError(404, 'Project not found');
        }

        // Auth Logic
        $itemTenantId = (string)($item['tenant_id'] ?? '');
        if ($itemTenantId !== '') {
            if (!in_array($itemTenantId, $this->joinedTenants)) {
                $this->sendError(403, 'Access Denied');
            }
        } elseif ($item['created_by'] != (string)$this->currentUserId && ($item['assigned_to'] ?? '') != (string)$this->currentUserId) {
            $this->sendError(403, 'Access Denied (created_by=' . $item['created_by'] . ', assigned_to=' . ($item['assigned_to'] ?? 'NULL') . ', currentUserId=' . $this->currentUserId . ')');
        }

        $data = $this->getInput();
        
        // Handle Meta Merge if needed
        if (isset($data['settings']) || isset($data['dxf_config']) || isset($data['view_mode']) || isset($data['color'])) {
            $meta = json_decode($item['meta'] ?? '{}', true);
            if (isset($data['settings'])) $meta['settings'] = $data['settings'];
            if (isset($data['dxf_config'])) $meta['dxf_config'] = $data['dxf_config'];
            if (isset($data['view_mode'])) $meta['view_mode'] = $data['view_mode'];
            if (isset($data['color'])) $meta['color'] = $data['color'];
            $data['meta'] = $meta;
        }

        $allowedFields = [
            'title', 'client_name', 'gross_profit_target', 'status', 'meta', 'project_type'
        ];
        
        // Map alias keys for updateEntity to find in $data
        if (isset($data['judgment_status'])) $data['status'] = $data['judgment_status'];
        if (isset($data['clientName'])) $data['client_name'] = $data['clientName'];
        elseif (isset($data['client'])) $data['client_name'] = $data['client'];
        
        $this->updateEntity('items', $id, $allowedFields);
        $this->show($id);
    }

    private function delete($id) {
        // Access Check
        $tenantIds = $this->joinedTenants;
        if (empty($tenantIds)) $tenantIds = [$this->currentTenantId];
        
        $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
        $sql = "SELECT * FROM items WHERE id = ? AND (tenant_id IN ($placeholders) OR (tenant_id IS NULL AND created_by = ?))";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(array_merge([$id], $tenantIds, [$this->currentUserId]));
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            $this->sendError(404, 'Project not found or denied');
        }

        // Delete project item (cascade depends on DB, but usually we just delete the row)
        $stmt = $this->pdo->prepare("DELETE FROM items WHERE id = ?");
        $stmt->execute([$id]);
        
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
            'tenantId' => $item['tenant_id'], // [FIX] Added for Frontend compatibility
            'name' => $item['title'], // Map title -> name (Legacy compatibility)
            'title' => $item['title'], // [FIX] Added for Frontend Item type compatibility
            'client' => $item['client_name'] ?? $item['client'] ?? '',
            'clientName' => $item['client_name'] ?? $item['client'] ?? '', // [FIX] Added
            'settings_json' => json_encode($meta['settings'] ?? []),
            'dxf_config_json' => json_encode($meta['dxf_config'] ?? []),
            'view_mode' => $meta['view_mode'] ?? 'internal',
            'judgment_status' => $item['status'], // Map status
            'is_archived' => ($item['status'] === 'archive'),
            'grossProfitTarget' => (int)($item['gross_profit_target'] ?? $meta['gross_profit_target'] ?? 0),
            'color' => $meta['color'] ?? 'blue',
            'assigned_to' => $item['assigned_to'] ?? null,
            'assignedTo' => $item['assigned_to'] ?? null, // [FIX] Added
            'created_at' => $item['created_at'], 
            'updated_at' => $item['updated_at'],
            'isProject' => (bool)($item['is_project'] ?? true), // [FIX] Added for Frontend compatibility
            'parentId' => $item['parent_id'] ?? null, // [FIX] Include hierarchy info
            'projectId' => $item['project_id'] ?? null, // [FIX] Include project context info
            'type' => $item['project_type'] // Exposed
        ];
    }
}
