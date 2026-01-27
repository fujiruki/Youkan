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
// Handle CORS
if (isset($_SERVER['HTTP_ORIGIN'])) {
    header("Access-Control-Allow-Origin: {$_SERVER['HTTP_ORIGIN']}");
    header('Access-Control-Allow-Credentials: true');
    header('Access-Control-Max-Age: 86400');    // cache for 1 day
} else {
    header("Access-Control-Allow-Origin: *");
}
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-HTTP-Method-Override, X-AI-Debug-Secret");
header("Content-Type: application/json; charset=UTF-8");
header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0"); // [FIX] Prevent browser caching
header("Pragma: no-cache");

ini_set('display_errors', 0);
ini_set('log_errors', 1);
ini_set('error_log', __DIR__ . '/php_errors.log');

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

    // Special fix for CLI Server routing where SCRIPT_NAME == URI (e.g. on Windows with Unicode paths)
    if (php_sapi_name() === 'cli-server' && ($path === '/' || $path === '') && $uri !== '/') {
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
error_log("Routing Path: " . $path);

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

// Debug Routes (開発用 - 本番では無効化すること)
if (preg_match('#^(/api)?/debug(/.*)$#', $path, $matches)) {
    $controller = new DebugController();
    $subPath = $matches[2];
    $controller->handleRequest($method, $subPath);
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

// Migration Route (Temporary v7)
if (preg_match('#^(/api)?/migrate$#', $path)) {
    require_once 'migrate_v7.php';
    exit;
}

// Members Route (MemberConfig)
if (preg_match('#^(/api)?/members(?:/([^/]+))?$#', $path, $matches)) {
    require_once 'MemberController.php';
    $controller = new MemberController();
    $id = $matches[2] ?? null;
    $input = json_decode(file_get_contents('php://input'), true);

    if ($method === 'GET' && !$id) {
        $controller->index();
    } elseif ($method === 'PUT' && $id) {
        $controller->update($id, $input);
    } else {
        http_response_code(405);
        echo json_encode(['error' => 'Method Not Allowed']);
    }
    exit;
}

// --- NEW V7 ROUTES ---

// User Settings Routes (Personal)
require_once 'UserController.php';
if (preg_match('#^(/api)?/user(/.*)$#', $path, $matches)) {
    $controller = new UserController();
    $subPath = $matches[2];
    $controller->handleRequest($method, $subPath);
    exit;
}

// Auth Routes
// Auth Routes
require_once 'AuthController.php';
if (preg_match('#^(/api)?/auth(/.*)$#', $path, $matches)) {
    $controller = new AuthController();
    $subPath = $matches[2]; 
    $controller->handleRequest($method, $subPath);
    exit;
}

// Tenant Routes (Company Management)
require_once 'TenantController.php';
if (preg_match('#^(/api)?/tenant(/.*)$#', $path, $matches)) {
    error_log("Matched Tenant Route: " . $path);
    $controller = new TenantController();
    $subPath = $matches[2];
    $controller->handleRequest($method, $subPath);
    exit;
}

// Integration Routes
require_once 'IntegrationController.php';
if (preg_match('#^(/api)?/integrations(/.*)$#', $path, $matches)) {
    $controller = new IntegrationController();
    $subPath = $matches[2];
    $controller->handleRequest($method, $subPath);
    exit;
}

// Project Routes (Cloud v7)
require_once 'ProjectController.php';
if (preg_match('#^(/api)?/projects(?:/([^/]+))?$#', $path, $matches)) {
    $controller = new ProjectController();
    $id = $matches[2] ?? null;
    $controller->handleRequest($method, $id);
    exit;
}

// Door Routes (Cloud v7)
require_once 'DoorController.php';
if (preg_match('#^(/api)?/doors(?:/([^/]+))?$#', $path, $matches)) {
    $controller = new DoorController();
    $id = $matches[2] ?? null;
    $controller->handleRequest($method, $id);
    exit;
}
// ---------------------

// Master Item Routes (Manufacturing Core v11)
require_once 'MasterItemController.php';

if (preg_match('#^(/api)?/masters(?:/([^/]+))?$#', $path, $matches)) {
    $controller = new MasterItemController();
    $id = $matches[2] ?? null;
    $controller->handleRequest($method, $id);
    exit;
}

// Document Routes (Manufacturing Core v11)
require_once 'DocumentController.php';

// /api/documents/{id}/action (e.g. convert)
if (preg_match('#^(/api)?/documents/([^/]+)/convert$#', $path, $matches) && $method === 'POST') {
    $controller = new DocumentController();
    $_GET['action'] = 'convert'; // pass action via GET
    $controller->handleRequest($method, $matches[2]);
    exit;
}

// /api/documents
if (preg_match('#^(/api)?/documents(?:/([^/]+))?$#', $path, $matches)) {
    $controller = new DocumentController();
    $id = $matches[2] ?? null;
    $controller->handleRequest($method, $id);
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

// ...
if (preg_match('#^(/api)?/gdb$#', $path)) {
    $controller = new GdbController(); // Removed $db
    if ($method === 'GET') {
        echo json_encode($controller->getShelf());
    }
    exit;
}

// ...

// Today Routes
if (preg_match('#^(/api)?/today$#', $path)) {
    $controller = new TodayController(); // Removed $db
    if ($method === 'GET') {
        echo json_encode($controller->getToday());
    }
    exit;
}
if (preg_match('#^(/api)?/today/commit$#', $path) && $method === 'POST') {
    $controller = new TodayController(); // Removed $db
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->commit($data['id']));
    exit;
}
if (preg_match('#^(/api)?/today/complete$#', $path) && $method === 'POST') {
    $controller = new TodayController(); // Removed $db
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->complete($data['id']));
    exit;
}
if (preg_match('#^(/api)?/today/undo$#', $path) && $method === 'POST') { // [NEW] Undo
    $controller = new TodayController();
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->undo($data['id']));
    exit;
}

