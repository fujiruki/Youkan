<?php
$url_login = 'http://127.0.0.1:8000/auth/login/tenant';
$data_login = ['email' => 'info@door-fujita.com', 'password' => 'passc'];
$opts_login = ['http' => ['method' => 'POST', 'header' => "Content-type: application/json\r\n", 'content' => json_encode($data_login), 'ignore_errors' => true]];
$ctx_login = stream_context_create($opts_login);
$res_login = json_decode(file_get_contents($url_login, false, $ctx_login), true);

$token = $res_login['token'];

$endpoints = [
    '/auth/me',
    '/items',
    '/items/gdb?scope=company',
    '/items/today?scope=company',
    '/memos',
    '/members',
    '/capacity',
    '/projects',
    '/auth/joined-tenants'
];

$output = "";
foreach ($endpoints as $endpoint) {
    $url = 'http://127.0.0.1:8000' . $endpoint;
    $opts = ['http' => ['method' => 'GET', 'header' => "Authorization: Bearer $token\r\n", 'ignore_errors' => true]];
    $ctx = stream_context_create($opts);
    $res = file_get_contents($url, false, $ctx);
    
    // Extract status code
    $status_line = $http_response_header[0];
    preg_match('#HTTP/\d+\.\d+ (\d+)#', $status_line, $match);
    $status_code = intval($match[1]);

    $output .= "[$status_code] GET $endpoint\n";
    if ($status_code !== 200) {
        $output .= "   Response: " . substr($res, 0, 500) . "\n";
    }
}
file_put_contents('test_output.txt', $output);
echo "Done.";
