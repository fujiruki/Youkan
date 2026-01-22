<?php
// backend/HistoryController.php
require_once 'BaseController.php';

class HistoryController extends BaseController {
    
    // GET /api/history/summary?month=2026-01
    public function getSummary() {
        $this->authenticate();
        $month = $_GET['month'] ?? date('Y-m'); // YYYY-MM
        
        // Sum duration by project
        $sql = "
            SELECT 
                l.project_id,
                p.name as project_name,
                p.color as project_color,
                SUM(l.duration_minutes) as total_minutes,
                COUNT(l.id) as log_count
            FROM daily_logs l
            LEFT JOIN projects p ON l.project_id = p.id
            WHERE substr(l.date, 1, 7) = ?
            GROUP BY l.project_id
        ";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$month]);
        $summary = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $this->sendJSON([
            'month' => $month,
            'summary' => $summary
        ]);
    }

    // GET /api/history/timeline?limit=100
    public function getTimeline() {
        $this->authenticate();
        $limit = isset($_GET['limit']) ? intval($_GET['limit']) : 100;
        
        $stmt = $this->pdo->prepare("
            SELECT l.*, p.name as project_name, p.color as project_color
            FROM daily_logs l
            LEFT JOIN projects p ON l.project_id = p.id
            ORDER BY l.created_at DESC
            LIMIT ?
        ");
        $stmt->bindValue(1, $limit, PDO::PARAM_INT);
        $stmt->execute();
        $this->sendJSON($stmt->fetchAll(PDO::FETCH_ASSOC));
    }
}
