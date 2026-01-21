<?php
// backend/CalendarController.php

class CalendarController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Get monthly load (Volume Index per day).
     * Mimics QuantityCalendar logic:
     * - Due Date adds +1.0
     * - Working Days span (backwards from Prep Date) adds +1.0 per day (skipping weekends)
     * 
     * Query: ?year=YYYY&month=M
     */
    public function getLoad($params) {
        $year = isset($params['year']) ? intval($params['year']) : intval(date('Y'));
        $month = isset($params['month']) ? intval($params['month']) : intval(date('n'));

        // Target Month Range
        $startDateStr = sprintf('%04d-%02d-01', $year, $month);
        $endDateStr = date('Y-m-t', strtotime($startDateStr));
        
        // Fetch candidates:
        // 1. Items with due_date in this month
        // 2. Items with prep_date in this month OR slightly after (since work days go backwards)
        // To be safe, look ahead 1 month for prep_date candidates that might bleed back into this month.
        $lookAheadDateStr = date('Y-m-t', strtotime('+1 month', strtotime($startDateStr)));

        // Fetch items
        // Exclude 'decision_rejected', 'archive'. Include 'done'?
        // QuantityCalendar typically hides 'archive' but might show 'done' if still relevant?
        // Let's exclude only abandoned stuff for now.
        $sql = "
            SELECT 
                id, title, due_date, prep_date, work_days, estimatedMinutes
            FROM items 
            WHERE 
                (due_date >= :start_date AND due_date <= :end_date)
                OR
                (prep_date >= :prep_start_ts AND prep_date <= :prep_end_ts)
                AND status NOT IN ('decision_rejected', 'archive')
        ";

        // Convert dates to timestamps for SQL comparison where needed
        // due_date is string YYYY-MM-DD
        // prep_date is int timestamp
        // Wait, items table might have mixed access, but usually due_date is string.
        // Actually, let's just fetch a wider range to be safe and filter in PHP.
        // Fetching "Active" items is safer.
        
        $stmt = $this->pdo->prepare("
            SELECT id, due_date, prep_date, work_days, estimatedMinutes 
            FROM items 
            WHERE status NOT IN ('decision_rejected', 'archive')
        ");
        $stmt->execute();
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $volumeMap = []; // "YYYY-MM-DD" => float

        foreach ($items as $item) {
            // 1. Due Date Volume
            if (!empty($item['due_date'])) {
                $this->addVolume($volumeMap, $item['due_date'], 1.0);
            }

            // 2. Prep Date Span Volume
            if (!empty($item['prep_date'])) {
                $prepTs = intval($item['prep_date']);
                
                // Calculate Work Days (Fallback to estimatedMinutes / 420)
                $workDays = 1;
                if (!empty($item['work_days']) && $item['work_days'] > 1) {
                    $workDays = intval($item['work_days']);
                } else if (!empty($item['estimatedMinutes'])) {
                    $mins = intval($item['estimatedMinutes']);
                    if ($mins > 0) {
                        $workDays = ceil($mins / 420); // 7 hours/day
                    }
                }
                
                // Backward Simulation
                $currentTs = $prepTs;
                $count = 0;
                $safety = 0;

                while ($count < $workDays && $safety < 30) {
                    $safety++;
                    
                    // Check Holiday (Simple Weekend Check: Sat=6, Sun=7)
                    // Note: date('N') returns 1(Mon) to 7(Sun)
                    $dayOfWeek = date('N', $currentTs);
                    $isWeekend = ($dayOfWeek >= 6);

                    if (!$isWeekend) {
                        $dateKey = date('Y-m-d', $currentTs);
                        $this->addVolume($volumeMap, $dateKey, 1.0);
                        $count++;
                    }

                    // Move back 1 day
                    $currentTs -= 86400;
                }
            }
        }

        // Filter result to requested month only? 
        // Or return everything? The UI only renders the current month anyway.
        // Returning relevant keys is fine.
        
        // Filter to reduce payload size
        $finalResult = [];
        $startTs = strtotime($startDateStr);
        $endTs = strtotime($endDateStr);

        foreach ($volumeMap as $date => $vol) {
            $ts = strtotime($date);
            if ($ts >= $startTs && $ts <= $endTs) {
                $finalResult[$date] = $vol;
            }
        }

        return $finalResult;
    }

    private function addVolume(&$map, $date, $amount) {
        if (!isset($map[$date])) {
            $map[$date] = 0.0;
        }
        $map[$date] += $amount;
    }
}
