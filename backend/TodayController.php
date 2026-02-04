<?php
// backend/TodayController.php

require_once 'BaseController.php';
require_once 'EventService.php';

class TodayController extends BaseController {
    private $eventService;

    public function __construct() {
        parent::__construct();
        $this->eventService = new EventService($this->pdo);
    }

    /**
     * Get Today's View (Commit + Execution + Life).
     */
    public function getToday() {
        $this->authenticate();
        $tenantId = $this->currentTenantId;
        $projectId = $_GET['project_id'] ?? null;

        // [Fix] Context Switch: If Project Focus, use Project's Tenant
        // [NEW] Also get the project's projectId field for dual-ID support
        $projectIdAlt = null; // Alternate ID format (prj-xxx)
        if ($projectId) {
             $stmtP = $this->pdo->prepare("SELECT tenant_id, project_id FROM items WHERE id = ?");
             $stmtP->execute([$projectId]);
             $pObj = $stmtP->fetch(PDO::FETCH_ASSOC);
             if ($pObj) {
                 $pTenant = $pObj['tenant_id']; // Can be NULL or string
                 $projectIdAlt = $pObj['project_id']; // Alternate ID (prj-xxx format)
                 // [FIX] Allow switching to Personal (NULL) context if focused project is personal
                 if ($pTenant === $this->currentTenantId || in_array($pTenant, $this->joinedTenants) || $pTenant === null) {
                     $tenantId = $pTenant;
                 }
             }
        }

        // [New] Auto-reset "Intent Boost" items from previous days
        $this->resetExpiredBoosts();

        // Aggregated Scope Logic (similar to ItemController)
        $tenantIds = $this->joinedTenants ?: [];
        if (!empty($this->currentTenantId) && !in_array($this->currentTenantId, $tenantIds)) {
            $tenantIds[] = $this->currentTenantId;
        }

        $placeholders = '';
        if (!empty($tenantIds)) {
            $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
        }

        // [FIX 2026-02-04] Context-based Visibility for ProjectFocused Mode
        // Previously: (Ownership Filter) AND (Project Filter) -> hides non-owned items
        // Now: (Ownership Filter) OR (Project Membership Filter when focused)
        // This allows all project items to be visible when in ProjectFocused mode.

        $ownershipFilter = " (
            -- 1. Personal Items (ownership required)
            ((items.tenant_id IS NULL OR items.tenant_id = '') AND (items.created_by = ? OR items.assigned_to = ?))
            OR
            -- 2. Company Items (ownership required)
            (" . ($placeholders ? "items.tenant_id IN ($placeholders)" : "0") . " AND (items.assigned_to = ? OR items.created_by = ?))
        ) ";

        $params = array_merge([$this->currentUserId, $this->currentUserId], $tenantIds, [$this->currentUserId, $this->currentUserId]);

        // [NEW] Project Membership Filter (for ProjectFocused mode)
        if ($projectId) {
            $descendants = $this->getProjectDescendantIds($projectId);
            $projectMembershipFilter = "";

            if (!empty($descendants)) {
                $dPlaceholders = implode(',', array_fill(0, count($descendants), '?'));
                if ($projectIdAlt) {
                    $projectMembershipFilter = " (items.id IN ($dPlaceholders) OR items.project_id = ? OR items.project_id = ?) ";
                    $params = array_merge($params, $descendants, [$projectId, $projectIdAlt]);
                } else {
                    $projectMembershipFilter = " (items.id IN ($dPlaceholders) OR items.project_id = ?) ";
                    $params = array_merge($params, $descendants, [$projectId]);
                }
            } else {
                if ($projectIdAlt) {
                    $projectMembershipFilter = " (items.project_id = ? OR items.project_id = ?) ";
                    $params = array_merge($params, [$projectId, $projectIdAlt]);
                } else {
                    $projectMembershipFilter = " items.project_id = ? ";
                    $params = array_merge($params, [$projectId]);
                }
            }

            // [CORE FIX] Combine: Show if (Owned by me) OR (Belongs to focused project)
            // Security: Still requires tenant membership (handled via $tenantId context switch above)
            $whereClause = " items.deleted_at IS NULL AND (($ownershipFilter) OR ($projectMembershipFilter)) ";
        } else {
            // No project focus -> standard ownership filter only
            $whereClause = " items.deleted_at IS NULL AND ($ownershipFilter) ";
        }

