<?php
// backend/tests/test_stocks_unauthenticated_access.php
// セキュリティ修正: /stocks 系ルートが未認証でアクセスできないことを検証する統合テスト
//
// 背景 (R-069):
//   StockController の各メソッドは authenticate() を一切呼んでおらず、
//   index.php に登録された /stocks 系ルートが未認証で到達可能だった。
//   特に assign() は任意の userId を指定して items テーブルへ直接INSERTできた。
//
// 検証方法:
//   PHP内蔵サーバーを一時ディレクトリ(実DBを汚さないための隔離コピー)で起動し、
//   Authorizationヘッダーなしで /stocks 系エンドポイントを叩く。
//   修正前: 200 で成功してしまう(脆弱)。
//   修正後: 404 (ルート自体を index.php から削除したため到達不能)。

$passed = 0;
$failed = 0;

function assertTrue($name, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) {
        echo "[PASS] $name\n";
        $passed++;
    } else {
        echo "[FAIL] $name" . ($detail ? " - $detail" : '') . "\n";
        $failed++;
    }
}

function copyDirExcluding(string $src, string $dst, array $excludeNames): void {
    if (!is_dir($dst)) mkdir($dst, 0777, true);
    foreach (scandir($src) as $item) {
        if ($item === '.' || $item === '..') continue;
        if (in_array($item, $excludeNames, true)) continue;
        $srcPath = "$src/$item";
        $dstPath = "$dst/$item";
        if (is_dir($srcPath)) {
            copyDirExcluding($srcPath, $dstPath, $excludeNames);
        } else {
            copy($srcPath, $dstPath);
        }
    }
}

function removeDirRecursive(string $dir): void {
    if (!is_dir($dir)) return;
    foreach (scandir($dir) as $item) {
        if ($item === '.' || $item === '..') continue;
        $path = "$dir/$item";
        is_dir($path) ? removeDirRecursive($path) : @unlink($path);
    }
    @rmdir($dir);
}

function httpRequest(string $method, string $url, ?array $body = null): array {
    $opts = [
        'http' => [
            'method' => $method,
            'header' => "Content-Type: application/json\r\n",
            'content' => $body !== null ? json_encode($body) : '',
            'ignore_errors' => true,
            'timeout' => 5,
        ],
    ];
    $ctx = stream_context_create($opts);
    $responseBody = @file_get_contents($url, false, $ctx);
    $status = 0;
    if (isset($http_response_header)) {
        foreach ($http_response_header as $h) {
            if (preg_match('#^HTTP/\S+\s+(\d+)#', $h, $m)) {
                $status = (int)$m[1];
            }
        }
    }
    return ['status' => $status, 'body' => $responseBody];
}

echo "=== R-069: /stocks 未認証アクセス脆弱性の再現テスト ===\n\n";

// --- 1. backend を一時ディレクトリへ隔離コピー(実DB・テスト自身を除外) ---
$backendDir = realpath(__DIR__ . '/..');
$tmpDir = sys_get_temp_dir() . '/youkan_stock_sec_test_' . uniqid();
copyDirExcluding($backendDir, $tmpDir, ['jbwos.sqlite', 'tests', 'request.log', 'php_errors.log', 'auth_debug.log', '.git']);

// --- 2. PHP内蔵サーバー起動 ---
$port = 18000 + random_int(0, 999);
$descriptorSpec = [
    0 => ['pipe', 'r'],
    1 => ['pipe', 'w'],
    2 => ['pipe', 'w'],
];
$cmd = sprintf('php -S 127.0.0.1:%d router.php', $port);
$process = proc_open($cmd, $descriptorSpec, $pipes, $tmpDir);

if (!is_resource($process)) {
    echo "FAILED: could not start built-in server\n";
    removeDirRecursive($tmpDir);
    exit(1);
}
stream_set_blocking($pipes[1], false);
stream_set_blocking($pipes[2], false);

// サーバー起動待ち(health.php は認証不要な静的ファイル)
$ready = false;
for ($i = 0; $i < 50; $i++) {
    usleep(100000); // 100ms
    $res = @file_get_contents("http://127.0.0.1:$port/health.php");
    if ($res !== false) {
        $ready = true;
        break;
    }
}

try {
    if (!$ready) {
        echo "FAILED: server did not become ready\n";
        exit(1);
    }

    // --- 3. 未認証で POST /stocks (在庫作成) ---
    $createRes = httpRequest('POST', "http://127.0.0.1:$port/stocks", [
        'title' => '不正在庫タスク',
    ]);
    assertTrue(
        '未認証 POST /stocks は成功してはならない(期待: 404 ルート未登録)',
        $createRes['status'] === 404,
        'status=' . $createRes['status'] . ' body=' . $createRes['body']
    );

    // 修正前(脆弱)は id が返るため、それを使って assign 攻撃を試みる。
    // 修正後は 404 のため id は取れず、代わりにダミーIDを使う。
    $createdBody = json_decode($createRes['body'] ?? '', true);
    $stockId = $createdBody['id'] ?? 'fake-stock-id';

    // --- 4. 未認証で GET /stocks (在庫一覧) ---
    $listRes = httpRequest('GET', "http://127.0.0.1:$port/stocks");
    assertTrue(
        '未認証 GET /stocks は成功してはならない(期待: 404)',
        $listRes['status'] === 404,
        'status=' . $listRes['status']
    );

    // --- 5. 未認証で POST /stocks/{id}/assign (任意 userId で items へ直接INSERTを試みる) ---
    $assignRes = httpRequest('POST', "http://127.0.0.1:$port/stocks/$stockId/assign", [
        'userId' => 'attacker-controlled-user-id',
    ]);
    assertTrue(
        '未認証 POST /stocks/{id}/assign は成功してはならない(期待: 404。他テナントのitemsへの不正INSERTを防ぐ)',
        $assignRes['status'] === 404,
        'status=' . $assignRes['status'] . ' body=' . $assignRes['body']
    );

} finally {
    // --- 6. サーバー終了 & 後片付け ---
    foreach ($pipes as $p) {
        if (is_resource($p)) fclose($p);
    }
    if (is_resource($process)) {
        proc_terminate($process);
        proc_close($process);
    }
    removeDirRecursive($tmpDir);
}

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
