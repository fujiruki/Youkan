<?php
// backend/TodayController.php

require_once 'EventService.php';

class TodayController {
    private $pdo;
    private $eventService;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->eventService = new EventService($pdo);
    }

    /**
     * Get Today's View (Commit + Execution + Life).
     */
    public function getToday() {
        // [New] Auto-reset "Intent Boost" items from previous days
        $this->resetExpiredBoosts();

        // Zone 1: Commit (Status: today_commit)
        $sqlCommits = "
            SELECT items.*, parent.title as parent_title 
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE items.status = 'today_commit' 
            ORDER BY items.sort_order ASC
        ";
        $commits = array_map(['ItemController', 'mapRow'], $this->pdo->query($sqlCommits)->fetchAll(PDO::FETCH_ASSOC));

        // Zone 2: Execution (Status: execution_in_progress, execution_paused)
        // Rule: Only ONE active execution displayed, but we return all logic-wise active ones, 
        // frontend or this API should filter.
        // As per spec: "Only 1 displayed". Let's fetch all active and let frontend pick (or pick here).
        // Let's pick here to be "Smart Backend".
        
        // Priority: In Progress > Paused > Others
        // Actually, pure execution items are those moved from Commit.
        $sqlExec = "
            SELECT items.*, parent.title as parent_title 
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE items.status IN ('execution_in_progress', 'execution_paused') 
            ORDER BY items.updated_at DESC
        ";
        $executionsRaw = $this->pdo->query($sqlExec)->fetchAll(PDO::FETCH_ASSOC);
        $executions = array_map(['ItemController', 'mapRow'], $executionsRaw);

        // Zone 3: Life (From separate Storage or Table? Currently LifeChecklist is Client-side in MVP, 
        // but Plan says 'Independent'. For now, let's keep Life client-side or add simple table if needed.
        // Plan says: "Phase 3: Execution & Life Persistence". So for now in Phase 1, we might skip Life API unless requested.
        // But getToday should probably return structure.

        // Candidates for Today (Status: confirmed)
        // Candidates for Today (Status: confirmed OR Intent Boosted)
        // Intent Boosted items appear here regardless of status (unless already committed/active/done)
        // Intent Boosted items appear here regardless of status (unless already committed/active/done)
        $sqlCandidates = "
            SELECT items.*, parent.title as parent_title 
            FROM items 
            LEFT JOIN items parent ON items.parent_id = parent.id
            WHERE 
                (items.status = 'confirmed') 
                OR 
                (items.is_boosted = 1 AND items.status NOT IN ('done', 'archive', 'today_commit', 'execution_in_progress', 'execution_paused'))
            ORDER BY items.is_boosted DESC, items.rdd_date ASC
        ";
        $candidates = array_map(['ItemController', 'mapRow'], $this->pdo->query($sqlCandidates)->fetchAll(PDO::FETCH_ASSOC));


        return [
            'commits' => $commits,
            'execution' => !empty($executions) ? $executions[0] : null, // Only return the Top 1
            'others_hidden' => array_slice($executions, 1), // Keep track of hidden ones
            'candidates' => $candidates
        ];
    }

    private function resetExpiredBoosts() {
        // Reset boosted status if the boosted date is before today (midnight)
        // JS sends timestamp in milliseconds, PHP time() is seconds.
        $todayStartMs = strtotime('today midnight') * 1000;
        
        $this->pdo->exec("UPDATE items SET is_boosted = 0, boosted_date = NULL WHERE is_boosted = 1 AND boosted_date < $todayStartMs");
    }

    /**
     * Commit a candidate to Today (Max 2 Check).
     */
    public function commit($id) {
        // ... existing commit logic ...
        // 1. Check current commits count
        $stmt = $this->pdo->query("SELECT COUNT(*) FROM items WHERE status = 'today_commit'");
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
            $stmt = $this->pdo->prepare("UPDATE items SET status = 'today_commit', status_updated_at = ?, updated_at = ? WHERE id = ?");
            $now = time();
            $stmt->execute([$now, $now, $id]);

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
        $this->pdo->beginTransaction();
        try {
            $this->eventService->logIn('TodayCompleted', ['item_id' => $id]);

            $stmt = $this->pdo->prepare("UPDATE items SET status = 'done', status_updated_at = ?, updated_at = ? WHERE id = ?");
            $now = time();
            $stmt->execute([$now, $now, $id]);

            $this->pdo->commit();
            return ['success' => true, 'id' => $id, 'new_status' => 'done'];
        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
