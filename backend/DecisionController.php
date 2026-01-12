<?php
// backend/DecisionController.php

require_once 'EventService.php';

class DecisionController {
    private $pdo;
    private $eventService;

    public function __construct($pdo) {
        $this->pdo = $pdo;
        $this->eventService = new EventService($pdo);
    }

    /**
     * Resolve a decision (Yes/Hold/No).
     * 
     * @param string $id Item ID
     * @param array $data ['decision' => 'yes'|'hold'|'no', 'note' => string]
     */
    public function resolve($id, $data) {
        $decision = $data['decision'] ?? null;
        if (!in_array($decision, ['yes', 'hold', 'no'])) {
            throw new Exception("Invalid decision type: $decision");
        }

        $this->pdo->beginTransaction();
        try {
            // 1. Log Event
            $this->eventService->logIn('DecisionResolved', [
                'item_id' => $id,
                'decision' => $decision,
                'note' => $data['note'] ?? '',
                'rdd_snapshot' => $data['rdd'] ?? null // Record what RDD was visible
            ]);

            // 2. Update Item Status (Domain Logic)
            $newStatus = '';
            switch ($decision) {
                case 'yes':
                    $newStatus = 'confirmed'; // Ready for Today
                    break;
                case 'hold':
                    $newStatus = 'decision_hold';
                    break;
                case 'no':
                    $newStatus = 'decision_rejected';
                    break;
            }

            $stmt = $this->pdo->prepare("UPDATE items SET status = ?, status_updated_at = ?, updated_at = ? WHERE id = ?");
            $now = time();
            $stmt->execute([$newStatus, $now, $now, $id]);

            $this->pdo->commit();

            return ['success' => true, 'id' => $id, 'new_status' => $newStatus];

        } catch (Exception $e) {
            $this->pdo->rollBack();
            throw $e;
        }
    }
}