// Decision Routes (Missing)
if (preg_match('#^(/api)?/decision/([^/]+)/resolve$#', $path, $matches) && $method === 'POST') {
    $controller = new DecisionController($db);
    $data = json_decode(file_get_contents('php://input'), true);
    echo json_encode($controller->resolve($matches[2], $data));
    exit;
}

// Execution Routes (Missing)
require_once 'ExecutionController.php'; // Ensure file exists or create it
if (preg_match('#^(/api)?/execution/([^/]+)/(start|pause)$#', $path, $matches) && $method === 'POST') {
    $controller = new ExecutionController($db);
    $id = $matches[2];
    $action = $matches[3];
    if ($action === 'start') {
        echo json_encode($controller->start($id));
    } else {
        echo json_encode($controller->pause($id));
    }
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
require_once 'LogController.php';

if (preg_match('#^(/api)?/logs/life$#', $path) && $method === 'POST') {
    $controller = new LogController();
    $controller->createLifeLog();
    exit;
}
if (preg_match('#^(/api)?/logs/execution$#', $path) && $method === 'POST') {
    $controller = new LogController();
    $controller->createExecutionLog();
    exit;
}

// History Routes
require_once 'HistoryController.php';

if (preg_match('#^(/api)?/history/summary$#', $path) && $method === 'GET') {
    $controller = new HistoryController();
    $controller->getSummary();
    exit;
}
if (preg_match('#^(/api)?/history/timeline$#', $path) && $method === 'GET') {
    $controller = new HistoryController();
    $controller->getTimeline();
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

if (preg_match('#^(/api)?/calendar(/.*)?$#', $path, $matches)) {
    $controller = new CalendarController();
    // Allow Controller to handle sub-paths via handleRequest
    // Or map specifically:
    $subPath = $matches[2] ?? '';
    
    if ($subPath === '/items' || strpos($subPath, '/items') === 0) {
        $controller->handleRequest($method);
        exit;
    }
    
    if ($subPath === '/load' && $method === 'GET') {
        echo json_encode($controller->getLoad($_GET));
        exit;
    }
    
    // Fallback or root /calendar
    // Maybe handleRequest can handle others?
    $controller->handleRequest($method); 
    exit;
}

// Item Routes (Legacy & General CRUD)
// Capacity Routes (Manager View - Quantity Only)
if (preg_match('#^(/api)?/users/([^/]+)/capacity$#', $path, $matches) && $method === 'GET') {
    // This requires ItemController for now, or a dedicated CapacityController could be better.
    // For simplicity, let's route it to ItemController's new method getCapacity() (to be added)
    // or handle it here if it's simple SQL.
    // Let's add getCapacity to ItemController.
    $controller = new ItemController();
    $controller->getCapacity($matches[2]); // $userId
    exit;
}

// Item Routes (Scoped & Secure)
// New Logic: Instantiates ItemController extends BaseController
if (preg_match('#^(/api)?/items(?:/([^/]+))?$#', $path, $matches)) {
    $controller = new ItemController();
    $id = $matches[2] ?? null;
    $controller->handleRequest($method, $id);
    exit;
}

// Assignee Routes (Phase 9)
require_once 'AssigneeController.php';
if (preg_match('#^(/api)?/assignees(?:/([^/]+))?$#', $path, $matches)) {
    $controller = new AssigneeController();
    $id = $matches[2] ?? null;
    $controller->handleRequest($method, $id);
    exit;
}

// Project Category Routes (Phase 9)
require_once 'ProjectCategoryController.php';
if (preg_match('#^(/api)?/categories(?:/([^/]+))?$#', $path, $matches)) {
    $controller = new ProjectCategoryController();
    $id = $matches[2] ?? null;
    $controller->handleRequest($method, $id);
    exit;
}

// Life Log Routes (Phase 9)
require_once 'LifeController.php';
if (preg_match('#^(/api)?/life/([^/]+)(?:/([^/]+))?$#', $path, $matches)) {
    // /api/life/{id}/{action} or /api/life/today
    $controller = new LifeController();
    $id = $matches[2] ?? null; // 'today' or item_id
    $action = $matches[3] ?? null; // 'check' etc.

    // Handle /api/life/today
    if ($id === 'today' && !$action) {
        $controller->handleRequest($method, 'today');
        exit;
    }
    
    // Handle /api/life/{id}/check
    $controller->handleRequest($method, $id, $action);
    exit;
}

// Fallback 404
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
