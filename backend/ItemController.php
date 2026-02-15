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

        if ($scope === 'aggregated' && !empty($this->joinedTenants)) {
             // Fetch Personal Items + Company Items (Aggregated View)
             $placeholders = implode(',', array_fill(0, count($this->joinedTenants), '?'));
             
             // [FIX 2026-02-04] Context-based Visibility for ProjectFocused Mode
             $projectId = $_GET['project_id'] ?? null;
             
             // Base params for tenant filter
             $params = $this->joinedTenants;
             
             if ($projectId) {
                 // [CORE FIX] ProjectFocused Mode:
                 // Show items if (Owned by me) OR (Belongs to the focused project or its sub-projects)
                 // Use recursive descendant fetch from BaseController
                 $descendants = $this->getProjectDescendantIds($projectId);
                 $pPlaceholders = implode(',', array_fill(0, count($descendants), '?'));

                 $sql = "
                    SELECT items.*, parent.title as parent_title, t.name as tenant_name
                    FROM items
                    LEFT JOIN items parent ON items.parent_id = parent.id
                    LEFT JOIN tenants t ON items.tenant_id = t.id
                    WHERE (items.tenant_id IN ($placeholders) OR items.tenant_id IS NULL)
                    -- AND items.deleted_at IS NULL [REMOVED]
                    AND (
                        -- Ownership Filter (my items)
                        (items.created_by = ? OR items.assigned_to = ?)
                        OR
                        -- Project Membership Filter (any item in this project or sub-projects)
                        items.project_id IN ($pPlaceholders)
                    )
                    $filterClause
                    ORDER BY items.updated_at DESC
                 ";
                 $params = array_merge($params, [$this->currentUserId, $this->currentUserId], $descendants);
             } else {
                 // Non-ProjectFocused: Standard ownership filter only
                 $sql = "
                    SELECT items.*, parent.title as parent_title, t.name as tenant_name
                    FROM items
                    LEFT JOIN items parent ON items.parent_id = parent.id
                    LEFT JOIN tenants t ON items.tenant_id = t.id
                    WHERE (items.tenant_id IN ($placeholders) OR items.tenant_id IS NULL)
                    -- AND items.deleted_at IS NULL [REMOVED]
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
             
             // Inject tenant_name into mapRow or just pass it
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
        // [Security Rule] Basic Tenant Isolation
        $sql = "
            SELECT items.*
            FROM items
            WHERE items.tenant_id = ? 
            AND items.parent_id = ?
            AND items.is_archived = 0 AND items.deleted_at IS NULL -- Only active subtasks
            ORDER BY items.created_at ASC
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$this->currentTenantId, $parentId]);
        
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
            } else if (isset($data['tenantId'])) {
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
            
            $this->sendJSON(['id' => $id, 'success' => true]);
        } catch (PDOException $e) {
            $this->sendError(500, 'Database Error: ' . $e->getMessage());
        }

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
        if (!$isAdmin && is_null($existing['project_id']) && $existing['created_by'] != (string)$this->currentUserId) {
            $this->sendError(403, 'Access Denied: Cannot edit private item of another user');
        }

        $data = $this->getInput();

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

        // 2. Main Update using BaseController helper
        $allowedFields = [
            'title', 'status', 'memo', 'due_date', 'is_boosted', 'boosted_date', 
            'prep_date', 'parent_id', 'is_project', 'project_category', 
            'estimated_minutes', 'assigned_to', 'project_id', 'project_type', 
            'client_name', 'gross_profit_target', 'tenant_id', 'is_archived', 
            'deleted_at', 'focus_order', 'is_intent', 'due_status', 'delegation'
        ];

        $result = $this->updateEntity('items', $id, $allowedFields);

        // 3. [Hook] Extra logic for status updates
        if (isset($data['status'])) {
            $this->pdo->prepare("UPDATE items SET status_updated_at = ? WHERE id = ?")
                ->execute([time(), $id]);
            if ($data['status'] === 'done') {
                $this->pdo->prepare("UPDATE items SET is_intent = 0 WHERE id = ?")
                    ->execute([$id]);
            }
        }

        // 4. [Hook] Sync Manufacturing Data
        ManufacturingSyncService::syncItem($this->pdo, $id, $data);
        
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

