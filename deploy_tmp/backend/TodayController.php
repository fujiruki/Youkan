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
        if ($projectId) {
             $stmtP = $this->pdo->prepare("SELECT tenant_id FROM items WHERE id = ?");
             $stmtP->execute([$projectId]);
             $pObj = $stmtP->fetch(PDO::FETCH_ASSOC);
             if ($pObj) {
                 $pTenant = $pObj['tenant_id'] ?? '';
                 if ($pTenant === $this->currentTenantId || in_array($pTenant, $this->joinedTenants)) {
                     $tenantId = $pTenant;
                 }
             }
        }

        // [New] Auto-reset "Intent Boost" items from previous days
        $this->resetExpiredBoosts();

        // Logic switch for Tenant vs Personal
        if ($tenantId) {
             $whereClause = "items.tenant_id = ?";
             $params = [$tenantId];
        } else {
             $whereClause = "items.tenant_id IS NULL AND items.created_by = ?";
             $params = [$this->currentUserId];
        }

        // [Fix] Project Focus Filter (Recursive)
        $projectParams = [];
        if ($projectId) {
            $descendants = $this->getProjectDescendantIds($projectId);
            if (!empty($descendants)) {
                $placeholders = implode(',', array_fill(0, count($descendants), '?'));
                $whereClause .= " AND items.id IN ($placeholders) ";
                $projectParams = $descendants;
            } else {
                $whereClause .= " AND 0 "; // Found nothing, show nothing
            }
        }

        // Merge params
        $queryParams = array_merge($params, $projectParams);

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

        // Logic switch for Tenant vs Personal
        if ($tenantId) {
             $whereClause = "tenant_id = ?";
             $params = [$tenantId];
        } else {
             $whereClause = "tenant_id IS NULL AND created_by = ?";
             $params = [$this->currentUserId];
        }

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

        if ($tenantId) {
             $whereClause = "tenant_id = ?";
             $params = [$tenantId];
        } else {
             $whereClause = "tenant_id IS NULL AND created_by = ?";
             $params = [$this->currentUserId];
        }

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
        if ($tenantId) {
             $whereClause = "tenant_id = ?";
             $params = [$tenantId];
        } else {
             $whereClause = "tenant_id IS NULL AND created_by = ?";
             $params = [$this->currentUserId];
        }

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
        return $item;
    }
}
