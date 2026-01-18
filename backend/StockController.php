<?php
// backend/StockController.php

require_once 'db.php';

class StockController {
    private $pdo;

    public function __construct() {
        $this->pdo = getDB();
    }

    // POST /api/stocks
    public function create() {
        $data = json_decode(file_get_contents('php://input'), true);
        
        $stmt = $this->pdo->prepare("INSERT INTO stocks (id, title, project_id, estimated_minutes, due_date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
        
        $id = $data['id'] ?? uniqid();
        $now = time();
        
        $stmt->execute([
            $id,
            $data['title'],
            $data['project_id'] ?? null,
            $data['estimated_minutes'] ?? 0,
            $data['due_date'] ?? null,
            'open',
            $now
        ]);
        
        echo json_encode(['status' => 'success', 'id' => $id]);
    }

    // GET /api/stocks
    public function index() {
        $stmt = $this->pdo->query("SELECT * FROM stocks WHERE status = 'open' ORDER BY created_at DESC");
        $stocks = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode($stocks);
    }
    
    // PUT /api/stocks/{id}
    public function update($id) {
        $data = json_decode(file_get_contents('php://input'), true);
        
        // Dynamic update
        $fields = [];
        $values = [];
        
        if (isset($data['status'])) { $fields[] = "status = ?"; $values[] = $data['status']; }
        if (isset($data['project_id'])) { $fields[] = "project_id = ?"; $values[] = $data['project_id']; }
        // Add other fields as needed
        
        if (empty($fields)) {
            echo json_encode(['status' => 'error', 'message' => 'No fields to update']);
            return;
        }
        
        $values[] = $id; // For WHERE clause
        $sql = "UPDATE stocks SET " . implode(", ", $fields) . " WHERE id = ?";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($values);
        
        echo json_encode(['status' => 'success']);
    }

    // POST /api/stocks/{id}/assign
    public function assign($id) {
        $data = json_decode(file_get_contents('php://input'), true);
        $userId = $data['userId'] ?? null;
        $date = $data['date'] ?? null; // Optional: Assign to specific date immediately?
        
        if (!$userId) {
            http_response_code(400);
            echo json_encode(['error' => 'userId is required']);
            return;
        }

        try {
            $this->pdo->beginTransaction();

            // 1. Get Stock
            $stmt = $this->pdo->prepare("SELECT * FROM stocks WHERE id = ?");
            $stmt->execute([$id]);
            $stock = $stmt->fetch(PDO::FETCH_ASSOC);

            if (!$stock) {
                throw new Exception("Stock not found");
            }

            // 2. Create Item (Task)
            // item ID should probably be new UUID, or keep the same ID? 
            // It's better to have new ID to avoid conflict if table structures differ.
            // But for traceability, maybe link them.
            $itemId = uniqid(); // Or crypto UUID
            
            // Insert into items
            // Note: We need to map Stock fields to Item fields
            // stocks.title -> items.title
            // stocks.estimated_minutes -> items.estimated_minutes
            // stocks.project_id -> items.parent_id (if project) or items.project_id (if just category/context)
            // For now, let's assume direct mapping.
            
            $sql = "INSERT INTO items (
                id, title, status, created_at, updated_at, 
                estimated_minutes, assigned_to, project_category
            ) VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?)";
            
            $now = time();
            $stmtItem = $this->pdo->prepare($sql);
            $stmtItem->execute([
                $itemId,
                $stock['title'],
                $now, $now,
                $stock['estimated_minutes'],
                $userId,
                $stock['project_id'] // Assuming project_id in Stock maps to project_category (or similar context) in Item
            ]);

            // 3. Update Stock status
            $stmtUpdate = $this->pdo->prepare("UPDATE stocks SET status = 'assigned' WHERE id = ?");
            $stmtUpdate->execute([$id]);

            $this->pdo->commit();
            echo json_encode(['status' => 'success', 'itemId' => $itemId]);

        } catch (Exception $e) {
            $this->pdo->rollBack();
            http_response_code(500);
            echo json_encode(['error' => $e->getMessage()]);
        }
    }
}
}
