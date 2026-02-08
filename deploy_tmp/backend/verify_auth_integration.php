<?php
// backend/verify_auth_integration.php
require_once 'db.php';

echo "=== Verifying Auth & Integration ===\n";

$pdo = getDB();

// 1. Fetch Credentials
$stmt = $pdo->query("SELECT email FROM users LIMIT 1");
$email = $stmt->fetchColumn();
$stmt = $pdo->query("SELECT token FROM api_tokens LIMIT 1");
$token = $stmt->fetchColumn();

echo "User Email: $email\n";
echo "API Token: $token\n";

$baseUrl = 'http://localhost:8005/api'; // PHP built-in server

function post_request($url, $data, $token = null) {
    $options = [
        'http' => [
            'header'  => "Content-Type: application/json\r\n" .
                         ($token ? "Authorization: Bearer $token\r\n" : ""),
            'method'  => 'POST',
            'content' => json_encode($data),
            'ignore_errors' => true // to fetch content even on 4xx/5xx
        ]
    ];
    $context  = stream_context_create($options);
    $result = file_get_contents($url, false, $context);
    
    // Parse headers to get status code
    $status_line = $http_response_header[0];
    preg_match('{HTTP\/\S*\s(\d{3})}', $status_line, $match);
    $status = $match[1];
    
    return ['status' => $status, 'body' => $result];
}

// 2. Test Login
echo "\n--- Testing /auth/login ---\n";
$loginData = ['email' => $email, 'password' => 'admin123'];
$res = post_request("$baseUrl/auth/login", $loginData);

echo "HTTP Code: {$res['status']}\n";
echo "Response: {$res['body']}\n";

if ($res['status'] != 200) {
    echo "Login Failed!\n";
    exit(1);
}

$json = json_decode($res['body'], true);
if (!isset($json['token'])) {
    echo "No token received!\n";
    exit(1);
}
echo "Login Success! JWT obtained.\n";

// 3. Test Integration (Inbox)
echo "\n--- Testing /integrations/inbox ---\n";
$inboxData = ['title' => 'Voice Memo Test', 'memo' => 'Created via Verification Script'];
$res = post_request("$baseUrl/integrations/inbox", $inboxData, $token);

echo "HTTP Code: {$res['status']}\n";
echo "Response: {$res['body']}\n";

if ($res['status'] != 200) {
    echo "Integration Failed!\n";
    exit(1);
}

echo "Integration Success! Inbox item created.\n";

// 4. Verify DB
$stmt = $pdo->prepare("SELECT * FROM items WHERE title = ?");
$stmt->execute(['Voice Memo Test']);
$item = $stmt->fetch(PDO::FETCH_ASSOC);

if ($item) {
    echo "DB Verification: Item found! ID: {$item['id']}\n";
} else {
    echo "DB Verification: Item NOT found!\n";
    exit(1);
}
