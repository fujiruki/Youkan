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
     * Resolve a decision (Yes/Hold/Later/No).
     *
     * @param string $id Item ID
     * @param array $data ['decision' => 'yes'|'hold'|'later'|'no', 'note' => string]
     */
    public function resolve($id, $data) {
        $decision = $data['decision'] ?? null;
        if (!in_array($decision, ['yes', 'hold', 'later', 'no'])) {
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
            // R-124: 「断る」はcancelledへ統一（旧: decision_rejected）。フロント側の
            // decisionToStatus（logic/decisionResolution.ts）と同じ判断結果になるようにする
            // R-125: 「後日着手」(later)はtodoへ。「保留にする」(hold)は旧レガシー値
            // decision_holdの新規書き込みを廃止しpendingに統一（フロントのdecisionToStatusと一致）
            // R-125バグ修正: 「今日やる」(yes)は旧レガシー値confirmed（JudgmentStatus型外）を
            // 書き込んでいた。仕様§4.4.1（yes→focus）に合わせ、フロントのdecisionToStatusと一致させる
            $newStatus = '';
            switch ($decision) {
                case 'yes':
                    $newStatus = 'focus'; // Ready for Today
                    break;
                case 'later':
                    $newStatus = 'todo';
                    break;
                case 'hold':
                    $newStatus = 'pending';
                    break;
                case 'no':
                    $newStatus = 'cancelled';
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
