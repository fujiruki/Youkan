<?php
// backend/BackupController.php

class BackupController {
    private $dbPath;

    public function __construct() {
        // DB path is defined relative to this file
        $this->dbPath = __DIR__ . '/jbwos.sqlite';
    }

    /**
     * Download the current database file.
     */
    public function download() {
        if (!file_exists($this->dbPath)) {
            http_response_code(404);
            echo json_encode(['error' => 'Database file not found.']);
            return;
        }

        $filename = 'backup_' . date('Y-m-d_H-i-s') . '.sqlite';

        // Headers for file download
        header('Content-Type: application/octet-stream');
        header('Content-Disposition: attachment; filename="' . $filename . '"');
        header('Content-Length: ' . filesize($this->dbPath));
        
        // Disable caching
        header('Cache-Control: no-cache, no-store, must-revalidate');
        header('Pragma: no-cache');
        header('Expires: 0');

        readfile($this->dbPath);
        exit;
    }

    /**
     * Restore database from uploaded file.
     * Replaces the current .sqlite file safely.
     */
    public function restore() {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
            http_response_code(405);
            echo json_encode(['error' => 'Method not allowed.']);
            return;
        }

        if (!isset($_FILES['backup_file']) || $_FILES['backup_file']['error'] !== UPLOAD_ERR_OK) {
            http_response_code(400);
            echo json_encode(['error' => 'No valid file uploaded.']);
            return;
        }

        $uploadFile = $_FILES['backup_file']['tmp_name'];
        $backupPath = $this->dbPath . '.bak';

        // 1. Validate File? (Naive check: is it an SQLite file? Magic header?)
        // SQLite header: "SQLite format 3"
        $handle = fopen($uploadFile, 'rb');
        $header = fread($handle, 16);
        fclose($handle);

        if (strpos($header, 'SQLite format 3') !== 0) {
            http_response_code(400);
            echo json_encode(['error' => 'Invalid file format. Must be an SQLite database.']);
            return;
        }

        // 2. Safely Replace
        try {
            // Backup current DB
            if (file_exists($this->dbPath)) {
                if (!copy($this->dbPath, $backupPath)) {
                    throw new Exception("Failed to create temporary backup of current database.");
                }
            }

            // Move uploaded file to DB path
            if (!move_uploaded_file($uploadFile, $this->dbPath)) {
                // Restore from backup if move failed
                if (file_exists($backupPath)) {
                    rename($backupPath, $this->dbPath);
                }
                throw new Exception("Failed to move uploaded file.");
            }

            // 3. Cleanup
            if (file_exists($backupPath)) {
                unlink($backupPath);
            }

            // Success
            echo json_encode(['success' => true, 'message' => 'Database restored successfully.']);

        } catch (Exception $e) {
            http_response_code(500);
            echo json_encode(['error' => 'Restoration failed: ' . $e->getMessage()]);
        }
    }
}
