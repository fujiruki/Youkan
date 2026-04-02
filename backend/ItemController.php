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
            $isRefresh = isset($_GET['refresh']) || isset($_GET['isRefresh']); // [NEW] Support refresh flag

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
        } elseif (($method === 'PUT' || $method === 'PATCH') && $id) {
            $this->update($id);
        } elseif ($method === 'DELETE' && $id) {
            $this->delete($id);
        } else {
            $this->sendError(405, 'Method Not Allowed');
        }
    }

    // GET /api/items (Inbox / My Tasks)
    // Returns items that are NOT assigned to any project (Private Inbox)
    // OR items explicitly assigned to me (even if in project - though UI might filter)
    private function getMyItems() {
        // [New] Aggregated Mode for Life-Work Integration
        $scope = $_GET['scope'] ?? '';
        
        // --- Filter Logic ---
        // Default: Active only (not archived, not deleted)
        // ?show_archived=1: Show ONLY archived (history)
        // ?show_trash=1: Show ONLY trash
        $filterClause = " AND items.is_archived = 0 AND items.deleted_at IS NULL ";
        
        if (isset($_GET['show_trash']) && $_GET['show_trash'] == 1) {
            $filterClause = " AND items.deleted_at IS NOT NULL ";
        } elseif (isset($_GET['show_archived']) && $_GET['show_archived'] == 1) {
            $filterClause = " AND items.is_archived = 1 AND items.deleted_at IS NULL ";
        }

        if ($scope === 'aggregated') {
             // Fetch Personal Items + Company Items (Aggregated View)
             $tenantIds = $this->joinedTenants ?: [];
             $placeholders = '0'; // Default to "tenant_id IN (0)" which is false safely
             if (!empty($tenantIds)) {
                 $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
             }
             
             // [FIX 2026-02-04] Context-based Visibility for ProjectFocused Mode
             $projectId = $_GET['project_id'] ?? null;
             
             // Base params for tenant filter
             $params = $tenantIds;
             
             if ($projectId) {
                 // [CORE FIX] ProjectFocused Mode:
                 $descendants = $this->getProjectDescendantIds($projectId);
                 $pPlaceholders = implode(',', array_fill(0, count($descendants), '?'));

                 $sql = "
                    SELECT items.*, parent.title as parent_title, proj.title as real_project_title, t.name as tenant_name
                    FROM items
                    LEFT JOIN items parent ON items.parent_id = parent.id
                    LEFT JOIN items proj ON items.project_id = proj.id
                    LEFT JOIN tenants t ON items.tenant_id = t.id
                    WHERE (items.tenant_id IN ($placeholders) OR items.tenant_id IS NULL OR items.tenant_id = '')
                    AND (
                        (items.created_by = ? OR items.assigned_to = ?)
                        OR
                        items.project_id IN ($pPlaceholders)
                    )
                    $filterClause
                    ORDER BY items.updated_at DESC
                 ";
                 $params = array_merge($params, [$this->currentUserId, $this->currentUserId], $descendants);
             } else {
                 $sql = "
                    SELECT items.*, parent.title as parent_title, proj.title as real_project_title, t.name as tenant_name
                    FROM items
                    LEFT JOIN items parent ON items.parent_id = parent.id
                    LEFT JOIN items proj ON items.project_id = proj.id
                    LEFT JOIN tenants t ON items.tenant_id = t.id
                    WHERE (items.tenant_id IN ($placeholders) OR items.tenant_id IS NULL OR items.tenant_id = '')
                    AND (
                        items.created_by = ?
                        OR items.assigned_to = ?
                    )
                    $filterClause
                    ORDER BY items.updated_at DESC
                 ";
                 $params = array_merge($params, [$this->currentUserId, $this->currentUserId]);
             }
             
             $stmt = $this->pdo->prepare($sql);
             $stmt->execute($params);
             $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
             
             $this->sendJSON(array_map(function($row) {
                 $item = $this->mapItemRow($row);
                 $item['tenantName'] = $row['tenant_name'];
                 $item['tenantId'] = $row['tenant_id'];
                 return $item;
             }, $items));
             
        } elseif ($scope === 'personal') {
             // Fetch strictly Personal Items (tenant_id IS NULL)
             $sql = "
                 SELECT items.*, parent.title as parent_title, proj.title as real_project_title, t.name as tenant_name,
                        a.name as assignee_name, a.color as assignee_color
                 FROM items
                 LEFT JOIN items parent ON items.parent_id = parent.id
                 LEFT JOIN items proj ON items.project_id = proj.id
                 LEFT JOIN tenants t ON items.tenant_id = t.id
                 LEFT JOIN assignees a ON items.assigned_to = a.id
                 WHERE (items.tenant_id IS NULL OR items.tenant_id = '')
                 AND (items.created_by = ? OR items.assigned_to = ?)
                 $filterClause
                 ORDER BY items.updated_at DESC
             ";
             $stmt = $this->pdo->prepare($sql);
             $stmt->execute([$this->currentUserId, $this->currentUserId]);
             $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
             
             $this->sendJSON(array_map(function($row) {
                 $item = $this->mapItemRow($row);
                 $item['tenantId'] = null; // Enforce explicit null
                 return $item;
             }, $items));
             
        } elseif ($scope === 'company') {
             // Fetch strictly Company Items
             $tenantIds = $this->joinedTenants ?: []; 
             if (!empty($this->currentTenantId) && !in_array($this->currentTenantId, $tenantIds)) {
                 $tenantIds[] = $this->currentTenantId;
             }
             
             if (empty($tenantIds)) {
                 $this->sendJSON([]); // No company means no company items
                 return;
             }
             
             $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
             
             $sql = "
                 SELECT items.*, parent.title as parent_title, proj.title as real_project_title, t.name as tenant_name,
                        a.name as assignee_name, a.color as assignee_color
                 FROM items
                 LEFT JOIN items parent ON items.parent_id = parent.id
                 LEFT JOIN items proj ON items.project_id = proj.id
                 LEFT JOIN tenants t ON items.tenant_id = t.id
                 LEFT JOIN assignees a ON items.assigned_to = a.id
                 WHERE items.tenant_id IN ($placeholders)
                 AND (items.assigned_to = ? OR items.created_by = ?)
                 $filterClause
                 ORDER BY items.updated_at DESC
             ";
             $stmt = $this->pdo->prepare($sql);
             $stmt->execute(array_merge($tenantIds, [$this->currentUserId, $this->currentUserId]));
             $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
             
             $this->sendJSON(array_map(function($row) {
                 $item = $this->mapItemRow($row);
                 $item['tenantName'] = $row['tenant_name'];
                 $item['tenantId'] = $row['tenant_id'];
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
            
            // [FIX] Project Filtering - use variable instead of str_replace
            $projectId = $_GET['project_id'] ?? null;
            $projectFilter = "";
            if ($projectId) {
                $projectFilter = " AND items.project_id = ? ";
            }

            
            $sql = "
                SELECT items.*, parent.title as parent_title, proj.title as real_project_title, t.name as tenant_name,
                       a.name as assignee_name, a.color as assignee_color
                FROM items
                LEFT JOIN items parent ON items.parent_id = parent.id
                LEFT JOIN items proj ON items.project_id = proj.id -- [FIX] Join Project to get real_project_title
                LEFT JOIN tenants t ON items.tenant_id = t.id
                LEFT JOIN assignees a ON items.assigned_to = a.id
                WHERE (items.project_type IS NULL OR items.project_type = '')
                -- AND items.deleted_at IS NULL [REMOVED]
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
                $projectFilter
                $filterClause
                ORDER BY items.updated_at DESC
            ";

            $params = array_merge([$this->currentUserId, $this->currentUserId], $tenantIds, [$this->currentUserId, $this->currentUserId]);
            
            // [FIX] Add projectId to params if set
            if ($projectId) {
                $params[] = $projectId;
            }

            $stmt = $this->pdo->prepare($sql);
            $stmt->execute($params);
            
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
             
              $this->sendJSON(array_map(function($row) {
                  $item = $this->mapItemRow($row);
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
                -- AND items.deleted_at IS NULL [REMOVED]
                AND (
                    (items.project_id IS NULL AND items.created_by = ?) -- Private Inbox
                    OR items.assigned_to = ? -- Explicitly assigned to me
                    OR items.created_by = ? -- Created by me
                )
                $filterClause
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
            $this->sendJSON(array_map([$this, 'mapItemRow'], $items));
        }
    }

    // --- Archive & Trash Actions ---

    public function archive($id) {
        $this->authenticate(); // Ensure Auth
        $this->updateStatus($id, 'archive');
    }

    public function trash($id) {
        $this->authenticate(); // Ensure Auth
        $this->updateStatus($id, 'trash');
    }

    public function restore($id) {
        $this->authenticate(); // Ensure Auth
        $this->updateStatus($id, 'restore');
    }

    private function updateStatus($id, $action) {
        // Shared Logic for State Transitions
        if (!$id) {
            $this->sendError(400, 'ID required');
        }

        // 1. Determine SQL updates based on action
        $updates = "";
        $params = [];
        
        switch ($action) {
            case 'archive':
                $updates = "is_archived = 1, deleted_at = NULL"; // Ensure not in trash when archiving
                break;
            case 'trash':
                // Move to trash = set deleted_at
                $updates = "deleted_at = " . time() . ", is_archived = 0"; // Ensure not archived when trashing
                break;
            case 'restore':
                // Restore = clear all flags
                $updates = "is_archived = 0, deleted_at = NULL";
                break;
            default:
                $this->sendError(400, 'Invalid action');
                return;
        }

        try {
            $this->pdo->beginTransaction();

            // 2. Perform Update on Target Item
            // Security check: Ensure user has access to this item
            $tenantIds = $this->joinedTenants;
            if (empty($tenantIds)) $tenantIds = [$this->currentTenantId];
            if (!in_array($this->currentTenantId, $tenantIds)) $tenantIds[] = $this->currentTenantId;
            $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));

            $check = $this->pdo->prepare("SELECT project_id, created_by, tenant_id, is_project FROM items WHERE id = ? AND (tenant_id IN ($placeholders) OR tenant_id IS NULL OR tenant_id = '')");
            $check->execute(array_merge([$id], $tenantIds));
            $existing = $check->fetch(PDO::FETCH_ASSOC);

            if (!$existing) {
                 $this->sendError(404, 'Item not found or access denied');
                 return;
            }

            // Permission Logic (simplified for this context, assuming user can modify their items or project items in their tenant)
            $isAdmin = ($this->currentUser['role'] ?? '') === 'admin';
            $itemTenantId = (string)($existing['tenant_id'] ?? '');

            if (!$isAdmin) {
                if ($itemTenantId !== '' && !in_array($itemTenantId, $this->joinedTenants)) {
                    $this->sendError(403, 'Access Denied: Organization mismatch');
                    return;
                }
                // For personal items (tenant_id IS NULL or ''), check created_by
                if (($itemTenantId === '' || is_null($existing['tenant_id'])) && $existing['created_by'] !== $this->currentUserId) {
                    $this->sendError(403, 'Access Denied: Personal item ownership mismatch');
                    return;
                }
            }

            $sql = "UPDATE items SET $updates, updated_at = " . time() . " WHERE id = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute(array_merge($params, [$id]));

            // 3. Recursive Cascade for Projects
            // IF this item IS a project, update all items BELONGING to it or its sub-projects.
            if ($existing['is_project']) {
                $descendantIds = $this->getAllDescendantIds($id);
                if (!empty($descendantIds)) {
                    $placeholders = implode(',', array_fill(0, count($descendantIds), '?'));
                    $cascadeSql = "UPDATE items SET $updates, updated_at = " . time() . " WHERE id IN ($placeholders)";
                    $this->pdo->prepare($cascadeSql)->execute(array_merge($params, $descendantIds));
                }
            }

            $this->pdo->commit();
            $this->sendJSON(['success' => true]);

        } catch (PDOException $e) {
            $this->pdo->rollBack();
            $this->sendError(500, 'Action Failed: ' . $e->getMessage());
        }
    }

    // GET /api/items?project_id=XXX
    // Returns items belonging to a specific project (Shared Scope)
    private function getProjectItems($projectId) {
        // [Security Rule] Project = Shared (Tenant Public for now).
        // [FIX] Support Personal Projects (tenant_id IS NULL) and Recursive Matching
        
        $descendants = $this->getProjectDescendantIds($projectId);
        $pPlaceholders = implode(',', array_fill(0, count($descendants), '?'));

        // --- Filter Logic ---
        // Default: Active only (not archived, not deleted)
        // ?show_archived=1: Show ONLY archived (history)
        // ?show_trash=1: Show ONLY trash
        $filterClause = " AND items.is_archived = 0 AND items.deleted_at IS NULL ";
        
        if (isset($_GET['show_trash']) && $_GET['show_trash'] == 1) {
            $filterClause = " AND items.deleted_at IS NOT NULL ";
        } elseif (isset($_GET['show_archived']) && $_GET['show_archived'] == 1) {
            $filterClause = " AND items.is_archived = 1 AND items.deleted_at IS NULL ";
        }

        $sql = "
            SELECT items.*, parent.title as parent_title, proj.title as real_project_title,
                   a.name as assignee_name, a.color as assignee_color
            FROM items
            LEFT JOIN items parent ON items.parent_id = parent.id
            LEFT JOIN items proj ON items.project_id = proj.id
            LEFT JOIN assignees a ON items.assigned_to = a.id
            WHERE (items.tenant_id = ? OR items.tenant_id IS NULL)
            AND (items.project_id IN ($pPlaceholders) OR items.parent_id IN ($pPlaceholders) OR items.id IN ($pPlaceholders))
            -- [FIX] Dynamic Filter Clause Instead of Hardcoded
            $filterClause
            ORDER BY items.updated_at DESC
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $params = array_merge([$this->currentTenantId], $descendants, $descendants, $descendants);
        $stmt->execute($params);
        
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $this->sendJSON(array_map([$this, 'mapItemRow'], $items));
    }

    // GET /api/items?parent_id=XXX
    // Returns direct sub-tasks of an item
    private function getSubTasks($parentId) {
        // [Security Rule] Context Aware Isolation
        // Use joinedTenants + NULL (Personal) to gather all accessible sub-tasks
        $tenantIds = $this->joinedTenants ?: [];
        if (!empty($this->currentTenantId) && !in_array($this->currentTenantId, $tenantIds)) {
            $tenantIds[] = $this->currentTenantId;
        }

        $placeholders = '';
        if (!empty($tenantIds)) {
            $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
        }

        $sql = "
            SELECT items.*
            FROM items
            WHERE (
                " . ($placeholders ? "items.tenant_id IN ($placeholders)" : "1=0") . "
                OR items.tenant_id IS NULL OR items.tenant_id = ''
            )
            AND items.parent_id = ?
            AND items.is_archived = 0 AND items.deleted_at IS NULL -- Only active subtasks
            ORDER BY items.created_at ASC
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $params = array_merge($tenantIds, [$parentId]);
        $stmt->execute($params);
        
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $this->sendJSON(array_map([$this, 'mapItemRow'], $items));
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
            AND is_archived = 0 AND deleted_at IS NULL -- Only active, non-archived, non-deleted items
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
            AND items.deleted_at IS NULL -- Do not show deleted items via direct access
        ";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$id, $this->currentTenantId, $this->currentUserId, $this->currentUserId]);
        $item = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$item) {
            $this->sendError(404, 'Item not found or access denied');
        }
        $this->sendJSON($this->mapItemRow($item));
    }

    private function create() {
    $data = $this->getInput();
    if (empty($data['title'])) {
        $this->sendError(400, 'Title is required');
    }

    // [UUID v7] Generate new ID using UUID v7 instead of item_ prefix
    require_once __DIR__ . '/Uuidv7.php';
    $id = $data['id'] ?? Uuidv7::generate();
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
        if (!$parentId && !empty($data['projectId'])) {
            $parentId = $data['projectId'];
        }

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
                project_id, created_by, project_type, due_date, client_name, site_name, gross_profit_target,
                is_archived, deleted_at
            ) VALUES (
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?,
                ?, ?, ?, ?, ?, ?, ?,
                ?, ?
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
            } else if (!empty($data['projectId'])) {
                $projStmt = $this->pdo->prepare("SELECT tenant_id, client_name, site_name FROM items WHERE id = ?");
                $projStmt->execute([$data['projectId']]);
                $proj = $projStmt->fetch(PDO::FETCH_ASSOC);
                if ($proj) {
                    $effectiveTenantId = $proj['tenant_id']; // Inherit from project
                    if (empty($data['clientName']) && empty($data['client'])) {
                        $data['clientName'] = $proj['client_name'];
                    }
                    if (empty($data['siteName']) && empty($data['site'])) {
                        $data['siteName'] = $proj['site_name'];
                    }
                }
            } else if (array_key_exists('tenantId', $data)) {
                // [FIX] Use array_key_exists instead of isset, because isset(null) returns false
                // Frontend may send tenantId: null explicitly for personal items
                $effectiveTenantId = $data['tenantId'];
            }

            // [NEW] Automated Assignment Logic based on JBWOS Spec
            // 1. If projectId is provided, inherit project's assignee
            // 2. If Personal item (no projectId, no tenantId), assign to self
            // 3. If Company item (tenantId), default to unassigned (null)
            $assignedTo = $data['assignedTo'] ?? null;
            if (!$assignedTo) {
                if (!empty($data['projectId'])) {
                    $assignedTo = $this->getProjectAssignee($data['projectId']);
                } else if (!$effectiveTenantId) {
                    // Personal mode (u_... format user ID is stored as TEXT in assigned_to)
                    $assignedTo = $this->currentUserId;
                }
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
                $assignedTo, // Use automated assignment
                $delegationJson,
                $data['projectId'] ?? null, // Link to project if provided
                $this->currentUserId,
                $projectType,
                $dueDate,
                $data['clientName'] ?? $data['client'] ?? null,
                $data['siteName'] ?? $data['site'] ?? null,
                $data['grossProfitTarget'] ?? 0,
                0, // is_archived default to 0
                null // deleted_at default to NULL
            ]);
            
            if ($parentId) {
                $this->pdo->prepare("UPDATE items SET is_project = 1 WHERE id = ?")
                    ->execute([$parentId]);
            }
            
            // [v23] Sync Manufacturing Data
            ManufacturingSyncService::syncItem($this->pdo, $id, $data);

            // [Phase5] プロジェクト付きアイテム作成時の自動チェーン追加
            $projectIdForChain = $data['projectId'] ?? null;
            if ($projectIdForChain) {
                $this->autoChainAndPlace($id, $projectIdForChain);
            }

            $this->sendJSON(['id' => $id, 'success' => true]);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }

    }

    /**
     * プロジェクト内フローチェーンの末尾ノードを検出
     * 末尾 = item_dependenciesのtarget_item_idだが、同プロジェクト内のsource_item_idにはなっていないもの
     */
    protected function findChainTail($projectId) {
        $stmt = $this->pdo->prepare("
            SELECT d.target_item_id
            FROM item_dependencies d
            JOIN items i ON d.target_item_id = i.id
            WHERE i.project_id = ?
            AND d.tenant_id = ?
            AND d.target_item_id NOT IN (
                SELECT d2.source_item_id
                FROM item_dependencies d2
                JOIN items i2 ON d2.source_item_id = i2.id
                WHERE i2.project_id = ?
                AND d2.tenant_id = ?
            )
            LIMIT 1
        ");
        $stmt->execute([$projectId, $this->currentTenantId, $projectId, $this->currentTenantId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $row['target_item_id'] : null;
    }

    /**
     * 新アイテムをフローチェーン末尾に接続し、flow座標を自動配置
     */
    protected function autoChainAndPlace($newItemId, $projectId) {
        $tailId = $this->findChainTail($projectId);
        if (!$tailId || $tailId === $newItemId) return false;

        // 末尾→新アイテムの依存関係を作成
        $depId = 'dep_' . uniqid() . '_' . bin2hex(random_bytes(4));
        $now = time();
        try {
            $stmt = $this->pdo->prepare(
                "INSERT INTO item_dependencies (id, tenant_id, source_item_id, target_item_id, created_at) VALUES (?, ?, ?, ?, ?)"
            );
            $stmt->execute([$depId, $this->currentTenantId, $tailId, $newItemId, $now]);
        } catch (PDOException $e) {
            if (strpos($e->getMessage(), 'UNIQUE constraint failed') !== false) {
                return false;
            }
            throw $e;
        }

        // 末尾ノードのflow座標を読み取り、y+150の位置に配置
        $tailStmt = $this->pdo->prepare("SELECT meta FROM items WHERE id = ?");
        $tailStmt->execute([$tailId]);
        $tailRow = $tailStmt->fetch(PDO::FETCH_ASSOC);
        $tailMeta = $tailRow && $tailRow['meta'] ? json_decode($tailRow['meta'], true) : [];

        $flowX = $tailMeta['flow_x'] ?? 0;
        $flowY = ($tailMeta['flow_y'] ?? 0) + 150;

        // 新アイテムの既存metaとマージ
        $newStmt = $this->pdo->prepare("SELECT meta FROM items WHERE id = ?");
        $newStmt->execute([$newItemId]);
        $newRow = $newStmt->fetch(PDO::FETCH_ASSOC);
        $newMeta = $newRow && $newRow['meta'] ? json_decode($newRow['meta'], true) : [];
        $newMeta['flow_x'] = $flowX;
        $newMeta['flow_y'] = $flowY;

        $this->pdo->prepare("UPDATE items SET meta = ? WHERE id = ?")
            ->execute([json_encode($newMeta), $newItemId]);

        return true;
    }

    private function update($id) {
        $tenantIds = $this->joinedTenants;
        if (empty($tenantIds)) $tenantIds = [$this->currentTenantId];
        if (!in_array($this->currentTenantId, $tenantIds)) $tenantIds[] = $this->currentTenantId;

        $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
        
        $query = "SELECT project_id, created_by, tenant_id, is_project FROM items WHERE id = ? AND (tenant_id IN ($placeholders) OR tenant_id IS NULL OR created_by = ?)";
        $check = $this->pdo->prepare($query);
        $check->execute(array_merge([$id], $tenantIds, [$this->currentUserId]));
        $existing = $check->fetch(PDO::FETCH_ASSOC);

        if (!$existing) {
             $this->sendError(404, 'Item not found');
        }
        
        $isAdmin = ($this->currentUser['role'] ?? '') === 'admin';
        if (!$isAdmin && is_null($existing['project_id']) && $existing['created_by'] != (string)$this->currentUserId && ($existing['assigned_to'] ?? '') != (string)$this->currentUserId) {
            $this->sendError(403, 'Access Denied: Cannot edit private item of another user (created_by=' . $existing['created_by'] . ', assigned_to=' . ($existing['assigned_to'] ?? 'NULL') . ', currentUserId=' . $this->currentUserId . ')');
        }

        $data = $this->getInput();
        
        // Safety: Do not allow clearing title via update
        if (array_key_exists('title', $data)) {
            $newTitle = $data['title'];
            if ($newTitle === null || (is_string($newTitle) && trim($newTitle) === '')) {
                unset($data['title']);
            }
        }

        // 1. [Hook] Automated Assignment Logic on Project Move
        // We do this BEFORE the main update because it might change values in $data
        if (array_key_exists('projectId', $data) && $data['projectId'] !== $existing['project_id']) {
            $newProjectId = $data['projectId'];
            if ($newProjectId) {
                $projStmt = $this->pdo->prepare("SELECT tenant_id, assigned_to FROM items WHERE id = ?");
                $projStmt->execute([$newProjectId]);
                $targetProj = $projStmt->fetch(PDO::FETCH_ASSOC);
                
                if ($targetProj) {
                    $targetTenantId = $targetProj['tenant_id'];
                    if (!isset($data['assignedTo'])) {
                        $currentAssignee = $this->getItemAssignee($id);
                        $currentEmail = $this->getAssigneeEmail($currentAssignee);
                        $newAssigneeId = $currentEmail ? $this->findAssigneeIdByEmail($targetTenantId, $currentEmail) : null;
                        $data['assignedTo'] = $newAssigneeId ?: $targetProj['assigned_to'];
                    }
                    if (!isset($data['tenantId']) && $targetTenantId !== $existing['tenant_id']) {
                        $data['tenantId'] = $targetTenantId;
                    }
                }
            } else {
                if (!isset($data['assignedTo'])) $data['assignedTo'] = $this->currentUserId;
                if (!isset($data['tenantId'])) $data['tenantId'] = null;
            }
        }

        // 1.5 [Hook] 依存関係の日程制約チェック
        $this->validateDependencyConstraint($id, $data);

        // 1.6 カスケード用に更新前の日付を保持
        $preCascadeStmt = $this->pdo->prepare("SELECT due_date, prep_date FROM items WHERE id = ?");
        $preCascadeStmt->execute([$id]);
        $preCascadeDates = $preCascadeStmt->fetch(PDO::FETCH_ASSOC);

        // 2. Main Update using BaseController helper
        $allowedFields = [
            'title', 'status', 'memo', 'due_date', 'is_boosted', 'boosted_date', 
            'prep_date', 'parent_id', 'is_project', 'project_category', 
            'estimated_minutes', 'assigned_to', 'project_id', 'project_type', 
            'client_name', 'gross_profit_target', 'tenant_id', 'is_archived', 
            'deleted_at', 'focus_order', 'is_intent', 'due_status', 'delegation',
            'work_days',
            'meta'
        ];

        $result = $this->updateEntity('items', $id, $allowedFields);

        // 3. [Hook] Extra logic for status updates
        if (isset($data['status'])) {
            $this->pdo->prepare("UPDATE items SET status_updated_at = ? WHERE id = ?")
                ->execute([time(), $id]);
            if ($data['status'] === 'done') {
                $this->pdo->prepare("UPDATE items SET is_intent = 0, completed_at = ? WHERE id = ?")
                    ->execute([time(), $id]);
            } else {
                // done以外に戻した場合、completed_atをNULLにリセット
                $this->pdo->prepare("UPDATE items SET completed_at = NULL WHERE id = ?")
                    ->execute([$id]);
            }
        }

        // 4. [Hook] Sync Manufacturing Data
        ManufacturingSyncService::syncItem($this->pdo, $id, $data);

        // 5. [Hook] 依存関係に基づく自動日程調整（カスケード）
        $this->cascadeDependencyDates($id, $data, $preCascadeDates);

        $this->sendJSON(['success' => true]);
    }

    // --- Automated Assignment Helpers ---

    private function getItemAssignee($id) {
        $stmt = $this->pdo->prepare("SELECT assigned_to FROM items WHERE id = ?");
        $stmt->execute([$id]);
        return $stmt->fetchColumn();
    }

    private function getProjectAssignee($projectId) {
        $stmt = $this->pdo->prepare("SELECT assigned_to FROM items WHERE id = ?");
        $stmt->execute([$projectId]);
        return $stmt->fetchColumn();
    }

    private function getAssigneeEmail($assignedTo) {
        if (!$assignedTo) return null;
        
        // Check if it's a direct User ID (u_...)
        if (strpos((string)$assignedTo, 'u_') === 0) {
            $stmt = $this->pdo->prepare("SELECT email FROM users WHERE id = ?");
            $stmt->execute([$assignedTo]);
            return $stmt->fetchColumn();
        }
        
        // Otherwise it's an integer ID from assignees table
        $stmt = $this->pdo->prepare("SELECT email FROM assignees WHERE id = ?");
        $stmt->execute([$assignedTo]);
        return $stmt->fetchColumn();
    }

    private function findAssigneeIdByEmail($tenantId, $email) {
        if (!$email) return null;
        
        // Try to find in assignees table for this tenant
        $stmt = $this->pdo->prepare("SELECT id FROM assignees WHERE tenant_id = ? AND email = ? AND is_active = 1 LIMIT 1");
        $stmt->execute([$tenantId, $email]);
        $id = $stmt->fetchColumn();
        if ($id) return $id;

        // If not found in assignees, check if it's a system user who is a member of this tenant
        // In that case, we might want to return their user ID (u_...) if the system supports it,
        // but the current schema seems to prefer assignees table for company items.
        // For JBWOS, let's check company_members/memberships.
        $stmt = $this->pdo->prepare("
            SELECT u.id 
            FROM users u
            JOIN memberships m ON u.id = m.user_id
            WHERE m.tenant_id = ? AND u.email = ?
            LIMIT 1
        ");
        $stmt->execute([$tenantId, $email]);
        return $stmt->fetchColumn();
    }
    
    // Physical Delete (Destroy)
    private function delete($id) {
        $this->authenticate(); // Ensure Auth
        // Same permission checks as before...
        $tenantIds = $this->joinedTenants;
        if (empty($tenantIds)) $tenantIds = [$this->currentTenantId];
        $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));

        $check = $this->pdo->prepare("SELECT project_id, created_by, tenant_id, is_project FROM items WHERE id = ? AND (tenant_id IN ($placeholders) OR tenant_id IS NULL OR tenant_id = '')");
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

        try {
            $this->pdo->beginTransaction();

            // 1. Delete the item
            $stmt = $this->pdo->prepare("DELETE FROM items WHERE id = ?");
            $stmt->execute([$id]);

            // 2. Cascade Delete if it's a Project
            if ($existing['is_project']) {
                $descendantIds = $this->getAllDescendantIds($id);
                if (!empty($descendantIds)) {
                    $placeholders = implode(',', array_fill(0, count($descendantIds), '?'));
                    $cStmt = $this->pdo->prepare("DELETE FROM items WHERE id IN ($placeholders)");
                    $cStmt->execute($descendantIds);
                }
            }

            $this->pdo->commit();
            $this->sendJSON(['success' => true]);
        } catch (PDOException $e) {
            $this->pdo->rollBack();
            $this->sendError(500, 'Delete Failed: ' . $e->getMessage());
        }
    }
    
    // [JBWOS] Helper for Recursive Cascade
    private function getAllDescendantIds($rootId) {
        $descendantIds = [];
        $stack = [$rootId];
        $seen = [$rootId => true];

        while (!empty($stack)) {
            $parentId = array_pop($stack);
            
            // Find all items where parent_id = ? OR project_id = ?
            // We use both to ensure sub-tasks and project-linked items are caught
            $stmt = $this->pdo->prepare("SELECT id FROM items WHERE parent_id = ? OR project_id = ?");
            $stmt->execute([$parentId, $parentId]);
            $children = $stmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($children as $childId) {
                if (!isset($seen[$childId])) {
                    $seen[$childId] = true;
                    $descendantIds[] = $childId;
                    $stack[] = $childId;
                }
            }
        }
        return $descendantIds;
    }


    // [JBWOS] Bulk Reorder Logic - sort_orderカラムを更新
    private function reorderFocus() {
        $data = $this->getInput();
        if (empty($data['items']) || !is_array($data['items'])) {
            $this->sendError(400, 'Invalid items data');
        }

        try {
            $this->pdo->beginTransaction();

            $now = time();
            $sql = "UPDATE items SET sort_order = ?, updated_at = ? WHERE id = ? AND (
                (tenant_id IS NULL AND created_by = ?) OR
                (tenant_id = ? AND (created_by = ? OR assigned_to = ?))
            )";
            $stmt = $this->pdo->prepare($sql);

            foreach ($data['items'] as $item) {
                if (isset($item['id'], $item['order'])) {
                     $stmt->execute([
                         (int)$item['order'],
                         $now,
                         $item['id'],
                         $this->currentUserId,
                         $this->currentTenantId,
                         $this->currentUserId,
                         $this->currentUserId,
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

    /**
     * 依存関係の日程制約バリデーション
     * prep_date/due_date の変更が依存関係の制約に違反しないか確認
     */
    private function validateDependencyConstraint($itemId, $data) {
        $newPrepDate = $data['prepDate'] ?? $data['prep_date'] ?? null;
        $newDueDate = $data['dueDate'] ?? $data['due_date'] ?? null;

        if ($newPrepDate === null && $newDueDate === null) return;

        // prep_dateの変更 → このアイテムが後続タスク（target）の場合をチェック
        if ($newPrepDate !== null) {
            $stmt = $this->pdo->prepare(
                "SELECT d.source_item_id, i.due_date FROM item_dependencies d
                 JOIN items i ON d.source_item_id = i.id AND i.tenant_id = d.tenant_id
                 WHERE d.target_item_id = ? AND d.tenant_id = ?"
            );
            $stmt->execute([$itemId, $this->currentTenantId]);
            $sources = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($sources as $src) {
                if (!$src['due_date']) continue;
                $sourceDueTs = is_numeric($src['due_date']) ? (int)$src['due_date'] : strtotime($src['due_date']);
                $newPrepTs = is_numeric($newPrepDate) ? (int)$newPrepDate : strtotime($newPrepDate);
                if ($newPrepTs < $sourceDueTs) {
                    $this->sendError(409, '前提タスクの完了予定日より前に配置できません');
                }
            }
        }

        // due_dateの変更 → このアイテムが前提タスク（source）の場合をチェック
        if ($newDueDate !== null) {
            $stmt = $this->pdo->prepare(
                "SELECT d.target_item_id, i.prep_date FROM item_dependencies d
                 JOIN items i ON d.target_item_id = i.id AND i.tenant_id = d.tenant_id
                 WHERE d.source_item_id = ? AND d.tenant_id = ?"
            );
            $stmt->execute([$itemId, $this->currentTenantId]);
            $targets = $stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($targets as $tgt) {
                if (!$tgt['prep_date']) continue;
                $targetPrepTs = (int)$tgt['prep_date'];
                $newDueTs = is_numeric($newDueDate) ? (int)$newDueDate : strtotime($newDueDate);
                if ($newDueTs > $targetPrepTs) {
                    $this->sendError(409, '後続タスクの開始日より後に完了予定日を設定できません');
                }
            }
        }
    }

    /**
     * 依存関係に基づく自動日程調整（カスケード）
     * 前提タスクのdue_dateが後ろにずれた場合、後続タスクも連動してずれる
     */
    private function cascadeDependencyDates($itemId, $data, $preCascadeDates = null) {
        $newDueDate = $data['dueDate'] ?? $data['due_date'] ?? null;
        if ($newDueDate === null) return;

        // 更新前の値を使用（updateEntity実行後はDBが更新済みのため引数から取得）
        $oldDueDate = $preCascadeDates['due_date'] ?? null;
        if (!$oldDueDate) return;

        $oldTs = is_numeric($oldDueDate) ? (int)$oldDueDate : strtotime($oldDueDate);
        $newTs = is_numeric($newDueDate) ? (int)$newDueDate : strtotime($newDueDate);
        $diffSeconds = $newTs - $oldTs;

        // 前にずれた場合はカスケード不要
        if ($diffSeconds <= 0) return;

        $visited = [];
        $queue = [$itemId];
        $now = time();

        while (!empty($queue)) {
            $currentId = array_shift($queue);
            if (isset($visited[$currentId])) continue;
            $visited[$currentId] = true;

            // 後続タスクを取得
            $depStmt = $this->pdo->prepare(
                "SELECT target_item_id FROM item_dependencies WHERE source_item_id = ?"
            );
            $depStmt->execute([$currentId]);
            $targets = $depStmt->fetchAll(PDO::FETCH_COLUMN);

            foreach ($targets as $targetId) {
                if (isset($visited[$targetId])) continue;

                $itemStmt = $this->pdo->prepare("SELECT prep_date, due_date FROM items WHERE id = ?");
                $itemStmt->execute([$targetId]);
                $targetItem = $itemStmt->fetch(PDO::FETCH_ASSOC);
                if (!$targetItem || !$targetItem['prep_date']) continue;

                $updates = [];
                $params = [];

                // prep_dateをずらす
                $oldPrep = (int)$targetItem['prep_date'];
                $newPrep = $oldPrep + $diffSeconds;
                $updates[] = "prep_date = ?";
                $params[] = $newPrep;

                // due_dateもずらす（存在する場合）
                if ($targetItem['due_date']) {
                    $oldDue = is_numeric($targetItem['due_date']) ? (int)$targetItem['due_date'] : strtotime($targetItem['due_date']);
                    $newDue = $oldDue + $diffSeconds;
                    // due_dateの形式を維持
                    if (is_numeric($targetItem['due_date'])) {
                        $updates[] = "due_date = ?";
                        $params[] = $newDue;
                    } else {
                        $updates[] = "due_date = ?";
                        $params[] = date('Y-m-d', $newDue);
                    }
                }

                $updates[] = "updated_at = ?";
                $params[] = $now;
                $params[] = $targetId;

                $sql = "UPDATE items SET " . implode(', ', $updates) . " WHERE id = ?";
                $upStmt = $this->pdo->prepare($sql);
                $upStmt->execute($params);

                $queue[] = $targetId;
            }
        }
    }

    // [NEW] Clear All Data (User Reset)
    public function clearAllData() {
        $this->authenticate();
        $userId = $this->currentUserId;

        try {
            $this->pdo->beginTransaction();

            // 1. Delete associated manufacturing items
            $sqlFab = "DELETE FROM manufacturing_items WHERE item_id IN (SELECT id FROM items WHERE created_by = ?)";
            $stmtFab = $this->pdo->prepare($sqlFab);
            $stmtFab->execute([$userId]);

            // 2. Delete all items created by this user
            $sql = "DELETE FROM items WHERE created_by = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$userId]);
            
            $count = $stmt->rowCount();

            $this->pdo->commit();
            $this->sendJSON(['success' => true, 'count' => $count]);

        } catch (PDOException $e) {
            $this->pdo->rollBack();
            $this->sendError(500, 'Clear Data Failed: ' . $e->getMessage());
        }
    }
}

