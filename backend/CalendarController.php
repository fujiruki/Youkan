<?php
// backend/CalendarController.php

class CalendarController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Get monthly items for Volume calculation by Frontend.
     * Returns raw items in the range, so frontend can apply the exact same logic as QuantityCalendar.
     * 
     * Query: ?year=YYYY&month=M
     */
    public function getLoad($params) {
        $year = isset($params['year']) ? intval($params['year']) : intval(date('Y'));
        $month = isset($params['month']) ? intval($params['month']) : intval(date('n'));

        // Target Month Range
        $startDateStr = sprintf('%04d-%02d-01', $year, $month);
        
        // Fetch items roughly in range.
        // Needs items that have Due Date in this month, 
        // OR Prep Date in this month or slightly after (bleeding back).
        // Let's fetch a wider range: -1 month to +2 months to be safe for Prep Date overlap.
        
        $rangeStart = date('Y-m-d', strtotime('-1 month', strtotime($startDateStr)));
        $rangeEnd = date('Y-m-d', strtotime('+2 months', strtotime($startDateStr)));
        $prepStart = strtotime($rangeStart); // prep_date is timestamp
        $prepEnd = strtotime($rangeEnd);

        // Fetch simplified item objects
        $sql = "
            SELECT 
                id, title, due_date, prep_date, work_days, estimated_minutes AS estimatedMinutes
            FROM items 
            WHERE 
                (
                    (due_date >= :r_start AND due_date <= :r_end)
                    OR
                    (prep_date >= :p_start AND prep_date <= :p_end)
                )
                AND status NOT IN ('decision_rejected', 'archive')
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':r_start' => $rangeStart,
            ':r_end' => $rangeEnd,
            ':p_start' => $prepStart,
            ':p_end' => $prepEnd
        ]);
        
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Return standardized JSON
        return $items;
    }
}
