<?php
// backend/tests/test_improvement_request_controller.php
// R-071: 改善要望送信フォーム（画像添付付き）バックエンド統合テスト
//
// 検証項目:
//   (a) 未認証アクセスは401になること
//   (b) 本文が空（または空白のみ）だとエラーになること
//   (c) 画像なしでも送信できること
//   (d) 画像ありで送信すると backend/data/requests_sub_uploads/ に保存されること
//   (e) requests_sub.md に正しいフォーマットで追記されること
//   (f) 5MB超の画像は拒否されること
//
// PHP内蔵サーバーを一時ディレクトリ(実DB・本体を汚さないための隔離コピー)で起動して検証する。
// アプリケーション層の5MB上限を確実に検証するため、内蔵サーバー起動時に
// upload_max_filesize/post_max_size をiniより緩く上書きする(-d オプション)。

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

/**
 * multipart/form-data で POST する(curl使用)。
 * $file: ['path'=>tmpファイルパス, 'name'=>アップロード時のファイル名, 'mime'=>Content-Type, 'field'=>フィールド名]
 */
function httpPostMultipart(string $url, ?string $token, array $fields, ?array $file = null): array {
    $ch = curl_init($url);
    $postFields = $fields;
    if ($file) {
        $postFields[$file['field'] ?? 'image'] = new CURLFile($file['path'], $file['mime'] ?? 'application/octet-stream', $file['name'] ?? 'upload.bin');
    }
    $headers = [];
    if ($token) {
        $headers[] = "Authorization: Bearer $token";
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $postFields,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 15,
    ]);
    $body = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    curl_close($ch);
    return ['status' => $status, 'body' => $body, 'curl_error' => $curlError];
}

echo "=== R-071: 改善要望送信フォーム バックエンド統合テスト ===\n\n";

// --- 1. backend を一時ディレクトリへ隔離コピー ---
$backendDir = realpath(__DIR__ . '/..');
$tmpDir = sys_get_temp_dir() . '/youkan_improvement_request_test_' . uniqid();
copyDirExcluding($backendDir, $tmpDir, ['jbwos.sqlite', 'tests', 'request.log', 'php_errors.log', 'auth_debug.log', '.git', 'data']);

// --- 2. PHP内蔵サーバー起動 (upload制限を一時的に緩和して5MB上限のアプリ層検証を可能にする) ---
// [Windows対策] stdout/stderrをpipeにすると、大量の複数リクエストで
// devサーバーのアクセスログがバッファを埋めてデッドロックするため、ファイルへ直接出力させる。
$port = 19000 + random_int(0, 999);
$stdoutLog = $tmpDir . '/_server_stdout.log';
$stderrLog = $tmpDir . '/_server_stderr.log';
$descriptorSpec = [
    0 => ['pipe', 'r'],
    1 => ['file', $stdoutLog, 'w'],
    2 => ['file', $stderrLog, 'w'],
];
$cmd = sprintf(
    'php -d upload_max_filesize=10M -d post_max_size=10M -S 127.0.0.1:%d router.php',
    $port
);
$process = proc_open($cmd, $descriptorSpec, $pipes, $tmpDir);

if (!is_resource($process)) {
    echo "FAILED: could not start built-in server\n";
    removeDirRecursive($tmpDir);
    exit(1);
}

// サーバー起動待ち
$ready = false;
for ($i = 0; $i < 50; $i++) {
    usleep(100000); // 100ms
    $res = @file_get_contents("http://127.0.0.1:$port/health.php");
    if ($res !== false) {
        $ready = true;
        break;
    }
}

$baseUrl = "http://127.0.0.1:$port/improvement-requests";
$dataDir = "$tmpDir/data";
$mdPath = "$dataDir/requests_sub.md";
$uploadsDir = "$dataDir/requests_sub_uploads";

