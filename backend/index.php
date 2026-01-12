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
require_once 'DebugController.php';
require_once 'DecisionController.php';
require_once 'TodayController.php';
require_once 'SideMemoController.php';
require_once 'GdbController.php';

$db = getDB();

// 2. Routing
$method = $_SERVER['REQUEST_METHOD'];
$path = $_SERVER['REQUEST_URI'];
$pathParts = explode('?', $path);
$pathOnly = $pathParts[0];

// Debug Routes
if (preg_match('#^(/api)?/debug/logs#', $pathOnly)) {
    $controller = new DebugController($db);
    if ($method === 'GET') {
        $controller->getLogs();
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
    exit;
}

// GDB Routes
if (preg_match('#^(/api)?/gdb$#', $pathOnly)) {
    $controller = new GdbController($db);
    if ($method === 'GET') {
        echo json_encode($controller->getShelf());
    }
    exit;
}

// Decision Routes
if (preg_match('#^(/api)?/decision/([^/]+)/resolve$#', $pathOnly, $matches) && $method === 'POST') {
    $controller = new DecisionController($db);
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->resolve($matches[2], $data));
    exit;
}

// Today Routes
if (preg_match('#^(/api)?/today$#', $pathOnly)) {
    $controller = new TodayController($db);
    if ($method === 'GET') {
        echo json_encode($controller->getToday());
    }
    exit;
}
if (preg_match('#^(/api)?/today/commit$#', $pathOnly) && $method === 'POST') {
    $controller = new TodayController($db);
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->commit($data['id']));
    exit;
}

// Side Memo Routes
if (preg_match('#^(/api)?/memos$#', $pathOnly)) {
    $controller = new SideMemoController($db);
    if ($method === 'GET') {
        echo json_encode($controller->getAll());
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        echo json_encode($controller->create($data));
    }
    exit;
}
if (preg_match('#^(/api)?/memo/([^/]+)$#', $pathOnly, $matches) && $method === 'DELETE') {
    $controller = new SideMemoController($db);
    echo json_encode($controller->delete($matches[2]));
    exit;
}
if (preg_match('#^(/api)?/memo/([^/]+)/move-to-inbox$#', $pathOnly, $matches) && $method === 'POST') {
    $controller = new SideMemoController($db);
    echo json_encode($controller->moveToInbox($matches[2]));
    exit;
}

// Item Routes (Legacy & General CRUD)
try {
    if (preg_match('#^(/api)?/items$#', $pathOnly)) {
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
    else {
        http_response_code(404);
        echo json_encode(['error' => 'Not Found', 'path' => $path]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}
