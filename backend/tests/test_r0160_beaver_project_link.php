<?php
/**
 * R-0160 Beaver連携: 案件→Youkanプロジェクト直リンク解決API
 * docs/SPEC/13_Beaver連携プロジェクトURL.md §6 必須テスト
 */
$tmpDb = sys_get_temp_dir() . '/youkan_r0160_link_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../services/BeaverSyncService.php';
require_once __DIR__ . '/../IntegrationController.php';
require_once __DIR__ . '/../JWTService.php';
require_once __DIR__ . '/helpers/FakeHttpClient.php';

$passed = 0;
$failed = 0;
function assert_true($label, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) { echo "  ✓ PASS: $label\n"; $passed++; }
    else { echo "  ✗ FAIL: $label" . ($detail !== '' ? " ($detail)" : '') . "\n"; $failed++; }
}

// --- データ準備 ---
$pdo = getDB();
foreach (['t_link', 't_link2'] as $t) {
    $pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('$t', '$t', 0)");
}
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_link', 'link@example.com', password_hash('pw', PASSWORD_DEFAULT), 'リンク太郎']);
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_out', 'out_link@example.com', password_hash('pw', PASSWORD_DEFAULT), '部外者']);
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at, is_core) VALUES ('u_link', 't_link', 'owner', 0, 1)");
$pdo->exec("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES ('tok_link', 'u_link', 'sk_link', 'B2', 0)");
$pdo->exec("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES ('tok_out', 'u_out', 'sk_out_link', '部外者', 0)");

$insItem = $pdo->prepare("INSERT INTO items (id, tenant_id, title, status, created_by, is_project, created_at, updated_at, deleted_at) VALUES (?,?,?,?,'u_link',1,0,0,?)");
$insLink = $pdo->prepare("INSERT INTO external_project_links (id, tenant_id, source_system, external_project_id, youkan_project_id, source_name, source_status, sync_state, last_synced_at, created_at) VALUES (?,?,'beaver',?,?,?,?,'ok',0,0)");

// 通常: リンクあり
$insItem->execute(['prj_701', 't_link', '案件701（Youkan側表示名）', 'inbox', null]);
$insLink->execute(['l_701', 't_link', 701, 'prj_701', '案件701（Beaver由来名）', '受注済']);

// sync_state='missing_upstream' でも200
$insItem->execute(['prj_702', 't_link', '案件702', 'inbox', null]);
$insLink->execute(['l_702', 't_link', 702, 'prj_702', '案件702', '受注済']);
$pdo->exec("UPDATE external_project_links SET sync_state = 'missing_upstream' WHERE id = 'l_702'");

// リンク先Youkanプロジェクトが削除済み（deleted_at IS NOT NULL）
$insItem->execute(['prj_703', 't_link', '案件703', 'inbox', time() * 1000]);
$insLink->execute(['l_703', 't_link', 703, 'prj_703', '案件703', '受注済']);

// 他テナントの同じexternal_project_id（誤って返さないことの確認）
$insItem->execute(['prj_701b', 't_link2', '別テナント案件701', 'inbox', null]);
$insLink->execute(['l_701b', 't_link2', 701, 'prj_701b', '別テナント案件701', '受注済']);

class ApiError extends Exception {
    public $payload;
    public function __construct($code, $payload) { parent::__construct(is_array($payload) ? ($payload['error'] ?? '') : $payload, $code); $this->payload = is_array($payload) ? $payload : ['error' => $payload]; }
}
class TestIntegrationController extends IntegrationController {
    public $lastResponse = null;
    public $input = [];
    public static $service = null;
    protected function sendJSON($data) { $this->lastResponse = $data; }
    protected function sendError($code, $message) { throw new ApiError($code, $message); }
    protected function sendErrorJson(int $code, array $payload) { throw new ApiError($code, $payload); }
    protected function getInput() { return $this->input; }
    protected function makeBeaverSyncService(): ?BeaverSyncService { return self::$service; }
}
function callBeaver($method, $path) {
    $_GET = [];
    $ctrl = new TestIntegrationController();
    try {
        $ctrl->handleRequest($method, $path);
        return [200, $ctrl->lastResponse];
    } catch (ApiError $e) {
        return [$e->getCode(), $e->payload];
    }
}

