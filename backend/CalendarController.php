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
        $sql = "
            SELECT 
                id, tenant_id, title, due_date, prep_date, work_days, estimated_minutes AS estimatedMinutes,
                created_by
            FROM items 
            WHERE 
                assigned_to = ?
                AND (
                    (due_date >= ? AND due_date <= ?)
                    OR
                    (prep_date >= ? AND prep_date <= ?)
                )
                AND status NOT IN ('decision_rejected', 'archive', 'done')
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            $targetUserId,
            $rangeStart,
            $rangeEnd,
            $prepStart,
            $prepEnd
        ]);
        
        $rawItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $result = [];

        foreach ($rawItems as $item) {
            // Masking Logic
            $isVisible = false;
            
            if ($this->currentUserId === $targetUserId && !$this->currentTenantId) {
                // Viewing my own stuff in Personal Mode -> See everything
                $isVisible = true;
            } elseif ($item['tenant_id'] === $this->currentTenantId && $this->currentTenantId) {
                // Shared Context (Company Match) -> Visible
                $isVisible = true;
            } elseif ($this->currentUserId === $targetUserId && is_null($item['tenant_id']) && $item['created_by'] === $this->currentUserId) {
                // Personal items are visible to me even in company mode?
                // Spec says: Unified Dashboard shows all. 
                // But Load Calendar (for calculating volume) shows quantity.
                // If I am looking at my own calendar, I should see titles.
                $isVisible = true;
            } else {
                // Others viewing me, or Company View of Personal Task
                // Actually, if I am looking at my own stuff, I want to see it.
                // Masking is for OTHERS viewing ME.
                if ($this->currentUserId === $targetUserId) {
                    $isVisible = true;
                }
            }

            if ($isVisible) {
                $result[] = $item;
            } else {
                // Masked
                $result[] = [
                    'id' => $item['id'],
                    'title' => '予定あり (Private)',
                    'due_date' => $item['due_date'], // Maintain Date
                    'prep_date' => $item['prep_date'],
                    'estimatedMinutes' => $item['estimatedMinutes'], // Maintain Load
                    'isMasked' => true
                ];
            }
        }

        return $result;
    }
}
