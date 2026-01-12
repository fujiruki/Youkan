<?php
// backend/GdbController.php

class GdbController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Get GDB Shelf View.
     * 
     * Responsibilities:
     * - Hide items that are technically "Scheduled" (future RDD).
     * - Show "Inbox" items (Rdd not set or unprocessed).
     * - Show "Decision" items (Rdd arrived).
     * - Show "Hold" items (Explicitly held).
     */
    public function getShelf() {
        $now = time();
        $todayStart = strtotime('today', $now);

        // 1. Active Section (Inbox + RDD Arrived)
        // - Inbox: status='inbox'
        // - Decision: status='decision_required' OR (rdd_date <= Today AND status != 'confirmed')
        // Actually, let's simplify status logic in Phase 1.
        // Current statuses in use: 'inbox', 'confirmed' (Today), 'today_commit', 'execution_*', 'done'.
        // We need a status logic for "Ready for Decision".
        
        // For now, let's fetch candidates:
        // - Inbox items
        // - Items with RDD set and <= Today, but NOT yet 'confirmed' or further.
        
        $sqlActive = "
            SELECT * FROM items 
            WHERE 
                status = 'inbox' 
                OR (
                    rdd_date IS NOT NULL 
                    AND rdd_date <= :now 
                    AND status NOT IN ('confirmed', 'today_commit', 'execution_in_progress', 'execution_paused', 'done', 'decision_hold', 'decision_rejected')
                )
            ORDER BY rdd_date ASC, created_at DESC
        ";
        $stmtActive = $this->pdo->prepare($sqlActive);
        $stmtActive->execute([':now' => $now]); // If RDD is timestamp. If date string, adjust. Assuming timestamp for now as per migration.
        $activeItems = $stmtActive->fetchAll(PDO::FETCH_ASSOC);

        // 2. Hold Section
        $sqlHold = "SELECT * FROM items WHERE status = 'decision_hold' ORDER BY updated_at DESC";
        $holdItems = $this->pdo->query($sqlHold)->fetchAll(PDO::FETCH_ASSOC);

        // 3. Log (Archive) Section - Just recent decisions?
        // Maybe strict 'decision_rejected' or just recent history.
        // For the 'Shelf', usually we show 'decision_rejected' (No) or explicit 'done' (Yes/Finished) ?
        // Spec says: "Yes/No results history".
        // Let's return recent 'decision_rejected' (No) and maybe recent 'confirmed' (Yes) history for reference?
        // Prioritize 'decision_rejected' as they stay in GDB context usually.
        $sqlLog = "SELECT * FROM items WHERE status IN ('decision_rejected') ORDER BY updated_at DESC LIMIT 10";
        $logItems = $this->pdo->query($sqlLog)->fetchAll(PDO::FETCH_ASSOC);

        return [
            'active' => $activeItems,
            'hold' => $holdItems,
            'log' => $logItems
        ];
    }
}
