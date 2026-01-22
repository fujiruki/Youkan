<?php
// backend/DocumentController.php
require_once 'BaseController.php';

class DocumentController extends BaseController {

    public function handleRequest($method, $id = null) {
        $this->authenticate(); // Enforce Tenant Scope

        if ($method === 'GET') {
            if ($id) {
                $this->show($id);
            } else {
                $projectId = $_GET['project_id'] ?? null;
                if (!$projectId) {
                    $this->sendError(400, 'Project ID is required');
                }
                $this->index($projectId);
            }
        } elseif ($method === 'POST') {
            // Check for custom actions
            $action = $_GET['action'] ?? null;
            if ($action === 'convert' && $id) {
                $this->convertToSales($id);
            } else {
                $this->create();
            }
        } elseif ($method === 'PUT' && $id) {
            $this->update($id);
        } elseif ($method === 'DELETE' && $id) {
            $this->delete($id);
        } else {
            $this->sendError(405, 'Method Not Allowed');
        }
    }

    // GET /api/documents?project_id=...
    private function index($projectId) {
        // [Security] Verify project belongs to tenant (Optional but recommended)
        
        $sql = "SELECT * FROM documents WHERE tenant_id = ? AND project_id = ? ORDER BY issue_date DESC, created_at DESC";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$this->currentTenantId, $projectId]);
        $docs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $this->sendJSON($docs);
    }

    // GET /api/documents/{id}
    private function show($id) {
        // 1. Fetch Header
        $sql = "SELECT * FROM documents WHERE id = ? AND tenant_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$id, $this->currentTenantId]);
        $doc = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$doc) {
            $this->sendError(404, 'Document not found');
        }

        // 2. Fetch Items
        $sqlItems = "SELECT * FROM document_items WHERE document_id = ? ORDER BY position ASC";
        $stmtItems = $this->pdo->prepare($sqlItems);
        $stmtItems->execute([$id]);
        $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

        // Decode JSONs
        if ($doc['snapshot_json']) $doc['snapshot_json'] = json_decode($doc['snapshot_json'], true);
        
        $doc['items'] = array_map(function($i) {
            if ($i['cost_detail_json']) $i['cost_detail_json'] = json_decode($i['cost_detail_json'], true);
            return $i;
        }, $items);

        $this->sendJSON($doc);
    }

    // POST /api/documents
    private function create() {
        $input = $this->getInput();
        if (empty($input['projectId']) || empty($input['type'])) {
            $this->sendError(400, 'ProjectID and Type are required');
        }

        $id = uniqid('doc_');
        $now = time();
        
        try {
            $this->pdo->beginTransaction();

            // 1. Insert Header
            $stmt = $this->pdo->prepare("INSERT INTO documents (
                id, tenant_id, project_id, type, status, issue_date, 
                total_amount, tax_rate, cost_total, profit_rate, snapshot_json, 
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $stmt->execute([
                $id,
                $this->currentTenantId,
                $input['projectId'],
                $input['type'], // 'estimate', 'sales'
                $input['status'] ?? 'draft',
                $input['issueDate'] ?? date('Y-m-d'),
                $input['totalAmount'] ?? 0,
                $input['taxRate'] ?? 0.1,
                $input['costTotal'] ?? 0,
                $input['profitRate'] ?? 0,
                isset($input['snapshot']) ? json_encode($input['snapshot']) : null,
                $this->currentUserId,
                $now, $now
            ]);

            // 2. Insert Items
            if (!empty($input['items']) && is_array($input['items'])) {
                $this->insertItems($id, $input['items']);
            }

            $this->pdo->commit();
            $this->sendJSON(['id' => $id, 'success' => true]);

        } catch (Exception $e) {
            $this->pdo->rollBack();
            $this->sendError(500, $e->getMessage());
        }
    }

    // PUT /api/documents/{id}
    private function update($id) {
        $input = $this->getInput();
        
        // Verify existence & ownership
        $stmt = $this->pdo->prepare("SELECT id FROM documents WHERE id = ? AND tenant_id = ?");
        $stmt->execute([$id, $this->currentTenantId]);
        if (!$stmt->fetch()) $this->sendError(404, 'Document not found');

        $now = time();

        try {
            $this->pdo->beginTransaction();

            // 1. Update Header
            // Should build dynamic query, but for now specific fields
            $updates = [];
            $params = [];
            
            $fields = ['status', 'issue_date', 'total_amount', 'tax_rate', 'cost_total', 'profit_rate'];
            // Camel to Snake mapping needed? Assuming input camelCase, db snake_case
            // Simple mapping:
            if (isset($input['status'])) { $updates[] = "status = ?"; $params[] = $input['status']; }
            if (isset($input['issueDate'])) { $updates[] = "issue_date = ?"; $params[] = $input['issueDate']; }
            if (isset($input['totalAmount'])) { $updates[] = "total_amount = ?"; $params[] = $input['totalAmount']; }
            if (isset($input['taxRate'])) { $updates[] = "tax_rate = ?"; $params[] = $input['taxRate']; }
            // ... (add others as needed)
            
            if (isset($input['snapshot'])) {
                 $updates[] = "snapshot_json = ?";
                 $params[] = json_encode($input['snapshot']);
            }
            
            if (!empty($updates)) {
                $updates[] = "updated_at = ?";
                $params[] = $now;
                $params[] = $id; // WHERE id = ?
                
                $sql = "UPDATE documents SET " . implode(', ', $updates) . " WHERE id = ?";
                $this->pdo->prepare($sql)->execute($params);
            }

            // 2. Update Items (Full Replace Strategy for simplicity in Documents)
            if (isset($input['items']) && is_array($input['items'])) {
                $this->pdo->prepare("DELETE FROM document_items WHERE document_id = ?")->execute([$id]);
                $this->insertItems($id, $input['items']);
            }

            $this->pdo->commit();
            $this->sendJSON(['success' => true]);

        } catch (Exception $e) {
            $this->pdo->rollBack();
            $this->sendError(500, $e->getMessage());
        }
    }

    // POST /api/documents/{id}?action=convert
    // Copies an Estimate to create a Sales document (Snapshot)
    private function convertToSales($sourceId) {
        // 1. Fetch Source
        $sql = "SELECT * FROM documents WHERE id = ? AND tenant_id = ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$sourceId, $this->currentTenantId]);
        $source = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$source) $this->sendError(404, 'Source document not found');

        // 2. Create Target
        $newId = uniqid('doc_');
        $now = time();

        try {
            $this->pdo->beginTransaction();

            // Header Copy
            $stmt = $this->pdo->prepare("INSERT INTO documents (
                id, tenant_id, project_id, type, status, issue_date, 
                total_amount, tax_rate, cost_total, profit_rate, snapshot_json, 
                created_by, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");

            $stmt->execute([
                $newId,
                $this->currentTenantId,
                $source['project_id'],
                'sales', // Force type to Sales
                'draft', // New status
                date('Y-m-d'), // New issue date
                $source['total_amount'],
                $source['tax_rate'],
                $source['cost_total'],
                $source['profit_rate'],
                $source['snapshot_json'], // Copy snapshot
                $this->currentUserId,
                $now, $now
            ]);

            // Items Copy
            $sqlItems = "SELECT * FROM document_items WHERE document_id = ?";
            $stmtItems = $this->pdo->prepare($sqlItems);
            $stmtItems->execute([$sourceId]);
            $items = $stmtItems->fetchAll(PDO::FETCH_ASSOC);

            foreach ($items as $item) {
                $itemId = uniqid('ditem_'); // New Item ID
                $itemStmt = $this->pdo->prepare("INSERT INTO document_items (
                    id, tenant_id, document_id, name, quantity, unit_price, cost_detail_json, position
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)");
                
                $itemStmt->execute([
                    $itemId,
                    $this->currentTenantId,
                    $newId,
                    $item['name'],
                    $item['quantity'],
                    $item['unit_price'],
                    $item['cost_detail_json'],
                    $item['position']
                ]);
            }

            $this->pdo->commit();
            $this->sendJSON(['id' => $newId, 'success' => true]);

        } catch (Exception $e) {
            $this->pdo->rollBack();
            $this->sendError(500, $e->getMessage());
        }
    }
    
    // Delete
    private function delete($id) {
         $stmt = $this->pdo->prepare("SELECT id FROM documents WHERE id = ? AND tenant_id = ?");
         $stmt->execute([$id, $this->currentTenantId]);
         if (!$stmt->fetch()) $this->sendError(404, 'Document not found');
         
         $this->pdo->prepare("DELETE FROM document_items WHERE document_id = ?")->execute([$id]);
         $this->pdo->prepare("DELETE FROM documents WHERE id = ?")->execute([$id]);
         $this->sendJSON(['success' => true]);
    }

    private function insertItems($docId, $items) {
        $sql = "INSERT INTO document_items (
            id, tenant_id, document_id, name, quantity, unit_price, cost_detail_json, position
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        $stmt = $this->pdo->prepare($sql);

        $pos = 0;
        foreach ($items as $item) {
            $itemId = $item['id'] ?? uniqid('ditem_');
            $costJson = isset($item['costDetail']) ? json_encode($item['costDetail']) : null;
            
            $stmt->execute([
                $itemId,
                $this->currentTenantId,
                $docId,
                $item['name'],
                $item['quantity'] ?? 1,
                $item['unitPrice'] ?? 0,
                $costJson,
                $pos++
            ]);
        }
    }
}