try {
    if (!$ready) {
        echo "FAILED: server did not become ready\n";
        exit(1);
    }

    // --- (a) 未認証アクセスは401になること ---
    $res = httpPostMultipart($baseUrl, null, ['content' => '未認証テスト']);
    assertTrue(
        '(a) 未認証POSTは401になる',
        $res['status'] === 401,
        'status=' . $res['status'] . ' body=' . $res['body']
    );

    // --- (b) 本文が空/空白のみだとエラーになること ---
    $res = httpPostMultipart($baseUrl, 'mock-debug-token', ['content' => '   ']);
    assertTrue(
        '(b) 空白のみの本文は400になる',
        $res['status'] === 400,
        'status=' . $res['status'] . ' body=' . $res['body']
    );

    $res = httpPostMultipart($baseUrl, 'mock-debug-token', ['content' => '']);
    assertTrue(
        '(b) 空文字の本文は400になる',
        $res['status'] === 400,
        'status=' . $res['status'] . ' body=' . $res['body']
    );

    // --- (c) 画像なしでも送信できること ---
    $res = httpPostMultipart($baseUrl, 'mock-debug-token', ['content' => '画像なしテスト本文です']);
    assertTrue(
        '(c) 画像なし送信は成功する(200)',
        $res['status'] === 200,
        'status=' . $res['status'] . ' body=' . $res['body']
    );
    $json = json_decode($res['body'] ?? '', true);
    assertTrue('(c) レスポンスにsuccess:trueが含まれる', ($json['success'] ?? false) === true, json_encode($json));

    assertTrue('(c) requests_sub.mdが作成されている', file_exists($mdPath));
    $mdContent = file_exists($mdPath) ? file_get_contents($mdPath) : '';

    // --- (e) requests_sub.md のフォーマット確認 ---
    assertTrue(
        '(e) 見出しフォーマット「## YYYY-MM-DD HH:MM (user: ...)」が含まれる',
        (bool)preg_match('/^## \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(user: .+\)$/m', $mdContent),
        $mdContent
    );
    assertTrue(
        '(e) 本文「画像なしテスト本文です」が含まれる',
        strpos($mdContent, '画像なしテスト本文です') !== false
    );
    assertTrue(
        '(e) 区切り線 --- が含まれる',
        strpos($mdContent, '---') !== false
    );

    // --- (d) 画像ありで送信すると requests_sub_uploads/ に保存されること ---
    $smallImagePath = $tmpDir . '/small_test_image.png';
    file_put_contents($smallImagePath, str_repeat('A', 1024)); // 1KB ダミー(拡張子とcontent-typeのみで検証するため内容は問わない)

    $existingUploadFiles = is_dir($uploadsDir) ? array_diff(scandir($uploadsDir), ['.', '..']) : [];

    $res = httpPostMultipart(
        $baseUrl,
        'mock-debug-token',
        ['content' => '画像付きテスト本文です'],
        ['path' => $smallImagePath, 'name' => 'screenshot.png', 'mime' => 'image/png', 'field' => 'image']
    );
    assertTrue(
        '(d) 画像あり送信は成功する(200)',
        $res['status'] === 200,
        'status=' . $res['status'] . ' body=' . $res['body']
    );

    assertTrue('(d) requests_sub_uploads/ が作成されている', is_dir($uploadsDir));
    $newUploadFiles = is_dir($uploadsDir) ? array_diff(scandir($uploadsDir), ['.', '..']) : [];
    $addedFiles = array_diff($newUploadFiles, $existingUploadFiles);
    assertTrue('(d) アップロード画像が1件追加されている', count($addedFiles) === 1, 'files=' . json_encode(array_values($newUploadFiles)));

    $addedFileName = array_values($addedFiles)[0] ?? null;
    assertTrue(
        '(d) 保存ファイル名がUUID.png形式である',
        $addedFileName !== null && preg_match('/^[0-9a-f-]{36}\.png$/i', $addedFileName) === 1,
        'filename=' . $addedFileName
    );

    $mdContentAfterImage = file_get_contents($mdPath);
    assertTrue(
        '(e) requests_sub.mdに画像リンクが追記されている',
        $addedFileName !== null && strpos($mdContentAfterImage, "![screenshot](requests_sub_uploads/{$addedFileName})") !== false,
        $mdContentAfterImage
    );

    // --- (f) 5MB超の画像は拒否されること ---
    $bigImagePath = $tmpDir . '/big_test_image.png';
    file_put_contents($bigImagePath, str_repeat('A', 6 * 1024 * 1024)); // 6MB

    $uploadFilesBeforeBig = is_dir($uploadsDir) ? array_diff(scandir($uploadsDir), ['.', '..']) : [];

    $res = httpPostMultipart(
        $baseUrl,
        'mock-debug-token',
        ['content' => 'サイズ超過テスト'],
        ['path' => $bigImagePath, 'name' => 'huge.png', 'mime' => 'image/png', 'field' => 'image']
    );
    assertTrue(
        '(f) 5MB超の画像は400で拒否される',
        $res['status'] === 400,
        'status=' . $res['status'] . ' body=' . $res['body']
    );

    $uploadFilesAfterBig = is_dir($uploadsDir) ? array_diff(scandir($uploadsDir), ['.', '..']) : [];
    assertTrue(
        '(f) 拒否時にファイルが保存されていない',
        count($uploadFilesAfterBig) === count($uploadFilesBeforeBig),
        'before=' . count($uploadFilesBeforeBig) . ' after=' . count($uploadFilesAfterBig)
    );

    unlink($smallImagePath);
    unlink($bigImagePath);

} finally {
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
