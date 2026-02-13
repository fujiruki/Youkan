<?php
// WAF/Permission Check Script

$token = 'mock-debug-token'; // Use mock token behavior logic if verifying against local, but for remote we need real behavior? 
// No, remote wont accept mock token unless DB has it. 
// But 403 from WAF happens BEFORE PHP execution usually.
// So any long string in URL might trigger it.

$localBase = 'http://localhost:8000/backend/index.php';
$remoteBase = 'http://door-fujita.com/contents/TateguDesignStudio/backend/index.php';

// Generate a long dummy token typical of JWT
$longToken = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.' . str_repeat('a', 500) . '.signature';

function testRequest($url, $method = 'GET', $headers = []) {
    $opts = [
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'ignore_errors' => true
        ]
    ];
    $context = stream_context_create($opts);
    $startTime = microtime(true);
    $response = file_get_contents($url, false, $context);
    $duration = (microtime(true) - $startTime) * 1000;
    
    // Parse status line
    $statusLine = $http_response_header[0];
    preg_match('/HTTP\/[\d\.]+\s+(\d+)/', $statusLine, $matches);
    $statusCode = $matches[1] ?? 0;
    
    return [
        'status' => $statusCode,
        'line' => $statusLine,
        'duration' => $duration
    ];
}

echo "--- WAF Verification Test ---\n";

// Test 1: Remote with Long Token in URL (WAF Suspect)
$url = $remoteBase . "/items?token=" . urlencode($longToken);
echo "1. Remote + URL Token: ";
$res = testRequest($url);
echo "{$res['status']} ({$res['line']})\n";

// Test 2: Remote with Token in Header (Should pass WAF, might be 401/403 app error but not WAF 403)
$url = $remoteBase . "/items";
$headers = ["Authorization: Bearer $longToken"];
echo "2. Remote + Header Token: ";
$res = testRequest($url, 'GET', $headers);
echo "{$res['status']} ({$res['line']})\n";

// Test 3: Local with Long Token in URL (Control)
$url = $localBase . "/items?token=" . urlencode($longToken);
echo "3. Local + URL Token: ";
$res = testRequest($url);
echo "{$res['status']} ({$res['line']})\n";

?>
