<?php
// backend/LogController.php
require_once 'BaseController.php';

class LogController extends BaseController {

    // POST /api/logs/life
    public function createLifeLog() {
        $this->authenticate();
        $data = $this->getInput();

        $uuid = uniqid('log_', true);
        $today = date('Y-m-d');
        $now = time();

        // category: 'life' or from input
        $category = $data['category'] ?? 'life';
        $content = $data['content'] ?? ($data['id'] ?? 'Unknown Life Act');

        $stmt = $this->pdo->prepare("
            INSERT INTO daily_logs (id, date, category, content, created_at, project_id, tenant_id, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ");
        
        // Optional: Link life logs to a 'Life Project' if needed? For now, null or from input.
        $projectId = $data['project_id'] ?? null;

        $stmt->execute([
            $uuid,
            $today,
            $category,
            $content,
            $now,
            $projectId,
            $this->currentTenantId,
            $this->currentUserId
        ]);

        $this->sendJSON(['success' => true, 'id' => $uuid]);
    }

    // POST /api/logs/execution
    public function createExecutionLog() {
        $this->authenticate();
        $data = $this->getInput();

        if (empty($data['item_id']) && empty($data['content'])) {
            $this->sendError(400, 'item_id or content is required');
        }

        $uuid = uniqid('exec_', true);
        $today = date('Y-m-d');
        $now = time();

        $itemId = $data['item_id'] ?? null;
        $projectId = $data['project_id'] ?? null;
        $duration = $data['duration_minutes'] ?? 0;
        $profitShare = $data['gross_profit_share'] ?? 0;

        // Fetch title if item_id is present and content is missing
        $content = $data['content'] ?? null;
        if (!$content && $itemId) {
            // Verify Item Ownership/Tenancy
            $stmt = $this->pdo->prepare("SELECT title FROM items WHERE id = ? AND tenant_id = ?");
            $stmt->execute([$itemId, $this->currentTenantId]);
            $title = $stmt->fetchColumn();
            
            if (!$title) {
                 // Item not found in tenant or at all.
                 // We could error out, or just log as "Unknown Item" to avoid breakage?
                 // Let's allow it but warn.
                 $content = "Unknown Item Log";
            } else {
                 $content = "[Done] $title";
            }
        }

        $stmt = $this->pdo->prepare("
            INSERT INTO daily_logs (
                id, date, category, content, created_at, 
                project_id, item_id, duration_minutes, gross_profit_share,
                tenant_id, created_by
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");

        $stmt->execute([
            $uuid,
            $today,
            'execution',
            $content,
            $now,
            $projectId,
            $itemId,
            $duration,
            $profitShare,
            $this->currentTenantId,
            $this->currentUserId
        ]);

        $this->sendJSON(['success' => true, 'id' => $uuid]);
    }
}