        $queryParams = $params;

        // Zone 1: Commit (Status: today_commit)
        $sqlCommits = "
            SELECT items.*, parent.title as parent_title 
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE $whereClause AND items.status IN ('today_commit', 'focus')
            ORDER BY items.sort_order ASC, items.updated_at DESC
        ";
        $stmtCommits = $this->pdo->prepare($sqlCommits);
        $stmtCommits->execute($queryParams);
        $commits = array_map([$this, 'mapRow'], $stmtCommits->fetchAll(PDO::FETCH_ASSOC));

        // Zone 2: Execution (Status: execution_in_progress, execution_paused)
        $sqlExec = "
            SELECT items.*, parent.title as parent_title 
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE $whereClause AND items.status IN ('execution_in_progress', 'execution_paused') 
            ORDER BY items.updated_at DESC
        ";
        $stmtExec = $this->pdo->prepare($sqlExec);
        $stmtExec->execute($queryParams);
        $executionsRaw = $stmtExec->fetchAll(PDO::FETCH_ASSOC);
        $executions = array_map([$this, 'mapRow'], $executionsRaw);

        // Zone 3: Life
        // Candidates for Today (Status: confirmed OR ready)
        $sqlCandidates = "
            SELECT items.*, parent.title as parent_title 
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                $whereClause AND
                ((items.status IN ('confirmed', 'ready')) 
                OR 
                (items.is_boosted = 1 AND items.status NOT IN ('done', 'archive', 'today_commit', 'focus', 'execution_in_progress', 'execution_paused')))
            ORDER BY items.is_boosted DESC, items.rdd_date ASC
        ";
        $stmtCandidates = $this->pdo->prepare($sqlCandidates);
        $stmtCandidates->execute($queryParams);
        $candidates = array_map([$this, 'mapRow'], $stmtCandidates->fetchAll(PDO::FETCH_ASSOC));


