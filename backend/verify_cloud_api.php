<?php
// backend/verify_cloud_api.php
require_once 'db.php';

echo "=== Verifying Cloud API (Projects/Doors) ===\n";

$pdo = getDB();

// 1. Fetch Credentials
$stmt = $pdo->query("SELECT email FROM users LIMIT 1");
$email = $stmt->fetchColumn();
echo "User Email: $email\n";

$baseUrl = 'http://localhost:8005/api';

function request($method, $url, $data = [], $token = null) {
    echo "[$method] $url\n";
    $options = [
        'http' => [
            'header'  => "Content-Type: application/json\r\n" .
                         ($token ? "Authorization: Bearer $token\r\n" : ""),
            'method'  => $method,
            'content' => json_encode($data),
            'ignore_errors' => true
        ]
    ];
    $context  = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    
    $status_line = $http_response_header[0];
    preg_match('{HTTP\/\S*\s(\d{3})}', $status_line, $match);
    $status = $match[1];
    
    return ['status' => $status, 'body' => $result];
}

// 2. Login
$res = request('POST', "$baseUrl/auth/login", ['email' => $email, 'password' => 'admin123']);
if ($res['status'] != 200) die("Login Failed: {$res['body']}\n");

$json = json_decode($res['body'], true);
$token = $json['token'];
echo "got Token.\n";

// 3. Create Project
$prjData = [
    'name' => 'Cloud Verification Project',
    'client' => 'Test Client',
    'settings' => ['tax' => 0.1],
    'created_at' => time() * 1000
];
$res = request('POST', "$baseUrl/projects", $prjData, $token);
if ($res['status'] != 200) die("Create Project Failed: {$res['body']}\n");
$project = json_decode($res['body'], true);
echo "Project Created: {$project['id']}\n";

// 4. List Projects
$res = request('GET', "$baseUrl/projects", [], $token);
$list = json_decode($res['body'], true);
echo "Project List Count: " . count($list) . "\n";
if (count($list) < 1) die("List should have at least 1 project\n");

// 5. Create Door
$doorData = [
    'project_id' => $project['id'],
    'name' => 'Test Door 1',
    'count' => 2,
    'status' => 'design',
    'dimensions' => ['w' => 800, 'h' => 2000]
];
$res = request('POST', "$baseUrl/doors", $doorData, $token);
if ($res['status'] != 200) die("Create Door Failed: {$res['body']}\n");
$door = json_decode($res['body'], true);
echo "Door Created: {$door['id']}\n";

// 6. List Doors
$res = request('GET', "$baseUrl/doors?projectId={$project['id']}", [], $token);
$doors = json_decode($res['body'], true);
echo "Door List Count: " . count($doors) . "\n";
if (count($doors) < 1) die("List should have at least 1 door\n");

echo "=== Verification Complete! ===\n";
