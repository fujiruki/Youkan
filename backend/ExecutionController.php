<?php
// backend/ExecutionController.php

require_once 'BaseController.php';
require_once 'EventService.php';

class ExecutionController extends BaseController {
    private $eventService;

    public function __construct() { // BaseController creates $this->pdo
        parent::__construct();
        $this->eventService = new EventService($this->pdo);
    }

    public function start($id) {
        $this->authenticate();
        $this->eventService->logIn('ExecutionStarted', ['item_id' => $id]);
        
        // Logic: 
        // 1. Pause any other 'execution_in_progress' items for this user? (Single Tasking)
        // For simplicity: Yes.
        $this->pauseAllOthers($id);

        $stmt = $this->pdo->prepare("UPDATE items SET status = 'execution_in_progress', status_updated_at = ?, updated_at = ? WHERE id = ?");
        $now = time();
        $stmt->execute([$now, $now, $id]);

        return ['success' => true, 'id' => $id, 'status' => 'execution_in_progress'];
    }

    public function pause($id) {
        $this->authenticate();
        $this->eventService->logIn('ExecutionPaused', ['item_id' => $id]);

        $stmt = $this->pdo->prepare("UPDATE items SET status = 'execution_paused', status_updated_at = ?, updated_at = ? WHERE id = ?");
        $now = time();
        $stmt->execute([$now, $now, $id]);

        return ['success' => true, 'id' => $id, 'status' => 'execution_paused'];
    }

    private function pauseAllOthers($currentId) {
        // Find items in progress that are NOT currentId
        // Scope: Personal or Tenant?
        // Ideally should match current context.
        // Assuming strict single tasking within Tenant.
        $tenantId = $this->currentTenantId;
        
        if ($tenantId) {
             $sql = "UPDATE items SET status = 'execution_paused', updated_at = ? WHERE tenant_id = ? AND status = 'execution_in_progress' AND id != ?";
             $params = [time(), $tenantId, $currentId];
        } else {
             $sql = "UPDATE items SET status = 'execution_paused', updated_at = ? WHERE tenant_id IS NULL AND created_by = ? AND status = 'execution_in_progress' AND id != ?";
             $params = [time(), $this->currentUserId, $currentId];
        }
        $this->pdo->prepare($sql)->execute($params);
    }
}
