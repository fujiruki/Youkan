<?php
// backend/ItemController.php
require_once 'BaseController.php';

class ItemController extends BaseController {

    public function handleRequest($method, $id = null) {
        $this->authenticate(); // Enforce Auth

        if ($method === 'GET') {
            // Distinguish between "My Inbox" and "Project Items"
            $projectId = $_GET['project_id'] ?? null;
            $type = $_GET['type'] ?? 'all'; // 'inbox', 'project', 'all' (legacy)

            if ($id) {
                // Single item retrieval - requires permission check
                $this->show($id);
            } elseif ($projectId) {
                // Project Scope (Shared)
                $this->getProjectItems($projectId);
            } else {
                // Personal Scope (Inbox / My Tasks)
                $this->getMyItems();
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

    private function mapRow($item) {
        $item['interrupt'] = (bool)$item['interrupt'];
        $item['is_boosted'] = (bool)($item['is_boosted'] ?? 0);
        $item['parentId'] = $item['parent_id'] ?? null;
        $item['isProject'] = (bool)($item['is_project'] ?? 0);
        $item['projectCategory'] = $item['project_category'] ?? null;
        $item['estimatedMinutes'] = (int)($item['estimated_minutes'] ?? 0);
        $item['assignedTo'] = $item['assigned_to'] ?? null;
        $item['projectTitle'] = $item['parent_title'] ?? null;
        
        if (!empty($item['delegation']) && is_string($item['delegation'])) {
            $item['delegation'] = json_decode($item['delegation'], true);
        }
        return $item;
    }

    // GET /api/items (Inbox / My Tasks)
    // Returns items that are NOT assigned to any project (Private Inbox)
    // OR items explicitly assigned to me (even if in project - though UI might filter)
    private function getMyItems() {
        // [Security Rule] Inbox = Private. Only I can see items with NO project_id created by me.
        // Also include items assigned to me.
        $sql = "
            SELECT items.*, parent.title as parent_title
            FROM items
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE items.tenant_id = ? 
            AND (
                (items.project_id IS NULL AND items.created_by = ?) -- Private Inbox
                OR items.assigned_to = ? -- Explicitly assigned to me
                OR items.created_by = ? -- Created by me
            )
            ORDER BY items.updated_at DESC
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            $this->currentTenantId, 
            $this->currentUserId, 
            $this->currentUserId,
            $this->currentUserId
        ]);
        
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $this->sendJSON(array_map([$this, 'mapRow'], $items));
    }

    // GET /api/items?project_id=XXX
    // Returns items belonging to a specific project (Shared Scope)
    private function getProjectItems($projectId) {
        // [Security Rule] Project = Shared (Tenant Public for now).
        // Verify project existence and tenant context first.
        
        // TODO: Future - Check user membership in project
        
        $sql = "
            SELECT items.*, parent.title as parent_title
            FROM items
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE items.tenant_id = ? 
            AND items.project_id = ?
            ORDER BY items.updated_at DESC
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$this->currentTenantId, $projectId]);
        
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $this->sendJSON(array_map([$this, 'mapRow'], $items));
    }

    // GET /api/users/{userId}/capacity
    // Returns anonymized capacity data (time/duration only) for a specific user.
    // Allowed for any authenticated user in the same tenant (Manager view).
    public function getCapacity($userId) {
        // 1. Verify target user exists in same tenant
        // (Optional check, but good for security)
        
        // 2. Fetch items assigned to user OR created by user (if private)
        // Actually, we only care about "Active" items that consume time.
        // And strictly filtered by tenant.
        
        $sql = "
            SELECT 
                id, 
                due_date, 
                estimated_minutes, 
                status,
                is_project,
                project_id,
                'busy' as title -- Obfuscate title
            FROM items
            WHERE tenant_id = ? 
            AND (assigned_to = ? OR (assigned_to IS NULL AND created_by = ?))
            AND status != 'done' -- Only active items
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$this->currentTenantId, $userId, $userId]);
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Map to frontend expected format, but keep it minimal
        $result = array_map(function($row) {
             return [
                 'id' => $row['id'],
                 'dueDate' => $row['due_date'],
                 'estimatedMinutes' => (int)$row['estimated_minutes'],
                 'isProject' => (bool)$row['is_project'],
                 'isPrivate' => is_null($row['project_id']), // Flag to show 'Private' color
                 'title' => '予定あり' // Localized 'Busy'
             ];
        }, $items);
        
        $this->sendJSON($result);
    }

    private function show($id) {
        // [Security Rule] Check visibility
        $sql = "
            SELECT * FROM items 
            WHERE id = ? AND tenant_id = ? 
            AND (
                project_id IS NOT NULL -- Public Project Item
                OR created_by = ?          -- My Item
                OR assigned_to = ?         -- Assigned to Me
            )
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$id, $this->currentTenantId, $this->currentUserId, $this->currentUserId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            $this->sendError(404, 'Item not found or access denied');
        }
        $this->sendJSON($this->mapRow($item));
    }

    private function create() {
        $data = $this->getInput();
        if (empty($data['title'])) {
            $this->sendError(400, 'Title is required');
        }

        $id = $data['id'] ?? uniqid('item_', true);
        $now = time();
        $delegationJson = isset($data['delegation']) ? json_encode($data['delegation']) : null;
        
        // [Security Rule] Assign owner and tenant
        $stmt = $this->pdo->prepare("
            INSERT INTO items (
                id, tenant_id, title, status, created_at, updated_at, status_updated_at,
                parent_id, is_project, project_category, estimated_minutes, assigned_to, delegation,
                project_id, created_by
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?
            )
        ");
        
        try {
            $stmt->execute([
                $id,
                $this->currentTenantId,
                $data['title'],
                $data['status'] ?? 'inbox',
                $now, $now, $now,
                $data['parentId'] ?? null,
                ($data['isProject'] ?? false) ? 1 : 0,
                $data['projectCategory'] ?? null,
                $data['estimatedMinutes'] ?? 0,
                $data['assignedTo'] ?? null,
                $delegationJson,
                $data['projectId'] ?? null, // Link to project if provided
                $this->currentUserId // Creator
            ]);
            
            $this->sendJSON(['id' => $id, 'success' => true]);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }

    private function update($id) {
        // Verify ownership/permission FIRST
        $check = $this->pdo->prepare("SELECT project_id, created_by FROM items WHERE id = ? AND tenant_id = ?");
        $check->execute([$id, $this->currentTenantId]);
        $existing = $check->fetch(PDO::FETCH_ASSOC);
        
        if (!$existing) {
             $this->sendError(404, 'Item not found');
        }
        
        // [Security Rule] Edit Permission
        // Allow if: Project Item (Shared) OR My Item
        // Ideally: Project Items should only be editable by members, but for now Tenant Public.
        // However, Private Items (project_id IS NULL) MUST be created_by me.
        if (is_null($existing['project_id']) && $existing['created_by'] !== $this->currentUserId) {
            $this->sendError(403, 'Access Denied: Cannot edit private item of another user');
        }

        $data = $this->getInput();
        $fields = [];
        $params = [];
        
        $simpleFields = [
            'title', 'status', 'memo', 'due_date', 'due_status', 
            'is_boosted', 'boosted_date', 'prep_date', 'parent_id', 'is_project',
            'project_category', 'estimated_minutes', 'assigned_to', 'project_id'
        ];

        foreach ($simpleFields as $f) {
            // Retrieve camelCase from input if exists, else snake_case
            $inputKey = $this->toCamel($f); // e.g. estimated_minutes -> estimatedMinutes
            // Hand-mapping for specific keys that might differ or simple logic
            if ($f === 'parent_id') $inputKey = 'parentId';
            if ($f === 'is_project') $inputKey = 'isProject';
            if ($f === 'project_category') $inputKey = 'projectCategory';
            if ($f === 'estimated_minutes') $inputKey = 'estimatedMinutes';
            if ($f === 'assigned_to') $inputKey = 'assignedTo';
            if ($f === 'project_id') $inputKey = 'projectId';

            if (array_key_exists($inputKey, $data)) {
                $val = $data[$inputKey];
                if (is_bool($val)) $val = $val ? 1 : 0;
                $fields[] = "$f = ?";
                $params[] = $val;
            } else if (array_key_exists($f, $data)) {
                 // Try straight key
                $val = $data[$f];
                if (is_bool($val)) $val = $val ? 1 : 0;
                $fields[] = "$f = ?";
                $params[] = $val;
            }
        }
        
        if (isset($data['status'])) {
             $fields[] = "status_updated_at = ?";
             $params[] = time();
        }

        if (array_key_exists('delegation', $data)) {
            $fields[] = "delegation = ?";
            $params[] = isset($data['delegation']) ? json_encode($data['delegation']) : null;
        }

        if (empty($fields)) {
            $this->sendJSON(['success' => true, 'changed' => false]);
            return;
        }

        $fields[] = "updated_at = ?";
        $params[] = time();

        $params[] = $id;
        $params[] = $this->currentTenantId; // Double check tenant in WHERE

        $sql = "UPDATE items SET " . implode(', ', $fields) . " WHERE id = ? AND tenant_id = ?";
        
        try {
            $this->pdo->prepare($sql)->execute($params);
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }
    
    private function delete($id) {
         // Verify ownership (Same rule as update)
        $check = $this->pdo->prepare("SELECT project_id, created_by FROM items WHERE id = ? AND tenant_id = ?");
        $check->execute([$id, $this->currentTenantId]);
        $existing = $check->fetch(PDO::FETCH_ASSOC);

        if ($existing && is_null($existing['project_id']) && $existing['created_by'] !== $this->currentUserId) {
             $this->sendError(403, 'Access Denied');
        }

        $stmt = $this->pdo->prepare("DELETE FROM items WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);
        $this->sendJSON(['success' => true]);
    }
    
    private function toCamel($snake) {
        return lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $snake))));
    }
}

