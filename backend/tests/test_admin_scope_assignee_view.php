<?php
/**
 * R-050 Phase1 管理者スコープ・assigned_to ID空間解決テスト
 *
 * テストケース:
 * 1. 管理者が他の担当者の assigned_to を指定して一覧取得できる（scope=team）
 * 2. 非管理者が他者の assigned_to を指定すると403
 * 3. 他テナントのユーザーIDを assigned_to に指定するとエラー
 * 4. u_ 形式の assigned_to で assigneeName / assigneeKind: 'user' が正しく解決される
 * 5. 孤児データの assigned_to で assigneeName: null / assigneeKind: null になる
 */

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';

$testTenantA = 'r050_test_tenant_a';
$testTenantB = 'r050_test_tenant_b';
$testAdmin = 'u_r050_test_admin';
$testMember = 'u_r050_test_member';
$testAssignee = 'u_r050_test_assignee'; // tenantA に所属する担当者
$testOutsider = 'u_r050_test_outsider'; // tenantB のみ所属

$pdo = getDB();

function cleanup($pdo, $testTenantA, $testTenantB, $testAdmin, $testMember, $testAssignee, $testOutsider) {
    $pdo->exec("DELETE FROM items WHERE tenant_id IN ('$testTenantA', '$testTenantB')");
    $pdo->prepare("DELETE FROM memberships WHERE tenant_id IN (?, ?)")->execute([$testTenantA, $testTenantB]);
    $pdo->prepare("DELETE FROM users WHERE id IN (?, ?, ?, ?)")->execute([$testAdmin, $testMember, $testAssignee, $testOutsider]);
    $pdo->prepare("DELETE FROM tenants WHERE id IN (?, ?)")->execute([$testTenantA, $testTenantB]);
}

cleanup($pdo, $testTenantA, $testTenantB, $testAdmin, $testMember, $testAssignee, $testOutsider);

// --- セットアップ ---
$pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)")->execute([$testTenantA, 'R-050 Tenant A', time()]);
$pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)")->execute([$testTenantB, 'R-050 Tenant B', time()]);

$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testAdmin, 'r050admin@example.com', 'hash', '管理者太郎']);
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testMember, 'r050member@example.com', 'hash', '一般社員花子']);
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testAssignee, 'r050assignee@example.com', 'hash', '担当者次郎']);
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testOutsider, 'r050outsider@example.com', 'hash', '部外者三郎']);

$pdo->prepare("INSERT INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")->execute([$testTenantA, $testAdmin, 'owner']);
$pdo->prepare("INSERT INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")->execute([$testTenantA, $testMember, 'member']);
$pdo->prepare("INSERT INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")->execute([$testTenantA, $testAssignee, 'member']);
$pdo->prepare("INSERT INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")->execute([$testTenantB, $testOutsider, 'member']);

$now = time();
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, created_at, updated_at) VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?)")
    ->execute(['r050_item_assignee', 'Assignee Item', $testTenantA, $testAdmin, $testAssignee, $now, $now]);

// 孤児データ（どちらのテーブルにも一致しない値）
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, created_at, updated_at) VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?)")
    ->execute(['r050_item_orphan', 'Orphan Item', $testTenantA, $testAdmin, 'u_r050_orphan_ghost', $now, $now]);

// --- テストハーネス ---
function makeController($pdo, $userId, $tenantId, $joinedTenants) {
    return new class($pdo, $userId, $tenantId, $joinedTenants) extends ItemController {
        private $mockInput = [];
        private $lastResponse = null;
        private $lastError = null;

        public function __construct($pdo, $userId, $tenantId, $joinedTenants) {
            $this->pdo = $pdo;
            $this->currentUserId = $userId;
            $this->currentTenantId = $tenantId;
            $this->joinedTenants = $joinedTenants;
            $this->currentUser = ['sub' => $userId, 'role' => 'member']; // JWTのroleは信頼しない前提を確認するため意図的にmemberにする
        }

        protected function getInput() { return $this->mockInput; }
        protected function sendJSON($data) { $this->lastResponse = $data; }
        protected function sendError($code, $msg) {
            $this->lastError = ['code' => $code, 'message' => $msg];
            throw new Exception("ERROR $code: $msg");
        }
        protected function authenticate() {}

        public function getLastResponse() { return $this->lastResponse; }
        public function getLastError() { return $this->lastError; }

        public function callGetMyItems() {
            $ref = new ReflectionMethod('ItemController', 'getMyItems');
            $ref->setAccessible(true);
            $ref->invoke($this);
        }

        public function callResolveAssigneeInfo($assignedTo) {
            $ref = new ReflectionMethod('BaseController', 'resolveAssigneeInfo');
            $ref->setAccessible(true);
            return $ref->invoke($this, $assignedTo);
        }
    };
}

