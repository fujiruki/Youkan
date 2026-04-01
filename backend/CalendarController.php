<?php
// backend/CalendarController.php
require_once 'BaseController.php';

class CalendarController extends BaseController {

    public function __construct() {
        parent::__construct();
    }

    /**
     * Get monthly items for Volume calculation by Frontend.
     * Logic:
     * 1. Get Target User (me or specified).
     * 2. Fetch ALL items assigned to target.
     * 3. Mask items that belong to OTHER tenants or are Private (if viewer is different).
     * 
     * Query: ?year=YYYY&month=M&userId=XXX
     */
    public function getLoad($params) {
        $this->authenticate(); // Ensure we know who is asking

        $year = isset($params['year']) ? intval($params['year']) : intval(date('Y'));
        $month = isset($params['month']) ? intval($params['month']) : intval(date('n'));
        
        // Target User: Default to Self, but allow Manager to see others
        $targetUserId = $params['userId'] ?? $this->currentUserId;

        // Security / Privacy:
        // If viewing someone else, we must share a Tenant with them.
        // But getLoad can return "Private" blocks.
        // We fetch ALL items for targetUserId.
        // Then we mask.

        // Target Month Range
        $startDateStr = sprintf('%04d-%02d-01', $year, $month);
        $rangeStart = date('Y-m-d', strtotime('-1 month', strtotime($startDateStr)));
        $rangeEnd = date('Y-m-d', strtotime('+2 months', strtotime($startDateStr)));
        $prepStart = strtotime($rangeStart);
        $prepEnd = strtotime($rangeEnd);

        // Fetch simplified item objects
        // [FIX] Loosened filter to include items created by self but not yet assigned (Inbox)
        // Also respect tenant context if specified
        $tenantId = $params['tenantId'] ?? null;
        $tenantClause = "";
        $sqlParams = [$targetUserId, $this->currentUserId];

        if ($tenantId) {
            $tenantClause = " AND (items.tenant_id = ? OR items.tenant_id IS NULL) ";
            $sqlParams[] = $tenantId;
        }

        $sql = "
            SELECT
                items.id, items.tenant_id, items.title, items.due_date, items.prep_date, items.work_days, items.estimated_minutes,
                items.created_by, items.assigned_to, items.project_id, items.status,
                items.is_project,
                proj.title as real_project_title
            FROM items
            LEFT JOIN items proj ON items.project_id = proj.id
            WHERE
                (items.assigned_to = ? OR (items.assigned_to IS NULL AND items.created_by = ?))
                $tenantClause
                AND (
                    (items.due_date >= ? AND items.due_date <= ?)
                    OR
                    (items.prep_date >= ? AND items.prep_date <= ?)
                )
                AND items.status NOT IN ('decision_rejected', 'archive', 'done')
                AND items.is_project = 0
        ";

        array_push($sqlParams, $rangeStart, $rangeEnd, $rangeStart, $rangeEnd);

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($sqlParams);

        $rawItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result = [];

        foreach ($rawItems as $row) {
            $item = $this->mapItemRow($row);
            
            // --- JBWOS ABAC Visibility Logic ---
            $isVisible = false;
            
            // 1. Ownership/Assignment Principle (Trans-tenant)
            // If I am the creator or the one meant to do it, I MUST see the reality.
            $isMine = ($item['created_by'] === $this->currentUserId || ($item['assignedTo'] ?? null) === $this->currentUserId);

            // 2. Membership Principle (Company/Team)
            // If the item belongs to a tenant I am a member of, I see it (Managerial/Peer view).
            // Fetch my joined tenants if not already cached in session
            $myTenants = $this->joinedTenants; // Corrected: BaseController already loads this
            $isSameCompany = in_array($item['tenant_id'], $myTenants);

            if ($this->currentUserId === $targetUserId && (!$this->currentTenantId || $this->currentTenantId === '')) {
                // Personal Mode: High visibility of my own reality
                $isVisible = $isMine || $isSameCompany;
            } else {
                // Company Mode: Focus on business load
                // But still, if I own it or belong to the tenant, it's visible.
                $isVisible = $isMine || $isSameCompany;
            }

            if ($isVisible) {
                $result[] = $item;
            } else {
                // Masked: Hide details but keep LOAD (for capacity calculation accuracy)
                $result[] = [
                    'id' => $item['id'],
                    'title' => '予定あり (Scheduled)',
                    'due_date' => $item['due_date'],
                    'prep_date' => $item['prep_date'],
                    'estimatedMinutes' => $item['estimatedMinutes'] ?? 0,
                    'isMasked' => true
                ];
            }
        }

        return $result;
    }
    /**
     * Get items for Volume Calendar (Range Query).
     * Endpoint: /calendar/items
     * Params: start_date, end_date, target_user_id (optional)
     */
    public function getItems($params) {
        $this->authenticate();

        $startDate = $params['start_date'] ?? date('Y-m-01');
        $endDate = $params['end_date'] ?? date('Y-m-t');
        $targetUserId = $params['target_user_id'] ?? $this->currentUserId;

        // Fetch Logic using simple range
        // [FIX] Loosened filter to include items created by self but not yet assigned (Inbox)
        $tenantId = $params['tenantId'] ?? null;
        $tenantClause = "";
        $sqlParams = [$targetUserId, $this->currentUserId];

        if ($tenantId) {
            $tenantClause = " AND (items.tenant_id = ? OR items.tenant_id IS NULL) ";
            $sqlParams[] = $tenantId;
        }

        $sql = "
            SELECT
                items.id, items.tenant_id, items.title, items.due_date, items.prep_date, items.work_days, items.estimated_minutes,
                items.status, items.created_by, items.assigned_to, items.project_id,
                items.is_project,
                proj.title as real_project_title
            FROM items
            LEFT JOIN items proj ON items.project_id = proj.id
            WHERE
                (items.assigned_to = ? OR (items.assigned_to IS NULL AND items.created_by = ?))
                $tenantClause
                AND (
                    (items.due_date >= ? AND items.due_date <= ?)
                    OR
                    (items.prep_date >= ? AND items.prep_date <= ?)
                )
                AND items.status NOT IN ('decision_rejected', 'archive', 'done')
                AND items.is_project = 0
        ";

        array_push($sqlParams, $startDate, $endDate);

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($sqlParams);
        $rawItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($rawItems as $row) {
             $item = $this->mapItemRow($row);
             
             // --- JBWOS ABAC Visibility Logic (Consistent with getLoad) ---
             $isVisible = false;
             $isMine = ($item['created_by'] === $this->currentUserId || ($item['assignedTo'] ?? null) === $this->currentUserId);
             $myTenants = $this->joinedTenants; // Corrected to use property directly as BaseController loads it
             $isSameCompany = in_array($item['tenant_id'], $myTenants);

             if ($this->currentUserId === $targetUserId) {
                 $isVisible = $isMine || $isSameCompany;
             } else {
                 $isVisible = $isMine || $isSameCompany;
             }
 
             if ($isVisible) {
                 $result[] = $item;
             } else {
                 $result[] = [
                     'id' => $item['id'],
                     'title' => '予定あり (Scheduled)',
                     'due_date' => $item['due_date'],
                     'estimatedMinutes' => $item['estimatedMinutes'] ?? 0,
                     'status' => $item['status'],
                     'isMasked' => true
                 ];
             }
        }

        echo json_encode($result);
    }

