<?php
require_once 'db.php';

class DebugController {
    public function getLogs() {
        // Log file paths (Adjust based on environment)
        $logFiles = [
            'php_error' => 'php_error.log', // PHP Built-in server default often prints to stderr, verifying file usage.
            'laravel' => 'storage/logs/laravel.log', // Example fallback
        ];

        $logs = [];

        // 1. Try to capture PHP error log if accessed via file
        // Note: Built-in server usually outputs to Console (stdout/stderr).
        // It's hard to capture console output from within the script unless piped to a file.
        // Assuming user might be running: php -S ... > php_error.log
        
        $targetLog = 'php_error.log'; // Convention
        
        if (file_exists($targetLog)) {
            $logs['php_error'] = $this->tailFile($targetLog, 50);
        } else {
            $logs['php_error'] = "Log file '$targetLog' not found. Ensure server is started with logging redirection if needed.";
        }

        // 2. Add System Info
        $logs['system'] = [
            'php_version' => phpversion(),
            'server_software' => $_SERVER['SERVER_SOFTWARE'] ?? 'Unknown',
            'timestamp' => date('Y-m-d H:i:s'),
            'extensions' => get_loaded_extensions(),
            'sqlite_path' => 'jbwos.sqlite' // Hardcoded for context
        ];

        header('Content-Type: application/json');
        echo json_encode(['data' => $logs], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
    }

    private function tailFile($filepath, $lines = 50) {
        if (!is_readable($filepath)) return "File not readable.";
        
        $data = file($filepath);
        if ($data === false) return "Failed to read file.";
        
        return array_slice($data, -$lines);
    }
}
