<?php
// backend/ItemController.php
require_once 'BaseController.php';
require_once 'ManufacturingSyncService.php';

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
            } elseif (isset($_GET['parent_id'])) {
                // Subtask Retrieval
                $this->getSubTasks($_GET['parent_id']);
            } else {
                // Personal Scope (Inbox / My Tasks)
                $this->getMyItems();
            }
        } elseif ($method === 'POST') {
             // [JBWOS] Special Action: Reorder Focus
             if (isset($_GET['action']) && $_GET['action'] === 'reorder_focus') {
                 $this->reorderFocus();
             } else {
                 $this->create();
             }
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
        // Prioritize project_id title, fallback to parent_title (legacy)
        $item['projectTitle'] = $item['real_project_title'] ?? $item['parent_title'] ?? null;
        $item['projectType'] = $item['project_type'] ?? null;

        // [JBWOS] Judgment Columns
        $item['focusOrder'] = (int)($item['focus_order'] ?? 0);
        $item['isIntent'] = (bool)($item['is_intent'] ?? 0);
        $item['dueStatus'] = $item['due_status'] ?? null;

        // [New Project Context]
        $item['clientName'] = $item['client_name'] ?? $item['client'] ?? null; 
        $item['siteName'] = $item['site_name'] ?? $item['site'] ?? null;
        $item['grossProfitTarget'] = (int)($item['gross_profit_target'] ?? 0);
        
        // [Assignee Information]
        $item['assigneeName'] = $item['assignee_name'] ?? null;
        $item['assigneeColor'] = $item['assignee_color'] ?? null;

        if (!empty($item['delegation']) && is_string($item['delegation'])) {
            $item['delegation'] = json_decode($item['delegation'], true);
        }
        return $item;
    }

    // GET /api/items (Inbox / My Tasks)
    // Returns items that are NOT assigned to any project (Private Inbox)
    // OR items explicitly assigned to me (even if in project - though UI might filter)
    private function getMyItems() {
        // [New] Aggregated Mode for Life-Work Integration
        $scope = $_GET['scope'] ?? '';
        
        if ($scope === 'aggregated' && !empty($this->joinedTenants)) {
             // Fetch Personal Items + Company Items (Assigned/Created by me)
             $placeholders = implode(',', array_fill(0, count($this->joinedTenants), '?'));
             
             // Note: We need tenant name for UI badges
             $sql = "
                SELECT items.*, parent.title as parent_title, t.name as tenant_name
                FROM items
                LEFT JOIN items parent ON items.parent_id = parent.id
                LEFT JOIN tenants t ON items.tenant_id = t.id
                WHERE items.tenant_id IN ($placeholders)
                AND (
                    -- Personal Tenant's items: ALL visible (Owner/Personal)
                    -- Assuming 'Personal' tenant type logic or just relying on membership.
                    -- Actually, logic is:
                    -- 1. If map to my Personal Tenant -> All.
                    -- 2. If map to Company Tenant -> Only Assigned OR CreatedBy.
                    -- HOWEVER, for simplicity in SQL:
                    -- If user is OWNER of tenant (Personal), they likely see everything in Inbox?
                    -- But in Company, Owner sees everything? Maybe too much noise.
                    -- Let's stick to Haruki Model:
                    -- 'My Items' = Items I need to worry about.
                    --   1. Items in my Personal Tenant (Everything).
                    --   2. Items in Company Tenant assigned to me OR created by me (and not in project?).
                    --      Actually, `getMyItems` usually filters out Project items unless it's 'Inbox'.
                    
                    -- Current getMyItems logic:
                    (items.project_id IS NULL AND items.created_by = ?) -- Private/Inbox Items
                    OR items.assigned_to = ? -- Explicitly assigned to me (Project or not)
                )
                ORDER BY items.updated_at DESC
             ";
             
             // Params: [...tenant_ids, userId, userId]
             $params = array_merge($this->joinedTenants, [$this->currentUserId, $this->currentUserId]);
             
             $stmt = $this->pdo->prepare($sql);
             $stmt->execute($params);
             $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
             
             // Inject tenant_name into mapRow or just pass it
             $this->sendJSON(array_map(function($row) {
                 $item = $this->mapRow($row);
                 $item['tenantName'] = $row['tenant_name'];
                 $item['tenantId'] = $row['tenant_id']; // Ensure camelCase in mapRow? mapRow doesn't touch keys it doesn't know.
                 return $item;
             }, $items));
             
        } elseif ($scope === 'dashboard') {
            // Dashboard Scope: Aggregated Personal + Company Items (Life-Work Integration)
            // Strategy: Search in ALL joined tenants + Personal Space
            
            $tenantIds = $this->joinedTenants ?: []; 
            // Ensure current tenant is included if set (for safety against memberships/tenant_members sync issues)
            if (!empty($this->currentTenantId) && !in_array($this->currentTenantId, $tenantIds)) {
                $tenantIds[] = $this->currentTenantId;
            }
            
             // We must always allow searching in 'Personal' (NULL/'')
            
            $placeholders = '';
            if (!empty($tenantIds)) {
                $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
            }
            
            $sql = "
                SELECT items.*, parent.title as parent_title, t.name as tenant_name,
                       a.name as assignee_name, a.color as assignee_color
                FROM items
                LEFT JOIN items parent ON items.parent_id = parent.id
                LEFT JOIN tenants t ON items.tenant_id = t.id
                LEFT JOIN assignees a ON items.assigned_to = a.id
                WHERE (items.project_type IS NULL OR items.project_type = '')
                AND (
                    -- 1. Personal Items (Private context)
                    ((items.tenant_id IS NULL OR items.tenant_id = '') AND (items.created_by = ? OR items.assigned_to = ?))
                    
                    OR
                    
                    -- 2. Company Items (Team context)
                    (
                        " . ($placeholders ? "items.tenant_id IN ($placeholders)" : "0") . "
                        AND (
                            -- Strictly ONLY items assigned to me OR created by me for the unified dashboard
                            items.assigned_to = ? OR items.created_by = ?
                        )
                    )
                )
                ORDER BY items.updated_at DESC
            ";

            $params = array_merge([$this->currentUserId, $this->currentUserId], $tenantIds, [$this->currentUserId, $this->currentUserId]);

            // [NEW] Project Filtering for Dashboard/Aggregate focus
            $projectId = $_GET['project_id'] ?? null;
            if ($projectId) {
                // If projectId is provided, wrap the current SQL or append AND
                // Simplest is to wrap? No, let's just append AND to the SQL before ORDER BY
                $sql = str_replace("ORDER BY", "AND items.project_id = ? ORDER BY", $sql);
                $params[] = $projectId;
            }

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
             
             $this->sendJSON(array_map(function($row) {
                 $item = $this->mapRow($row);
                 $item['tenantName'] = $row['tenant_name'];
                 $item['tenantId'] = $row['tenant_id']; 
                 return $item;
             }, $items));

        } else {
            // Legacy (Single Tenant Mode)
            // [Security Rule] Inbox = Private. Only I can see items with NO project_id created by me.
            // Also include items assigned to me.
            $sql = "
                SELECT items.*, parent.title as parent_title, proj.title as real_project_title
                FROM items
                LEFT JOIN items parent ON items.parent_id = parent.id
                LEFT JOIN items proj ON items.project_id = proj.id
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
    }

    // GET /api/items?project_id=XXX
    // Returns items belonging to a specific project (Shared Scope)
    private function getProjectItems($projectId) {
        // [Security Rule] Project = Shared (Tenant Public for now).
        // Verify project existence and tenant context first.
        
        // TODO: Future - Check user membership in project
        
        $sql = "
            SELECT items.*, parent.title as parent_title, proj.title as real_project_title,
                   a.name as assignee_name, a.color as assignee_color
            FROM items
            LEFT JOIN items parent ON items.parent_id = parent.id
            LEFT JOIN items proj ON items.project_id = proj.id
            LEFT JOIN assignees a ON items.assigned_to = a.id
            WHERE items.tenant_id = ? 
            AND (items.project_id = ? OR items.parent_id = ?)
            ORDER BY items.updated_at DESC
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$this->currentTenantId, $projectId, $projectId]);
        
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $this->sendJSON(array_map([$this, 'mapRow'], $items));
    }

    // GET /api/items?parent_id=XXX
    // Returns direct sub-tasks of an item
    private function getSubTasks($parentId) {
        // [Security Rule] Basic Tenant Isolation
        $sql = "
            SELECT items.*
            FROM items
            WHERE items.tenant_id = ? 
            AND items.parent_id = ?
            ORDER BY items.created_at ASC
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$this->currentTenantId, $parentId]);
        
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
            SELECT items.*, parent.title as parent_title, proj.title as real_project_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            LEFT JOIN items proj ON items.project_id = proj.id
            WHERE items.id = ? AND items.tenant_id = ? 
            AND (
                items.project_id IS NOT NULL -- Public Project Item
                OR items.created_by = ?          -- My Item
                OR items.assigned_to = ?         -- Assigned to Me
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

        $id = $data['id'] ?? uniqid('item_', false); // Avoid dots in ID for routing safety
        $now = time();
        $delegationJson = isset($data['delegation']) ? json_encode($data['delegation']) : null;
        
        // Unified Schema Fields
        $projectType = $data['projectType'] ?? null;
        
        // Backward Compatibility
        $isProject = ($data['isProject'] ?? false) ? 1 : 0;
        if ($projectType) {
            $isProject = 1;
        }

        // [NEW] Inherit parent due_date if parentId is provided
        $dueDate = $data['due_date'] ?? null;
        $parentId = $data['parentId'] ?? null;
        if ($parentId && !$dueDate) {
            // Fetch parent's due_date (no tenant filter - parent_id is sufficient)
            $parentStmt = $this->pdo->prepare("SELECT due_date FROM items WHERE id = ?");
            $parentStmt->execute([$parentId]);
            $parent = $parentStmt->fetch(PDO::FETCH_ASSOC);
            if ($parent && !empty($parent['due_date'])) {
                $dueDate = $parent['due_date'];
            }
        }

        // [Security Rule] Assign owner and tenant
        $stmt = $this->pdo->prepare("
            INSERT INTO items (
                id, tenant_id, title, status, created_at, updated_at, status_updated_at,
                parent_id, is_project, project_category, estimated_minutes, assigned_to, delegation,
                project_id, created_by, project_type, due_date, client_name, site_name, gross_profit_target
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?
            )
        ");
        
        try {
            $effectiveTenantId = null; // Default to Private
            if ($parentId) {
                $parentStmt = $this->pdo->prepare("SELECT tenant_id FROM items WHERE id = ?");
                $parentStmt->execute([$parentId]);
                $parent = $parentStmt->fetch(PDO::FETCH_ASSOC);
                if ($parent) {
                    $effectiveTenantId = $parent['tenant_id']; // Inherit from parent
                }
            } else if (isset($data['tenantId'])) {
                $effectiveTenantId = $data['tenantId'];
            }

            $stmt->execute([
                $id,
                $effectiveTenantId, // Use inherited tenant_id
                $data['title'],
                $data['status'] ?? 'inbox',
                $now, $now, $now,
                $parentId,
                $isProject,
                $data['projectCategory'] ?? null,
                $data['estimatedMinutes'] ?? 0,
                $data['assignedTo'] ?? null,
                $delegationJson,
                $data['projectId'] ?? null, // Link to project if provided
                $this->currentUserId,
                $projectType,
                $dueDate,
                $data['clientName'] ?? $data['client'] ?? null,
                $data['siteName'] ?? $data['site'] ?? null,
                $data['grossProfitTarget'] ?? 0
            ]);
            
            if ($parentId) {
                $this->pdo->prepare("UPDATE items SET is_project = 1 WHERE id = ?")
                    ->execute([$parentId]);
            }
            
            // [v23] Sync Manufacturing Data
            ManufacturingSyncService::syncItem($this->pdo, $id, $data);
            
            $this->sendJSON(['id' => $id, 'success' => true]);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }

    }

    private function update($id) {
        // [Security Rule] Multi-Tenant Support
        // Allow updates to items in ANY tenant the user belongs to (e.g. Personal or Company),
        // not just the currently active context.
        $tenantIds = $this->joinedTenants;
        if (empty($tenantIds)) $tenantIds = [$this->currentTenantId];
        if (!in_array($this->currentTenantId, $tenantIds)) $tenantIds[] = $this->currentTenantId;

        $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
        
        // Fetch item's actual tenant_id
        $check = $this->pdo->prepare("SELECT project_id, created_by, tenant_id FROM items WHERE id = ? AND (tenant_id IN ($placeholders) OR tenant_id IS NULL)");
        $check->execute(array_merge([$id], $tenantIds));
        $existing = $check->fetch(PDO::FETCH_ASSOC);

        
        if (!$existing) {
             $this->sendError(404, 'Item not found');
        }
        
        // [Security Rule] Edit Permission
        // Allow if: Project Item (Shared) OR My Item OR Admin
        $isAdmin = ($this->currentUser['role'] ?? '') === 'admin';

        // Ideally: Project Items should only be editable by members, but for now Tenant Public.
        // However, Private Items (project_id IS NULL) MUST be created_by me unless Admin.
        if (!$isAdmin && is_null($existing['project_id']) && $existing['created_by'] != (string)$this->currentUserId) {
            $this->sendError(403, 'Access Denied: Cannot edit private item of another user');
        }

        $data = $this->getInput();
        $fields = [];
        $params = [];
        
        $simpleFields = [
            'title', 'status', 'memo', 'due_date', // Removed 'due_status'
            'is_boosted', 'boosted_date', 'prep_date', 'parent_id', 'is_project',
            'project_category', 'estimated_minutes', 'assigned_to', 'project_id',
            'project_type', 'client_name', 'gross_profit_target', 'tenant_id'
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
            if ($f === 'project_type') $inputKey = 'projectType';
            if ($f === 'client_name') $inputKey = 'clientName';
            if ($f === 'gross_profit_target') $inputKey = 'grossProfitTarget';
            if ($f === 'tenant_id') $inputKey = 'tenantId';

            if (array_key_exists($inputKey, $data)) {
                $val = $data[$inputKey];
                if (is_bool($val)) $val = $val ? 1 : 0;
                // Special handling for meta array -> string
                if ($f === 'meta' && is_array($val)) $val = json_encode($val);
                
                $fields[] = "$f = ?";
                $params[] = $val;
            } else if (array_key_exists($f, $data)) {
                 // Try straight key
                $val = $data[$f];
                if (is_bool($val)) $val = $val ? 1 : 0;
                if ($f === 'meta' && is_array($val)) $val = json_encode($val);
                $fields[] = "$f = ?";
                $params[] = $val;
            }
        }
        
        if (isset($data['status'])) {
             $fields[] = "status_updated_at = ?";
             $params[] = time();
             
             // [JBWOS] Reset Intent if task is moved out of 'focus' or completed
             if ($data['status'] === 'done') {
                $fields[] = "is_intent = ?";
                $params[] = 0;
             }
        }
        
        // [JBWOS] Handle new Judgment Columns explicitly
        $judgmentFields = ['focus_order' => 'focusOrder', 'is_intent' => 'isIntent', 'due_status' => 'dueStatus'];
        foreach ($judgmentFields as $dbCol => $apiCol) {
            if (array_key_exists($apiCol, $data)) {
                $val = $data[$apiCol];
                // Boolean conversion for intent
                if ($dbCol === 'is_intent') $val = $val ? 1 : 0;
                
                $fields[] = "$dbCol = ?";
                $params[] = $val;
            }
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
        $params[] = $existing['tenant_id'];
        $params[] = $existing['tenant_id']; // For NULL-safe check

        $sql = "UPDATE items SET " . implode(', ', $fields) . " WHERE id = ? AND (tenant_id = ? OR (tenant_id IS NULL AND ? IS NULL))";
        
        try {
            $this->pdo->prepare($sql)->execute($params);
            
            // [v23] Sync Manufacturing Data
            ManufacturingSyncService::syncItem($this->pdo, $id, $data);
            
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }
    }
    
    private function delete($id) {
        // Verify ownership (Same rule as update)
        $tenantIds = $this->joinedTenants;
        if (empty($tenantIds)) $tenantIds = [$this->currentTenantId];

        $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));

        $check = $this->pdo->prepare("SELECT project_id, created_by, tenant_id FROM items WHERE id = ? AND (tenant_id IN ($placeholders) OR tenant_id IS NULL OR tenant_id = '')");
        $check->execute(array_merge([$id], $tenantIds));
        $existing = $check->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
             $this->sendError(404, 'Item not found');
        }

        // Allow if: Project Item (Shared within Tenant) OR My Item OR Admin
        $isAdmin = ($this->currentUser['role'] ?? '') === 'admin';
        $itemTenantId = (string)($existing['tenant_id'] ?? '');

        if (!$isAdmin) {
            if ($itemTenantId !== '') {
                // Shared item within organization. 
                // For now, allow any member of that organization to delete shared project items? 
                // Or restrict to creator? User asked to allow deletion from dashboard.
                // Let's allow if they are in the tenant and it's a project-related item.
                if (!in_array($itemTenantId, $this->joinedTenants)) {
                    $this->sendError(403, 'Access Denied: Organization mismatch');
                }
            } else {
                // Personal/Private item
                if ($existing['created_by'] !== $this->currentUserId) {
                     $this->sendError(403, 'Access Denied: Personal item ownership mismatch');
                }
            }
        }

        $stmt = $this->pdo->prepare("DELETE FROM items WHERE id = ?");
        $stmt->execute([$id]);
        $this->sendJSON(['success' => true]);
    }
    
    private function toCamel($snake) {
        return lcfirst(str_replace(' ', '', ucwords(str_replace('_', ' ', $snake))));
    }

    // [JBWOS] Bulk Reorder Logic
    private function reorderFocus() {
        $data = $this->getInput();
        // Expecting: { items: [ { id: 'xxx', order: 1 }, ... ] }
        if (empty($data['items']) || !is_array($data['items'])) {
            $this->sendError(400, 'Invalid items data');
        }

        try {
            $this->pdo->beginTransaction();

            $sql = "UPDATE items SET focus_order = ? WHERE id = ? AND tenant_id = ?";
            $stmt = $this->pdo->prepare($sql);

            foreach ($data['items'] as $item) {
                if (isset($item['id'], $item['order'])) {
                     $stmt->execute([
                         (int)$item['order'], 
                         $item['id'], 
                         $this->currentTenantId // Strictly scoped to current tenant
                     ]);
                }
            }

            $this->pdo->commit();
            $this->sendJSON(['success' => true]);

        } catch (PDOException $e) {
            $this->pdo->rollBack();
            $this->sendError(500, 'Reorder Failed: ' . $e->getMessage());
        }
    }
}