$passed = 0;
$failed = 0;

function assert_equal($label, $actual, $expected) {
    global $passed, $failed;
    if ($actual === $expected) {
        echo "  OK PASS: $label\n";
        $passed++;
    } else {
        echo "  NG FAIL: $label\n";
        echo "    expected: " . var_export($expected, true) . "\n";
        echo "    actual  : " . var_export($actual, true) . "\n";
        $failed++;
    }
}

function assert_true($label, $actual) {
    global $passed, $failed;
    if ($actual === true) {
        echo "  OK PASS: $label\n";
        $passed++;
    } else {
        echo "  NG FAIL: $label (not true: " . var_export($actual, true) . ")\n";
        $failed++;
    }
}

// ============================================================
// テスト1: 管理者が他の担当者の assigned_to を指定して一覧取得できる
// ============================================================
echo "\n=== テスト1: 管理者(owner)が scope=team で他者の担当分を取得できる ===\n";
$_GET = ['scope' => 'team', 'assigned_to' => $testAssignee];
$ctrl = makeController($pdo, $testAdmin, $testTenantA, [$testTenantA]);
$ctrl->callGetMyItems();
$resp = $ctrl->getLastResponse();
$ids = $resp ? array_column($resp, 'id') : [];
assert_true('レスポンスにr050_item_assigneeが含まれる', in_array('r050_item_assignee', $ids));

// ============================================================
// テスト2: 非管理者が他者の assigned_to を指定すると403
// ============================================================
echo "\n=== テスト2: 非管理者(member)が他者を指定すると403 ===\n";
$_GET = ['scope' => 'team', 'assigned_to' => $testAssignee];
$ctrl = makeController($pdo, $testMember, $testTenantA, [$testTenantA]);
$err403 = false;
try {
    $ctrl->callGetMyItems();
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'ERROR 403') !== false) $err403 = true;
}
assert_true('非管理者は403エラー', $err403);

// ============================================================
// テスト3: 他テナントのユーザーIDを assigned_to に指定するとエラー
// ============================================================
echo "\n=== テスト3: 管理者でも他テナント所属ユーザーを指定するとエラー ===\n";
$_GET = ['scope' => 'team', 'assigned_to' => $testOutsider];
$ctrl = makeController($pdo, $testAdmin, $testTenantA, [$testTenantA]);
$errTenantMismatch = false;
try {
    $ctrl->callGetMyItems();
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'ERROR 404') !== false || strpos($e->getMessage(), 'ERROR 400') !== false) {
        $errTenantMismatch = true;
    }
}
assert_true('他テナントユーザー指定でエラー', $errTenantMismatch);

// ============================================================
// テスト4: u_ 形式の assigned_to で assigneeName / assigneeKind が正しく解決される
// ============================================================
echo "\n=== テスト4: u_形式のassigned_toが正しく解決される ===\n";
$ctrl = makeController($pdo, $testAdmin, $testTenantA, [$testTenantA]);
$info = $ctrl->callResolveAssigneeInfo($testAssignee);
assert_equal('assigneeName = 担当者次郎', $info['name'], '担当者次郎');
assert_equal("assigneeKind = 'user'", $info['kind'], 'user');

// ============================================================
// テスト5: 孤児データの assigned_to で「未割当」相当になる
// ============================================================
echo "\n=== テスト5: 孤児データは未割当扱いになる ===\n";
$ctrl = makeController($pdo, $testAdmin, $testTenantA, [$testTenantA]);
$orphanInfo = $ctrl->callResolveAssigneeInfo('u_r050_orphan_ghost');
assert_equal('assigneeName = null（孤児データ）', $orphanInfo['name'], null);
assert_equal('assigneeKind = null（孤児データ）', $orphanInfo['kind'], null);

// --- 後片付け ---
cleanup($pdo, $testTenantA, $testTenantB, $testAdmin, $testMember, $testAssignee, $testOutsider);

echo "\n=== 結果: $passed passed, $failed failed ===\n";
if ($failed > 0) {
    echo "FAILED\n";
    exit(1);
} else {
    echo "SUCCESS\n";
    exit(0);
}
