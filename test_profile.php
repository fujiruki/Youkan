<?php
$url_login = 'http://127.0.0.1:8000/auth/login/tenant';
$data_login = ['email' => 'info@door-fujita.com', 'password' => 'passc'];
$opts_login = ['http' => ['method' => 'POST', 'header' => "Content-type: application/json\r\n", 'content' => json_encode($data_login), 'ignore_errors' => true]];
$ctx_login = stream_context_create($opts_login);
$res_login = json_decode(file_get_contents($url_login, false, $ctx_login), true);

$token = $res_login['token'];

$url = 'http://127.0.0.1:8000/user/profile';
$opts = ['http' => ['method' => 'GET', 'header' => "Authorization: Bearer $token\r\n", 'ignore_errors' => true]];
$ctx = stream_context_create($opts);
$res = file_get_contents($url, false, $ctx);

// Extract status code
$status_line = $http_response_header[0];
preg_match('#HTTP/\d+\.\d+ (\d+)#', $status_line, $match);
$status_code = intval($match[1]);

echo "[$status_code] GET /user/profile\n";
echo "Response: $res\n";

// Decode the token locally to see what SUB is
list($header, $payload, $signature) = explode('.', $token);
$decoded_payload = json_decode(base64_decode($payload), true);
echo "Token Subject (User ID): " . $decoded_payload['sub'] . "\n";
echo "Token Account Type: " . $decoded_payload['account_type'] . "\n";
