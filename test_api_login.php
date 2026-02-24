<?php
$url = 'http://127.0.0.1:8000/auth/login/tenant';
$data = ['email' => 'info@door-fujita.com', 'password' => 'passc'];
$options = [
    'http' => [
        'header'  => "Content-type: application/json\r\n",
        'method'  => 'POST',
        'content' => json_encode($data),
        'ignore_errors' => true,
    ]
];
$context  = stream_context_create($options);
$result = file_get_contents($url, false, $context);
echo "HTTP Response: $http_response_header[0]\n";
echo "Response Body:\n$result\n";
