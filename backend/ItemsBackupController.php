<?php
// backend/ItemsBackupController.php
// ユーザー個人のitemsをJSON形式でエクスポート/インポートするコントローラー

class ItemsBackupController {
    private $pdo;
    private $userId;

    public function __construct(PDO $pdo, ?string $userId = null) {
        $this->pdo = $pdo;
        $this->userId = $userId;
    }

    /**
     * Export user's items as JSON file
     */
    public function export() {
        if (!$this->userId) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required']);
            return;
        }

        try {
            // Get all items where tenant_id is NULL (personal items) OR created by this user
            $stmt = $this->pdo->prepare("
                SELECT * FROM items 
                WHERE (tenant_id IS NULL AND user_id = :user_id)
                   OR (user_id = :user_id2)
                ORDER BY created_at ASC
            ");
            $stmt->execute([
                ':user_id' => $this->userId,
                ':user_id2' => $this->userId
            ]);
            $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Create backup data structure
            $backupData = [
                'version' => '1.0',
                'exported_at' => date('c'),
                'user_id' => $this->userId,
                'item_count' => count($items),
                'items' => $items
            ];

            $filename = 'items_backup_' . date('Y-m-d_H-i-s') . '.json';
            $jsonContent = json_encode($backupData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);

            header('Content-Type: application/json');
            header('Content-Disposition: attachment; filename="' . $filename . '"');
            header('Content-Length: ' . strlen($jsonContent));
            header('Cache-Control: no-cache, no-store, must-revalidate');

            echo $jsonContent;
            exit;

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Export failed: ' . $e->getMessage()]);
        }
    }

    /**
     * Import items from JSON file (additive mode - does not delete existing items)
     */
    public function import() {
        if (!$this->userId) {
            http_response_code(401);
            echo json_encode(['error' => 'Authentication required']);
            return;
        }

        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed']);
            return;
        }

        if (!isset($_FILES['backup_file']) || $_FILES['backup_file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid file uploaded']);
            return;
        }

        try {
            $content = file_get_contents($_FILES['backup_file']['tmp_name']);
            $backupData = json_decode($content, true);

            if (!$backupData || !isset($backupData['items']) || !is_array($backupData['items'])) {
                http_response_code(400);
                echo json_encode(['error' => 'Invalid backup file format']);
                return;
            }

            $importedCount = 0;
            $skippedCount = 0;
            $errorCount = 0;

            // UUID v7 generator function (simplified)
            $generateUuid = function() {
                $timestamp = (int)(microtime(true) * 1000);
                $timestampHex = str_pad(dechex($timestamp), 12, '0', STR_PAD_LEFT);
                $randomHex = bin2hex(random_bytes(10));
                $uuid = substr($timestampHex, 0, 8) . '-' .
                        substr($timestampHex, 8, 4) . '-7' .
                        substr($randomHex, 0, 3) . '-' .
                        dechex(8 + (hexdec(substr($randomHex, 3, 1)) & 3)) .
                        substr($randomHex, 4, 3) . '-' .
                        substr($randomHex, 7, 12);
                return $uuid;
            };

            $this->pdo->beginTransaction();

            foreach ($backupData['items'] as $item) {
                try {
                    // Generate new UUID for imported item to avoid conflicts
                    $newId = $generateUuid();
                    
                    // Map old parent_id to null if exists (can't reliably map relations)
                    // For simplicity, imported items go to root level
                    
                    $stmt = $this->pdo->prepare("
                        INSERT INTO items (
                            id, title, description, status, due_date, 
                            estimated_minutes, actual_minutes, priority,
                            user_id, tenant_id, parent_id, project_id,
                            is_project, is_archived, is_trash,
                            created_at, updated_at
                        ) VALUES (
                            :id, :title, :description, :status, :due_date,
                            :estimated_minutes, :actual_minutes, :priority,
                            :user_id, :tenant_id, :parent_id, :project_id,
                            :is_project, :is_archived, :is_trash,
                            :created_at, :updated_at
                        )
                    ");

                    $stmt->execute([
                        ':id' => $newId,
                        ':title' => $item['title'] ?? 'Untitled',
                        ':description' => $item['description'] ?? null,
                        ':status' => $item['status'] ?? 'inbox',
                        ':due_date' => $item['due_date'] ?? null,
                        ':estimated_minutes' => $item['estimated_minutes'] ?? null,
                        ':actual_minutes' => $item['actual_minutes'] ?? null,
                        ':priority' => $item['priority'] ?? null,
                        ':user_id' => $this->userId, // Always use current user
                        ':tenant_id' => null, // Import as personal items
                        ':parent_id' => null, // Don't preserve hierarchy for safety
                        ':project_id' => null, // Don't preserve project reference
                        ':is_project' => $item['is_project'] ?? 0,
                        ':is_archived' => $item['is_archived'] ?? 0,
                        ':is_trash' => 0, // Don't import trashed items as trashed
                        ':created_at' => $item['created_at'] ?? date('c'),
                        ':updated_at' => date('c')
                    ]);

                    $importedCount++;
                } catch (Exception $e) {
                    $errorCount++;
                    error_log("Import item error: " . $e->getMessage());
                }
            }

            $this->pdo->commit();

            echo json_encode([
                'success' => true,
                'imported' => $importedCount,
                'skipped' => $skippedCount,
                'errors' => $errorCount,
                'message' => "{$importedCount}件のアイテムをインポートしました。"
            ]);

        } catch (Exception $e) {
            if ($this->pdo->inTransaction()) {
                $this->pdo->rollBack();
            }
            http_response_code(500);
            echo json_encode(['error' => 'Import failed: ' . $e->getMessage()]);
        }
    }
}
