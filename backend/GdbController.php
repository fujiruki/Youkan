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
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.status NOT IN ('confirmed', 'today_commit', 'execution_in_progress', 'execution_paused', 'done', 'decision_rejected', 'archive')
                AND (
                    items.status = 'inbox' 
                    OR (items.rdd_date IS NOT NULL AND items.rdd_date <= :now)
                )
            ORDER BY items.rdd_date ASC, items.created_at DESC
        ";
        
        $stmtActive = $this->pdo->prepare($sqlActive);
        $stmtActive->execute([':now' => $now]);
        $stmtActive->execute([':now' => $now]);
        $activeItems = array_map(['ItemController', 'mapRow'], $stmtActive->fetchAll(PDO::FETCH_ASSOC));

        // 2. Preparation Section (Formerly Hold)
        // Items that are explicitly held (status='decision_hold')
        // AND are NOT swept up by the Active query (i.e., their RDD is in future or null)
        // We can ensure exclusion by checking RDD > now or RDD is null.
        
        // Note: If an item is 'decision_hold' BUT rdd_date <= now, it appears in Active (Promoted).
        // This is Consistent with "Expose" logic.
        
        $sqlPrep = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                items.status = 'decision_hold'
                AND (items.rdd_date IS NULL OR items.rdd_date > :now)
            ORDER BY items.prep_date ASC, items.updated_at DESC
        ";
        
        $stmtPrep = $this->pdo->prepare($sqlPrep);
        $stmtPrep->execute([':now' => $now]);
        $stmtPrep->execute([':now' => $now]);
        $prepItems = array_map(['ItemController', 'mapRow'], $stmtPrep->fetchAll(PDO::FETCH_ASSOC));

        // 3. Intent Section (Nice to do)
        // status = 'intent'
        // Just a pool of ideas.
        $sqlIntent = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE items.status = 'intent' 
            ORDER BY items.updated_at DESC
        ";
        $intentItems = array_map(['ItemController', 'mapRow'], $this->pdo->query($sqlIntent)->fetchAll(PDO::FETCH_ASSOC));

        // 4. History Section (Log)
        // 'decision_rejected' (Did not do today / Declined)
        // 'decision_rejected' (Did not do today / Declined)
        $sqlLog = "
            SELECT items.*, parent.title as parent_title
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE items.status IN ('decision_rejected') 
            ORDER BY items.updated_at DESC 
            LIMIT 20
        ";
        $logItems = array_map(['ItemController', 'mapRow'], $this->pdo->query($sqlLog)->fetchAll(PDO::FETCH_ASSOC));

        return [
            'active' => $activeItems,      // Judgment
            'preparation' => $prepItems,   // Preparation (Blurry)
            'intent' => $intentItems,      // Intent (Shelf)
            'history' => $logItems         // History (Log)
        ];
    }
}
