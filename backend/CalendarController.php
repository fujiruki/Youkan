<?php
// backend/CalendarController.php

class CalendarController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Get monthly load (estimated minutes sum per day).
     * Query: ?year=YYYY&month=M
     */
    public function getLoad($params) {
        $year = isset($params['year']) ? intval($params['year']) : intval(date('Y'));
        $month = isset($params['month']) ? intval($params['month']) : intval(date('n'));

        // Calculate start and end of the month
        // We select strictly within the month string matches
        $startDate = sprintf('%04d-%02d-01', $year, $month);
        $endDate = date('Y-m-t', strtotime($startDate));

        // Query: Sum estimatedMinutes for active items grouped by due_date
        // We exclude 'done', 'archive', 'decision_rejected'? 
        // -> User wants volume visualization. Closed tasks also contributed to volume if we look at past?
        // -> But usually we look forward.
        // -> Let's include everything that is NOT 'decision_rejected' (Abandoned). 
        //    Even 'done' tasks occupied that day.
        //    Actually, for planning future, we care about 'what is assigned'.
        
        $sql = "
            SELECT 
                due_date, 
                SUM(estimatedMinutes) as total_minutes
            FROM items 
            WHERE 
                due_date >= :start_date 
                AND due_date <= :end_date
                AND status NOT IN ('decision_rejected', 'archive')
            GROUP BY due_date
        ";

        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            ':start_date' => $startDate,
            ':end_date' => $endDate
        ]);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Transform to simple key-value map
        // "2026-01-20": 480
        $result = [];
        foreach ($rows as $row) {
            $result[$row['due_date']] = intval($row['total_minutes']);
        }

        return $result;
    }
}
