<?php
/**
 * R-141 POST /integrations/inbox の created_by / tenant_id テスト
 *
 * 1. 登録直後に fetchAggregatedItems()（全体一覧・digest の母集合）に含まれる
 * 2. tenant_id 省略時は authenticate() が解決した currentTenantId、明示時は所属テナントのみ採用
 * 3. 非所属テナント指定は 400
 */
$tmpDb = sys_get_temp_dir() . '/youkan_r141_test_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../IntegrationController.php';
require_once __DIR__ . '/../JWTService.php';

$passed = 0;
$failed = 0;
function assert_true($label, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) { echo "  ✓ PASS: $label\n"; $passed++; }
    else { echo "  ✗ FAIL: $label" . ($detail !== '' ? " ($detail)" : '') . "\n"; $failed++; }
}

class ApiError extends Exception {}

class TestIntegrationController extends IntegrationController {
    public $lastResponse = null;
    public $input = [];
    protected function sendJSON($data) { $this->lastResponse = $data; }
    protected function sendError($code, $message) { throw new ApiError($message, $code); }
    protected function getInput() { return $this->input; }
    public function aggregatedIds(): array {
        $this->authenticate();
        return array_map(fn($r) => $r['id'], $this->fetchAggregatedItems());
    }
}

function callInbox(array $input) {
    $_GET = [];
    $ctrl = new TestIntegrationController();
    $ctrl->input = $input;
    try {
        $ctrl->handleRequest('POST', '/inbox');
        return [200, $ctrl->lastResponse];
    } catch (ApiError $e) {
        return [$e->getCode(), ['error' => $e->getMessage()]];
    }
}

$pdo = getDB();
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_a', 'テナントA', 0)");
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_b', 'テナントB', 0)");
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('t_x', '非所属', 0)");
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name, created_at) VALUES (?, ?, ?, ?, 0)")
    ->execute(['u_a', 'a@example.com', password_hash('pw', PASSWORD_DEFAULT), 'A']);
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES ('u_a', 't_a', 'owner', 0)");
$pdo->exec("INSERT INTO memberships (user_id, tenant_id, role, joined_at) VALUES ('u_a', 't_b', 'member', 1)");
$pdo->exec("INSERT INTO api_tokens (id, user_id, token, label, created_at) VALUES ('tok_a', 'u_a', 'sk_a_secret', '番頭', 0)");
$_COOKIE = [];

echo "\n=== テスト1: api_token で inbox 登録 → 本人の全体一覧に含まれる ===\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_a_secret';
[$code, $res] = callInbox(['title' => '番頭から']);
assert_true('200 で id を返す', $code === 200 && !empty($res['id']), "code=$code " . json_encode($res, JSON_UNESCAPED_UNICODE));
$row = $pdo->query("SELECT created_by, tenant_id FROM items WHERE id = " . $pdo->quote($res['id'] ?? ''))->fetch(PDO::FETCH_ASSOC);
assert_true('created_by = 認証ユーザー', ($row['created_by'] ?? null) === 'u_a', json_encode($row));
assert_true('tenant_id = memberships 先頭テナント(t_a)', ($row['tenant_id'] ?? null) === 't_a', json_encode($row));
$ids = (new TestIntegrationController())->aggregatedIds();
assert_true('fetchAggregatedItems() に含まれる', in_array($res['id'] ?? '', $ids, true), json_encode($ids));

echo "\n=== テスト2: JWT の tenant_id が currentTenantId として使われる ===\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer ' . JWTService::encrypt(['sub' => 'u_a', 'tenant_id' => 't_b', 'role' => 'member', 'exp' => time() + 3600]);
[$code2, $res2] = callInbox(['title' => 'JWT経由']);
$row2 = $pdo->query("SELECT created_by, tenant_id FROM items WHERE id = " . $pdo->quote($res2['id'] ?? ''))->fetch(PDO::FETCH_ASSOC);
assert_true('tenant_id = JWT の t_b', $code2 === 200 && ($row2['tenant_id'] ?? null) === 't_b', "code=$code2 " . json_encode($row2));

echo "\n=== テスト3: tenant_id 明示 ===\n";
$_SERVER['HTTP_AUTHORIZATION'] = 'Bearer sk_a_secret';
[$code3, $res3] = callInbox(['title' => '明示', 'tenant_id' => 't_b']);
$row3 = $pdo->query("SELECT tenant_id FROM items WHERE id = " . $pdo->quote($res3['id'] ?? ''))->fetch(PDO::FETCH_ASSOC);
assert_true('所属テナント(t_b)を明示すると採用', $code3 === 200 && ($row3['tenant_id'] ?? null) === 't_b', "code=$code3 " . json_encode($row3));
[$code4, $res4] = callInbox(['title' => '非所属', 'tenant_id' => 't_x']);
assert_true('非所属テナント指定は 400', $code4 === 400, "code=$code4 " . json_encode($res4));
assert_true('非所属指定時はアイテムが作られない', (int)$pdo->query("SELECT COUNT(*) FROM items WHERE title = '非所属'")->fetchColumn() === 0);
[$code5] = callInbox(['memo' => 'no title']);
assert_true('title 無しは 400', $code5 === 400, "code=$code5");

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