    /**
     * 指定期間に完了したアイテムを取得
     * Endpoint: /calendar/completed
     * Params: start_date (YYYY-MM-DD), end_date (YYYY-MM-DD)
     */
    public function getCompletedItems($params) {
        $this->authenticate();

        $startDate = $params['start_date'] ?? date('Y-m-01');
        $endDate = $params['end_date'] ?? date('Y-m-t');

        // Unixタイムスタンプに変換（日の開始と終了）
        $startTs = strtotime($startDate . ' 00:00:00');
        $endTs = strtotime($endDate . ' 23:59:59');

        $tenantId = $params['tenantId'] ?? null;
        $tenantClause = "";
        $sqlParams = [$this->currentUserId, $this->currentUserId, $startTs, $endTs];

        if ($tenantId) {
            $tenantClause = " AND (items.tenant_id = ? OR items.tenant_id IS NULL) ";
            $sqlParams[] = $tenantId;
        }

        $sql = "
            SELECT
                items.id, items.tenant_id, items.title, items.due_date, items.prep_date,
                items.status, items.created_by, items.assigned_to, items.project_id,
                items.completed_at, items.estimated_minutes, items.work_days,
                items.is_project,
                proj.title as real_project_title
            FROM items
            LEFT JOIN items proj ON items.project_id = proj.id
            WHERE
                (items.assigned_to = ? OR (items.assigned_to IS NULL AND items.created_by = ?))
                AND items.completed_at IS NOT NULL
                AND items.completed_at >= ?
                AND items.completed_at <= ?
                $tenantClause
                AND items.deleted_at IS NULL
                AND items.is_project = 0
            ORDER BY items.completed_at DESC
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($sqlParams);
        $rawItems = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $result = [];
        foreach ($rawItems as $row) {
            $item = $this->mapItemRow($row);
            $isMine = ($item['created_by'] === $this->currentUserId || ($item['assignedTo'] ?? null) === $this->currentUserId);
            $isSameCompany = in_array($item['tenant_id'], $this->joinedTenants);

            if ($isMine || $isSameCompany) {
                $result[] = $item;
            }
        }

        echo json_encode($result);
    }

    public function handleRequest($method, $id = null) {
        $params = $_GET;
        if (preg_match('#/completed$#', $_SERVER['REQUEST_URI'])) {
            $this->getCompletedItems($params);
        } elseif (preg_match('#/items$#', $_SERVER['REQUEST_URI'])) {
            $this->getItems($params);
        } else {
            echo json_encode($this->getLoad($params));
        }
    }
}
