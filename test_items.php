<?php
$url = 'http://127.0.0.1:8000/auth/login/tenant';
$data = ['email' => 'info@door-fujita.com', 'password' => 'passc'];
$opts = ['http' => ['method' => 'POST', 'header' => "Content-type: application/json\r\n", 'content' => json_encode($data), 'ignore_errors' => true]];
$ctx = stream_context_create($opts);
$res = json_decode(file_get_contents($url, false, $ctx), true);

$token = $res['token'];

$url2 = 'http://127.0.0.1:8000/items';
$opts2 = ['http' => ['method' => 'GET', 'header' => "Authorization: Bearer $token\r\n", 'ignore_errors' => true]];
$ctx2 = stream_context_create($opts2);
$res2 = file_get_contents($url2, false, $ctx2);

echo "HTTP Response: $http_response_header[0]\n";
echo "Response Body:\n$res2\n";
