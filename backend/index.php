<?php
// backend/index.php

// 1. Error Handling for AI Autonomy
// 1. Error Handling for AI Autonomy
ini_set('display_errors', 1);
error_reporting(E_ALL);
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

set_exception_handler(function($e) {
    header('Content-Type: application/json', true, 500);
    echo json_encode([
        'error' => true,
        'message' => $e->getMessage(),
        'file' => basename($e->getFile()),
        'line' => $e->getLine(),
        'trace' => $e->getTraceAsString()
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

// Support X-HTTP-Method-Override (for servers blocking DELETE/PUT)
if (isset($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE'])) {
    $_SERVER['REQUEST_METHOD'] = strtoupper($_SERVER['HTTP_X_HTTP_METHOD_OVERRIDE']);
}

// 3. Routing (Robust Path Extraction)
$path = null;

// Try PATH_INFO first (Standard CGI/FastCGI)
if (isset($_SERVER['PATH_INFO'])) {
    $path = $_SERVER['PATH_INFO'];
} else {
    // Fallback: Manually parse REQUEST_URI
    $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
    $scriptName = $_SERVER['SCRIPT_NAME']; // e.g. /contents/TateguDesignStudio/index.php
    $scriptDir = dirname($scriptName);

    // If URI starts with script name (e.g. /.../index.php/foo), strip it
    if (strpos($uri, $scriptName) === 0) {
        $path = substr($uri, strlen($scriptName));
    } 
    // If URI starts with script dir (e.g. /.../foo), strip it
    elseif ($scriptDir !== '/' && strpos($uri, $scriptDir) === 0) {
        $path = substr($uri, strlen($scriptDir));
    } 
    else {
        $path = $uri;
    }
}

// Remove /api prefix if exists
$path = preg_replace('#^/api#', '', $path);

// Ensure path starts with /
if (empty($path) || $path[0] !== '/') {
    $path = '/' . $path;
}

// Debug logs can be enabled here if needed
// error_log("Routing Path: " . $path);

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
require_once 'api/customers.php';

$db = getDB();

// 2. Routing Logic (Using normalized $path)
$method = $_SERVER['REQUEST_METHOD'];
// Note: $path is already normalized above. Handle query params if needed, but routing is usually on path.
// If $path contains query string (e.g. from Fallback), strip it.
if (($pos = strpos($path, '?')) !== false) {
    $path = substr($path, 0, $pos);
}

// Debug Routes
if (preg_match('#^(/api)?/debug/logs#', $path)) {
    $controller = new DebugController($db);
    if ($method === 'GET') {
        $controller->getLogs();
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
    }
    exit;
}

// Health Check Route
if (preg_match('#^(/api)?/health$#', $path)) {
    require_once 'health.php';
    exit;
}

// Customer Routes (Customer Plugin)
if (preg_match('#^(/api)?/customers(?:/([^/]+))?$#', $path, $matches)) {
    $customerId = $matches[2] ?? null;
    handleCustomerRequest($db, $method, $customerId, $_GET, json_decode(file_get_contents('php://input'), true) ?? []);
    exit;
}

// Deliverable Routes (Manufacturing Plugin)
require_once 'api/deliverables.php';
if (preg_match('#^(/api)?/deliverables(?:/summary/([^/]+))?$#', $path, $matches) && isset($matches[2])) {
    // Summary endpoint: /api/deliverables/summary/{projectId}
    $_GET['projectId'] = $matches[2];
    handleDeliverableRequest($db, $method, 'summary', $_GET, json_decode(file_get_contents('php://input'), true) ?? []);
    exit;
}
if (preg_match('#^(/api)?/deliverables(?:/([^/]+))?$#', $path, $matches)) {
    $deliverableId = $matches[2] ?? null;
    handleDeliverableRequest($db, $method, $deliverableId, $_GET, json_decode(file_get_contents('php://input'), true) ?? []);
    exit;
}

// GDB Routes
if (preg_match('#^(/api)?/gdb$#', $path)) {
    $controller = new GdbController($db);
    if ($method === 'GET') {
        echo json_encode($controller->getShelf());
    }
    exit;
}

// Decision Routes
if (preg_match('#^(/api)?/decision/([^/]+)/resolve$#', $path, $matches) && $method === 'POST') {
    $controller = new DecisionController($db);
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->resolve($matches[2], $data));
    exit;
}

// Today Routes
if (preg_match('#^(/api)?/today$#', $path)) {
    $controller = new TodayController($db);
    if ($method === 'GET') {
        echo json_encode($controller->getToday());
    }
    exit;
}
if (preg_match('#^(/api)?/today/commit$#', $path) && $method === 'POST') {
    $controller = new TodayController($db);
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->commit($data['id']));
    exit;
}
if (preg_match('#^(/api)?/today/complete$#', $path) && $method === 'POST') {
    $controller = new TodayController($db);
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->complete($data['id']));
    exit;
}

// Side Memo Routes
if (preg_match('#^(/api)?/memos$#', $path)) {
    $controller = new SideMemoController($db);
    if ($method === 'GET') {
        echo json_encode($controller->getAll());
    } elseif ($method === 'POST') {
        $data = json_decode(file_get_contents('php://input'), true);
        echo json_encode($controller->create($data));
    }
    exit;
}
if (preg_match('#^(/api)?/memo/([^/]+)$#', $path, $matches) && $method === 'DELETE') {
    $controller = new SideMemoController($db);
    echo json_encode($controller->delete($matches[2]));
    exit;
}
if (preg_match('#^(/api)?/memo/([^/]+)/move-to-inbox$#', $path, $matches) && $method === 'POST') {
    $controller = new SideMemoController($db);
    echo json_encode($controller->moveToInbox($matches[2]));
    exit;
}

// Life & Execution Routes (Phase 3)
require_once 'LifeController.php';

if (preg_match('#^(/api)?/life/([^/]+)/check$#', $path, $matches) && $method === 'POST') {
    $controller = new LifeController($db);
    echo json_encode($controller->checkLife($matches[2]));
    exit;
}
if (preg_match('#^(/api)?/execution/([^/]+)/start$#', $path, $matches) && $method === 'POST') {
    $controller = new LifeController($db);
    echo json_encode($controller->startExecution($matches[2]));
    exit;
}
if (preg_match('#^(/api)?/execution/([^/]+)/pause$#', $path, $matches) && $method === 'POST') {
    $controller = new LifeController($db);
    echo json_encode($controller->pauseExecution($matches[2]));
    exit;
}
if (preg_match('#^(/api)?/history$#', $path) && $method === 'GET') {
    $controller = new LifeController($db);
    echo json_encode($controller->getHistory());
    exit;
}

// Stock Routes (v6 Enterprise)
require_once 'StockController.php';

if (preg_match('#^(/api)?/stocks$#', $path)) {
    $controller = new StockController();
    if ($method === 'GET') {
        $controller->index();
    } elseif ($method === 'POST') {
        $controller->create();
    }
    exit;
}
if (preg_match('#^(/api)?/stocks/([^/]+)$#', $path, $matches) && $method === 'PUT') {
    $controller = new StockController();
    $controller->update($matches[2]);
    exit;
}
if (preg_match('#^(/api)?/stocks/([^/]+)/assign$#', $path, $matches) && $method === 'POST') {
    $controller = new StockController();
    $controller->assign($matches[2]);
    exit;
}

// Backup & Restore Routes
require_once 'BackupController.php';

if (preg_match('#^(/api)?/backup$#', $path) && $method === 'GET') {
    $controller = new BackupController();
    $controller->download();
    exit;
}
if (preg_match('#^(/api)?/restore$#', $path) && $method === 'POST') {
    $controller = new BackupController();
    $controller->restore();
    exit;
}

// Calendar Routes (Load/Heatmap)
require_once 'CalendarController.php';

if (preg_match('#^(/api)?/calendar/load$#', $path) && $method === 'GET') {
    $controller = new CalendarController($db);
    echo json_encode($controller->getLoad($_GET));
    exit;
}

// Item Routes (Legacy & General CRUD)
try {
    if (preg_match('#^(/api)?/items$#', $path)) {
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
        echo json_encode([
            'error' => 'Not Found', 
            'path' => $path,
            '_debug' => [
                'uri' => $uri ?? 'null',
                'script_name' => $_SERVER['SCRIPT_NAME'] ?? 'null',
                'path_info' => $_SERVER['PATH_INFO'] ?? 'null'
            ]
        ]);
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage(), 'trace' => $e->getTraceAsString()]);
}
