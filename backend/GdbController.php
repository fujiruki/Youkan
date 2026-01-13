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
        
        // 1. Active Section (Judgment Candidates)
        // Strictly purely "Exposing" items that need attention. No DB status change.
        // Include:
        // - Inbox items (status='inbox')
        // - Items where RDD has arrived (rdd_date <= now) regardless of previous hold status (re-surface)
        // Exclude:
        // - Today confirmed items, Execution items, Done/Archive items.
        // - Rejected items (History)
        
        $sqlActive = "
            SELECT * FROM items 
            WHERE 
                status NOT IN ('confirmed', 'today_commit', 'execution_in_progress', 'execution_paused', 'done', 'decision_rejected', 'archive')
                AND (
                    status = 'inbox' 
                    OR (rdd_date IS NOT NULL AND rdd_date <= :now)
                )
            ORDER BY rdd_date ASC, created_at DESC
        ";
        
        $stmtActive = $this->pdo->prepare($sqlActive);
        $stmtActive->execute([':now' => $now]);
        $activeItems = $stmtActive->fetchAll(PDO::FETCH_ASSOC);

        // 2. Preparation Section (Formerly Hold)
        // Items that are explicitly held (status='decision_hold')
        // AND are NOT swept up by the Active query (i.e., their RDD is in future or null)
        // We can ensure exclusion by checking RDD > now or RDD is null.
        
        // Note: If an item is 'decision_hold' BUT rdd_date <= now, it appears in Active (Promoted).
        // This is Consistent with "Expose" logic.
        
        $sqlPrep = "
            SELECT * FROM items 
            WHERE 
                status = 'decision_hold'
                AND (rdd_date IS NULL OR rdd_date > :now)
            ORDER BY prep_date ASC, updated_at DESC
        ";
        
        $stmtPrep = $this->pdo->prepare($sqlPrep);
        $stmtPrep->execute([':now' => $now]);
        $prepItems = $stmtPrep->fetchAll(PDO::FETCH_ASSOC);

        // 3. Intent Section (Nice to do)
        // status = 'intent'
        // Just a pool of ideas.
        $sqlIntent = "SELECT * FROM items WHERE status = 'intent' ORDER BY updated_at DESC";
        $intentItems = $this->pdo->query($sqlIntent)->fetchAll(PDO::FETCH_ASSOC);

        // 4. History Section (Log)
        // 'decision_rejected' (Did not do today / Declined)
        $sqlLog = "SELECT * FROM items WHERE status IN ('decision_rejected') ORDER BY updated_at DESC LIMIT 20";
        $logItems = $this->pdo->query($sqlLog)->fetchAll(PDO::FETCH_ASSOC);

        return [
            'active' => $activeItems,      // Judgment
            'preparation' => $prepItems,   // Preparation (Blurry)
            'intent' => $intentItems,      // Intent (Shelf)
            'history' => $logItems         // History (Log)
        ];
    }
}
