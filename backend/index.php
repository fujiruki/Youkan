<?php
// backend/index.php

// 1. Error Handling for AI Autonomy
ini_set('display_errors', 0);
set_error_handler(function($errno, $errstr, $errfile, $errline) {
    header('Content-Type: application/json', true, 500);
    echo json_encode([
        'error' => true,
        'message' => $errstr,
        'file' => basename($errfile),
        'line' => $errline
    ]);
    exit;
});

// 2. CORS & Headers
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, X-AI-Debug-Secret");
header("Content-Type: application/json; charset=UTF-8");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// 3. Routing (Simple Switch for MVP)
$uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$method = $_SERVER['REQUEST_METHOD'];

// Remove /api prefix if exists (depends on server config, safely handle both)
$path = preg_replace('#^/api#', '', $uri);

// Fix for built-in server where /api is not stripped because root is backend/
// When accessing localhost:8000/api/items, path is /api/items.
// We should rely on path matching.

require_once 'db.php';
require_once 'ItemController.php';

$db = getDB();

try {
    if ($path === '/items' || $path === '/api/items') {
        if ($method === 'GET') {
            echo json_encode(ItemController::getAll($db));
        } elseif ($method === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            echo json_encode(ItemController::create($db, $data));
        }
    }
    elseif (preg_match('#^(/api)?/items/(.+)$#', $path, $matches) && $method === 'PUT') {
        $data = json_decode(file_get_contents('php://input'), true);
        echo json_encode(ItemController::update($db, $matches[2], $data));
    }
    elseif (preg_match('#^(/api)?/items/(.+)$#', $path, $matches) && $method === 'DELETE') {
        echo json_encode(ItemController::delete($db, $matches[2]));
    }
    elseif ($path === '/debug/logs' || $path === '/api/debug/logs') {
        // AI Debug Eye
        if ($method === 'GET') {
            $logs = $db->query("SELECT * FROM system_logs ORDER BY id DESC LIMIT 50")->fetchAll(PDO::FETCH_ASSOC);
            echo json_encode($logs);
        }
    }
    else {
        http_response_code(404);
        echo json_encode(['error' => 'Not Found', 'path' => $path]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}