$_COOKIE = [];
$http = new FakeHttpClient();
TestIntegrationController::$service = new BeaverSyncService($pdo, [
    'api_base' => 'http://beaver.test',
    'api_token' => 'tkn',
    'tenant_id' => 't_link',
    'excluded_statuses' => BeaverSyncService::DEFAULT_EXCLUDED_STATUSES,
], $http);
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_link';

echo "\n=== テスト1: リンクが存在する案件で200・正しい値が返る ===\n";
[$code, $res] = callBeaver('GET', '/beaver/project-link/701');
assert_true('200が返る', $code === 200, "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));
assert_true('external_project_id=701（整数）', ($res['external_project_id'] ?? null) === 701, json_encode($res));
assert_true('youkan_project_id=prj_701', ($res['youkan_project_id'] ?? null) === 'prj_701', json_encode($res));
assert_true('titleはYoukan側の現在値（Beaver由来名ではない）', ($res['title'] ?? null) === '案件701（Youkan側表示名）', json_encode($res, JSON_UNESCAPED_UNICODE));
assert_true('tenant_id=t_link', ($res['tenant_id'] ?? null) === 't_link', json_encode($res));

echo "\n=== テスト2: リンクが存在しない案件で404 reason:not_found ===\n";
[$code, $res] = callBeaver('GET', '/beaver/project-link/9999');
assert_true('404', $code === 404, "code=$code " . json_encode($res));
assert_true('reason=not_found', ($res['reason'] ?? null) === 'not_found', json_encode($res));

echo "\n=== テスト3: sync_state=missing_upstream でも200で返る ===\n";
[$code, $res] = callBeaver('GET', '/beaver/project-link/702');
assert_true('200', $code === 200, "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));
assert_true('youkan_project_id=prj_702', ($res['youkan_project_id'] ?? null) === 'prj_702', json_encode($res));

echo "\n=== テスト4: リンク先プロジェクトが削除済み(deleted_at IS NOT NULL)は404 not_found ===\n";
[$code, $res] = callBeaver('GET', '/beaver/project-link/703');
assert_true('404', $code === 404, "code=$code " . json_encode($res));
assert_true('reason=not_found', ($res['reason'] ?? null) === 'not_found', json_encode($res));

echo "\n=== テスト5: external_project_idが整数でない場合は400 ===\n";
[$code, $res] = callBeaver('GET', '/beaver/project-link/abc');
assert_true('400', $code === 400, "code=$code " . json_encode($res));

echo "\n=== テスト6: トークンなし・不一致は401 ===\n";
unset($_SERVER['HTTP_AUTHORIZATION']);
[$code] = callBeaver('GET', '/beaver/project-link/701');
assert_true('トークンなしは401', $code === 401, "code=$code");
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_unknown_xyz';
[$code] = callBeaver('GET', '/beaver/project-link/701');
assert_true('不正トークンは401', $code === 401, "code=$code");

echo "\n=== テスト7: 対象テナント未所属のトークンは403 ===\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_out_link';
[$code] = callBeaver('GET', '/beaver/project-link/701');
assert_true('403', $code === 403, "code=$code");

echo "\n=== テスト8: .env未設定は503 ===\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_link';
TestIntegrationController::$service = null;
[$code] = callBeaver('GET', '/beaver/project-link/701');
assert_true('503', $code === 503, "code=$code");
TestIntegrationController::$service = new BeaverSyncService($pdo, [
    'api_base' => 'http://beaver.test',
    'api_token' => 'tkn',
    'tenant_id' => 't_link',
    'excluded_statuses' => BeaverSyncService::DEFAULT_EXCLUDED_STATUSES,
], $http);

echo "\n=== テスト9: GET以外(POST等)は405 ===\n";
[$code] = callBeaver('POST', '/beaver/project-link/701');
assert_true('405', $code === 405, "code=$code");

echo "\n=== テスト10: 他テナントの同じexternal_project_idを誤って返さない ===\n";
[$code, $res] = callBeaver('GET', '/beaver/project-link/701');
assert_true('t_linkのリンクが返る（t_link2の値ではない）', $code === 200 && ($res['youkan_project_id'] ?? null) === 'prj_701', json_encode($res, JSON_UNESCAPED_UNICODE));

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
