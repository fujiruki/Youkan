<?php
/**
 * R-139 完全削除（POST /items/{id}/destroy）テスト
 *
 * テストケース:
 * 1. index.php のルーティングが呼ぶ ItemController::destroy_permanent が public メソッドとして存在する
 * 2. destroy_permanent で対象アイテムと子孫が物理削除され、deletedDescendantIds が返る
 */

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';

$testUserId = 'r139_test_user';
$testTenantId = 'r139_test_tenant';

$pdo = getDB();

$pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testUserId, 'r139_test@example.com', 'hash', 'R-139 Test User']);
$pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
    ->execute([$testTenantId, 'R-139 Test Tenant']);
$pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
    ->execute([$testTenantId, $testUserId, 'owner']);
$pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserId]);

$passed = 0;
$failed = 0;
function assert_true($label, $cond) {
    global $passed, $failed;
    if ($cond) { echo "  ✓ PASS: $label\n"; $passed++; }
    else { echo "  ✗ FAIL: $label\n"; $failed++; }
}

$ctrl = new class($pdo, $testUserId, $testTenantId) extends ItemController {
    public $lastResponse = null;
    public function __construct($pdo, $userId, $tenantId) {
        $this->pdo = $pdo;
        $this->currentUserId = $userId;
        $this->currentTenantId = $tenantId;
        $this->joinedTenants = [$tenantId];
        $this->currentUser = ['sub' => $userId, 'role' => 'member'];
    }
    protected function authenticate() {}
    protected function sendJSON($data) { $this->lastResponse = $data; }
    protected function sendError($code, $msg) { throw new Exception("ERROR $code: $msg"); }
};

echo "\n=== テスト1: destroy_permanent が public メソッドとして存在する ===\n";
$exists = method_exists($ctrl, 'destroy_permanent') && (new ReflectionMethod('ItemController', 'destroy_permanent'))->isPublic();
assert_true('ItemController::destroy_permanent が public で定義されている', $exists);

echo "\n=== テスト2: destroy_permanent で親子が物理削除される ===\n";
if ($exists) {
    $now = time();
    $ins = $pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, is_project, parent_id, project_id, deleted_at, created_at, updated_at)
                          VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?, ?, ?, ?, ?)");
    $ins->execute(['r139_p', 'R139 親', $testTenantId, $testUserId, $testUserId, 1, null, null, $now, $now, $now]);
    $ins->execute(['r139_c', 'R139 子', $testTenantId, $testUserId, $testUserId, 0, 'r139_p', 'r139_p', $now, $now, $now]);

    $ctrl->destroy_permanent('r139_p');
    $resp = $ctrl->lastResponse;
    assert_true('success=true が返る', ($resp['success'] ?? false) === true);
    assert_true('deletedDescendantIds に子が含まれる', in_array('r139_c', $resp['deletedDescendantIds'] ?? [], true));
    $cnt = $pdo->prepare("SELECT COUNT(*) FROM items WHERE id IN ('r139_p','r139_c')");
    $cnt->execute();
    assert_true('親子とも items から物理削除されている', (int)$cnt->fetchColumn() === 0);
} else {
    echo "  (スキップ: メソッド未定義)\n";
    $failed += 3;
}

$pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserId]);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