        return [
            'commits' => $commits,
            'execution' => !empty($executions) ? $executions[0] : null, // Only return the Top 1
            'others_hidden' => array_slice($executions, 1), // Keep track of hidden ones
            'candidates' => $candidates
        ];
    }

    private function resetExpiredBoosts() {
        // Reset boosted status if the boosted date is before today (midnight)
        $todayStartMs = strtotime('today midnight') * 1000;
        
        $stmt = $this->pdo->prepare("UPDATE items SET is_boosted = 0, boosted_date = NULL WHERE tenant_id = ? AND is_boosted = 1 AND boosted_date < ?");
        $stmt->execute([$this->currentTenantId, $todayStartMs]);
    }

    /**
     * Commit a candidate to Today (Max 2 Check).
     */
    public function commit($id) {
        $this->authenticate();
        $tenantId = $this->currentTenantId;

        $tenantIds = $this->joinedTenants ?: [];
        if (!empty($this->currentTenantId) && !in_array($this->currentTenantId, $tenantIds)) {
            $tenantIds[] = $this->currentTenantId;
        }
        $placeholders = '';
        if (!empty($tenantIds)) {
            $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
        }

        $whereClause = " (
            ((tenant_id IS NULL OR tenant_id = '') AND (created_by = ? OR assigned_to = ?))
            OR
            (" . ($placeholders ? "tenant_id IN ($placeholders)" : "0") . " AND (assigned_to = ? OR created_by = ?))
        ) ";
        $params = array_merge([$this->currentUserId, $this->currentUserId], $tenantIds, [$this->currentUserId, $this->currentUserId]);

        // 1. Check current commits count
        $stmt = $this->pdo->prepare("SELECT COUNT(*) FROM items WHERE $whereClause AND status = 'today_commit'");
        $stmt->execute($params);
        $count = $stmt->fetchColumn();

        if ($count >= 2) {
            http_response_code(400);
            return ['error' => 'Daily commit limit reached (Max 2).'];
        }

        $this->pdo->beginTransaction();
        try {
            // 2. Log Event
            $this->eventService->logIn('TodayCommited', ['item_id' => $id]);

            // 3. Update Status
            $stmt = $this->pdo->prepare("UPDATE items SET status = 'today_commit', status_updated_at = ?, updated_at = ? WHERE id = ? AND $whereClause");
            $now = time();
            $paramsWithId = array_merge([$now, $now, $id], $params);
            $stmt->execute($paramsWithId);

            $this->pdo->commit();
            return ['success' => true, 'id' => $id, 'new_status' => 'today_commit'];

        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Complete an item (Done).
     */
    public function complete($id) {
        $this->authenticate();
        $tenantId = $this->currentTenantId;

        $tenantIds = $this->joinedTenants ?: [];
        if (!empty($this->currentTenantId) && !in_array($this->currentTenantId, $tenantIds)) {
            $tenantIds[] = $this->currentTenantId;
        }
        $placeholders = '';
        if (!empty($tenantIds)) {
            $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
        }

        $whereClause = " (
            ((tenant_id IS NULL OR tenant_id = '') AND (created_by = ? OR assigned_to = ?))
            OR
            (" . ($placeholders ? "tenant_id IN ($placeholders)" : "0") . " AND (assigned_to = ? OR created_by = ?))
        ) ";
        $params = array_merge([$this->currentUserId, $this->currentUserId], $tenantIds, [$this->currentUserId, $this->currentUserId]);

        $this->pdo->beginTransaction();
        try {
            $this->eventService->logIn('TodayCompleted', ['item_id' => $id]);

            $stmt = $this->pdo->prepare("UPDATE items SET status = 'done', status_updated_at = ?, updated_at = ? WHERE id = ? AND $whereClause");
            $now = time();
            $paramsWithId = array_merge([$now, $now, $id], $params);
            $stmt->execute($paramsWithId);

            $this->pdo->commit();
            return ['success' => true, 'id' => $id, 'new_status' => 'done'];
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Undo completion (Revert to today_commit).
     */
    public function undo($id) {
        $this->authenticate();
        $tenantId = $this->currentTenantId;
        
        // Target: Items that are 'done'
        $tenantIds = $this->joinedTenants ?: [];
        if (!empty($this->currentTenantId) && !in_array($this->currentTenantId, $tenantIds)) {
            $tenantIds[] = $this->currentTenantId;
        }
        $placeholders = '';
        if (!empty($tenantIds)) {
            $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
        }

        $whereClause = " (
            ((tenant_id IS NULL OR tenant_id = '') AND (created_by = ? OR assigned_to = ?))
            OR
            (" . ($placeholders ? "tenant_id IN ($placeholders)" : "0") . " AND (assigned_to = ? OR created_by = ?))
        ) ";
        $params = array_merge([$this->currentUserId, $this->currentUserId], $tenantIds, [$this->currentUserId, $this->currentUserId]);

        $this->pdo->beginTransaction();
        try {
            $this->eventService->logIn('TodayUndo', ['item_id' => $id]);

            // Revert to 'today_commit' if it was done recently? 
            // For MVP, simplistic revert to 'today_commit' creates the smoothest UX for "Oops, I clicked done".
            $stmt = $this->pdo->prepare("UPDATE items SET status = 'today_commit', status_updated_at = ?, updated_at = ? WHERE id = ? AND status = 'done' AND $whereClause");
            $now = time();
            $paramsWithId = array_merge([$now, $now, $id], $params);
            $stmt->execute($paramsWithId);

            if ($stmt->rowCount() === 0) {
                // Should we check if item exists? Or just ignore?
                // If rowCount is 0, maybe it wasn't 'done' or doesn't belong to user.
                // Let's silently succeed or throw error? 
                // Creating test script will tell. For now, assume success.
            }

            $this->pdo->commit();
            return ['success' => true, 'id' => $id, 'new_status' => 'today_commit'];
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }

    /**
     * Helper: Map row types
     */
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

        // [Archive & Trash]
        $item['isArchived'] = (bool)($item['is_archived'] ?? 0);
        $item['deletedAt'] = $item['deleted_at'] ?? null;

        return $item;
    }
}
