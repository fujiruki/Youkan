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
        // Zone 1: Commit (Status: today_commit)
        $commits = $this->pdo->query("SELECT * FROM items WHERE status = 'today_commit' ORDER BY sort_order ASC")->fetchAll(PDO::FETCH_ASSOC);

        // Zone 2: Execution (Status: execution_in_progress, execution_paused)
        // Rule: Only ONE active execution displayed, but we return all logic-wise active ones, 
        // frontend or this API should filter.
        // As per spec: "Only 1 displayed". Let's fetch all active and let frontend pick (or pick here).
        // Let's pick here to be "Smart Backend".
        
        // Priority: In Progress > Paused > Others
        // Actually, pure execution items are those moved from Commit.
        $executions = $this->pdo->query("SELECT * FROM items WHERE status IN ('execution_in_progress', 'execution_paused') ORDER BY updated_at DESC")->fetchAll(PDO::FETCH_ASSOC);

        // Zone 3: Life (From separate Storage or Table? Currently LifeChecklist is Client-side in MVP, 
        // but Plan says 'Independent'. For now, let's keep Life client-side or add simple table if needed.
        // Plan says: "Phase 3: Execution & Life Persistence". So for now in Phase 1, we might skip Life API unless requested.
        // But getToday should probably return structure.

        // Candidates for Today (Status: confirmed)
        $candidates = $this->pdo->query("SELECT * FROM items WHERE status = 'confirmed' ORDER BY rdd_date ASC")->fetchAll(PDO::FETCH_ASSOC);

        return [
            'commits' => $commits,
            'execution' => !empty($executions) ? $executions[0] : null, // Only return the Top 1
            'others_hidden' => array_slice($executions, 1), // Keep track of hidden ones
            'candidates' => $candidates
        ];
    }

    /**
     * Commit a candidate to Today (Max 2 Check).
     */
    public function commit($id) {
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
}
