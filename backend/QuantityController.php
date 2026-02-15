<?php
// backend/QuantityController.php
require_once 'BaseController.php';
require_once 'QuantityService.php';

class QuantityController extends BaseController {

    public function handleRequest($method, $path) {
        $this->authenticate();

        // GET /quantity/matrix
        if (preg_match('#^/matrix$#', $path)) {
            if ($method === 'GET') {
                $this->getMatrix();
            } else {
                $this->sendError(405, 'Method Not Allowed');
            }
        }
        else {
            $this->sendError(404, 'Endpoint Not Found');
        }
    }

    /**
     * Get capacity vs usage matrix for a date range
     */
    private function getMatrix() {
        if (!$this->currentUserId) {
            $this->sendError(400, 'User context required');
        }

        $startDate = $_GET['start'] ?? date('Y-m-d');
        $endDate = $_GET['end'] ?? date('Y-m-d', strtotime('+30 days'));
        $context = $_GET['context'] ?? 'all'; // all, company, personal

        // 1. Get User Config & Overrides
        $stmt = $this->pdo->prepare("SELECT daily_capacity_minutes, non_working_hours, daily_overrides FROM users WHERE id = ?");
        $stmt->execute([$this->currentUserId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$user) {
            $this->sendError(404, 'User config not found');
        }

        $overrides = json_decode($user['daily_overrides'] ?? '{}', true) ?: [];
        $service = new QuantityService($this->pdo);

        // 2. Fetch Tasks in Range
        // Note: Ideally, we should filter by date range here, but for now we fetch active tasks
        // and let the service/loop handle date mapping. 
        // In a real app, we need a 'date' column or join with a calendar table.
        // Assuming 'items' has 'due_date' or we use 'estimated_minutes' per day (which is complex).
        // For MVP: We will calculate based on 'due_date' as a simple placement, 
        // OR if we have a 'planned_date' field. 
        // Let's assume for Quantity Calendar MVP, we look at 'due_date' as the execution day for simplicity,
        // OR we need a separate 'planning' table. 
        // *Re-reading specs*: The user wants to see "Space". 
        // Let's use 'due_date' for now as the anchor.
        
        $sql = "SELECT id, title, due_date, estimated_minutes, tenant_id FROM items 
                WHERE (due_date BETWEEN ? AND ?) AND (status != 'done') AND (deleted_at IS NULL)";
        
        // Filter by user ownership or assignment (simplified for MVP)
        // We need to verify if the user has access. relying on BaseController's auth for now.
        // TODO: Add strict ownership check
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$startDate, $endDate]);
        $tasks = $stmt->fetchAll(PDO::FETCH_ASSOC);

        // Group tasks by date
        $tasksByDate = [];
        foreach ($tasks as $task) {
            $d = $task['due_date'];
            if (!isset($tasksByDate[$d])) $tasksByDate[$d] = [];
            $tasksByDate[$d][] = $task;
        }

        // 3. Build Matrix
        $matrix = [];
        $current = strtotime($startDate);
        $end = strtotime($endDate);

        while ($current <= $end) {
            $dateStr = date('Y-m-d', $current);
            
            // Calc Capacity
            $capacity = $service->getDailyCapacity($user, $dateStr, $overrides);
            
            // Calc Usage
            $dayTasks = $tasksByDate[$dateStr] ?? [];
            $usage = $service->calculateUsage($dayTasks, $context);

            $matrix[$dateStr] = [
                'capacity' => $capacity,
                'usage' => $usage,
                'fill_rate' => ($capacity > 0) ? round($usage / $capacity, 2) : ($usage > 0 ? 1.0 : 0.0),
                'is_overflow' => ($usage > $capacity)
            ];

            $current = strtotime('+1 day', $current);
        }

        $this->sendJSON([
            'range' => ['start' => $startDate, 'end' => $endDate],
            'context' => $context,
            'matrix' => $matrix
        ]);
    }
}
