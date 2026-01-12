<?php
// backend/LifeController.php

require_once 'db.php';

class LifeController {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * 生活活動を記録 (POST /api/life/{id}/check)
     */
    public function checkLife($id) {
        // ID format: life-category-action (e.g., life-routine-clean)
        // Parse category and content from ID or keep as is?
        // Let's assume ID maps to a defined Life item on frontend, but we store the act.
        
        $stmt = $this->pdo->prepare("
            INSERT INTO daily_logs (id, date, category, content, created_at)
            VALUES (:id, :date, :category, :content, :created_at)
        ");

        $uuid = uniqid('log_', true);
        $today = date('Y-m-d');
        $now = time();

        // Simple categorization logic based on ID prefix or passed payload
        // For now, assume ID is the content key.
        $category = 'life';
        $content = $id;

        $stmt->execute([
            ':id' => $uuid,
            ':date' => $today,
            ':category' => $category,
            ':content' => $content,
            ':created_at' => $now
        ]);

        return ['success' => true, 'id' => $uuid];
    }

    /**
     * 実行ブロック開始 (POST /api/execution/{id}/start)
     */
    public function startExecution($id) {
        // Log "Start" event to daily_logs
        return $this->logExecutionEvent($id, 'start');
    }

    /**
     * 実行ブロック中断/完了 (POST /api/execution/{id}/pause)
     */
    public function pauseExecution($id) {
        // Log "Pause" event
        // Calculate duration? For MVP, just log the timestamp.
        return $this->logExecutionEvent($id, 'pause');
    }

    private function logExecutionEvent($itemId, $action) {
        $stmt = $this->pdo->prepare("
            INSERT INTO daily_logs (id, date, category, content, created_at)
            VALUES (:id, :date, :category, :content, :created_at)
        ");

        $uuid = uniqid('exec_', true);
        $today = date('Y-m-d');
        $now = time();
        
        // Content format: "[Start] ItemTitle" ? We might need Item Title.
        // If we don't have title, just ID + Action.
        // Or fetch item title from DB?
        // Let's fetch item title for better logs.
        $title = $this->getItemTitle($itemId) ?? $itemId;
        $content = sprintf("[%s] %s", strtoupper($action), $title);

        $stmt->execute([
            ':id' => $uuid,
            ':date' => $today,
            ':category' => 'execution',
            ':content' => $content,
            ':created_at' => $now
        ]);

        return ['success' => true, 'id' => $uuid, 'action' => $action];
    }

    private function getItemTitle($itemId) {
        $stmt = $this->pdo->prepare("SELECT title FROM items WHERE id = :id");
        $stmt->execute([':id' => $itemId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ? $row['title'] : null;
    }

    /**
     * 履歴取得 (GET /api/history)
     * Limit 100 or paginated? MVP: Limit 100 recent.
     */
    public function getHistory() {
        $stmt = $this->pdo->prepare("
            SELECT * FROM daily_logs 
            ORDER BY created_at DESC 
            LIMIT 100
        ");
        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
