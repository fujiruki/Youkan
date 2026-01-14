<?php
// Health Check Endpoint
// Usage: curl http://localhost:8000/health

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');

$response = [
    'status' => 'ok',
    'timestamp' => time(),
    'server' => [
        'address' => $_SERVER['SERVER_ADDR'] ?? 'unknown',
        'port' => $_SERVER['SERVER_PORT'] ?? 'unknown',
        'protocol' => $_SERVER['SERVER_PROTOCOL'] ?? 'unknown',
    ],
    'database' => [
        'path' => __DIR__ . '/jbwos.sqlite',
        'exists' => file_exists(__DIR__ . '/jbwos.sqlite'),
        'writable' => is_writable(__DIR__),
    ],
    'php' => [
        'version' => PHP_VERSION,
        'extensions' => [
            'pdo' => extension_loaded('pdo'),
            'pdo_sqlite' => extension_loaded('pdo_sqlite'),
        ]
    ]
];

// データベース接続テスト
if ($response['database']['exists']) {
    try {
        $pdo = new PDO('sqlite:' . __DIR__ . '/jbwos.sqlite');
        $stmt = $pdo->query("SELECT COUNT(*) as count FROM items");
        $result = $stmt->fetch(PDO::FETCH_ASSOC);
        $response['database']['item_count'] = $result['count'];
        $response['database']['status'] = 'connected';
    } catch (Exception $e) {
        $response['database']['status'] = 'error';
        $response['database']['error'] = $e->getMessage();
        $response['status'] = 'degraded';
    }
}

http_response_code(200);
echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
