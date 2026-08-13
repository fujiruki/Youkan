<?php
/**
 * R-099 GET /items系レスポンスへの依存関係グラフ埋め込みテスト
 * 仕様: docs/SPEC/04_データ設計.md §3.5「API露出（R-099）」
 *
 * テストケース:
 * 1. 個人アイテム一覧（scope未指定、getMyItems legacy分岐）で dependsOn/blocks が正しい
 * 2. scope=aggregated で dependsOn/blocks が正しい
 * 3. scope=personal で dependsOn/blocks が正しい
 * 4. scope=company で dependsOn/blocks が正しい
 * 5. scope=team（管理者による他者担当分取得）で dependsOn/blocks が正しい
 * 6. getProjectItems（project_id指定）で dependsOn/blocks が正しい
 * 7. getSubTasks（parent_id指定）で dependsOn/blocks が正しい
 * 8. show（単体取得）で dependsOn/blocks が正しい
 * 9. 依存関係を持たないアイテムは dependsOn=[]・blocks=[] になる
 * 10. N+1回避: 一覧取得1回につき item_dependencies へのクエリは1回のみ
 */

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';

$testTenant = 'r099_test_tenant';
$testAdmin = 'u_r099_test_admin';
$testMember = 'u_r099_test_member';

$pdo = getDB();

function r099_cleanup($pdo, $testTenant, $testAdmin, $testMember) {
    $pdo->exec("DELETE FROM item_dependencies WHERE tenant_id = '$testTenant' OR tenant_id IS NULL OR tenant_id = ''");
    $pdo->exec("DELETE FROM items WHERE id LIKE 'r099_%'");
    $pdo->prepare("DELETE FROM memberships WHERE tenant_id = ?")->execute([$testTenant]);
    $pdo->prepare("DELETE FROM users WHERE id IN (?, ?)")->execute([$testAdmin, $testMember]);
    $pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$testTenant]);
}

r099_cleanup($pdo, $testTenant, $testAdmin, $testMember);

// --- セットアップ: テナント・ユーザー ---
$pdo->prepare("INSERT INTO tenants (id, name, created_at) VALUES (?, ?, ?)")->execute([$testTenant, 'R-099 Tenant', time()]);
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testAdmin, 'r099admin@example.com', 'hash', 'R099管理者']);
$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testMember, 'r099member@example.com', 'hash', 'R099メンバー']);
$pdo->prepare("INSERT INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")->execute([$testTenant, $testAdmin, 'owner']);
$pdo->prepare("INSERT INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")->execute([$testTenant, $testMember, 'member']);

$now = time();

function r099_insert_item($pdo, $id, $title, $tenantId, $createdBy, $assignedTo, $now, $extra = []) {
    $projectId = $extra['project_id'] ?? null;
    $parentId = $extra['parent_id'] ?? null;
    $isProject = $extra['is_project'] ?? 0;
    $pdo->prepare("
        INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, project_id, parent_id, is_project, created_at, updated_at)
        VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?, ?, ?, ?)
    ")->execute([$id, $title, $tenantId, $createdBy, $assignedTo, $projectId, $parentId, $isProject, $now, $now]);
}

function r099_insert_dependency($pdo, $id, $tenantId, $sourceId, $targetId, $now) {
    $pdo->prepare("INSERT INTO item_dependencies (id, tenant_id, source_item_id, target_item_id, created_at) VALUES (?, ?, ?, ?, ?)")
        ->execute([$id, $tenantId, $sourceId, $targetId, $now]);
}

// --- 個人アイテム: A -> B -> C のチェーン（依存なしアイテムDも用意） ---
r099_insert_item($pdo, 'r099_p_a', '個人A', null, $testAdmin, $testAdmin, $now);
r099_insert_item($pdo, 'r099_p_b', '個人B', null, $testAdmin, $testAdmin, $now);
r099_insert_item($pdo, 'r099_p_c', '個人C', null, $testAdmin, $testAdmin, $now);
r099_insert_item($pdo, 'r099_p_d', '個人D(依存なし)', null, $testAdmin, $testAdmin, $now);
r099_insert_dependency($pdo, 'r099_dep_ab', null, 'r099_p_a', 'r099_p_b', $now);
r099_insert_dependency($pdo, 'r099_dep_bc', null, 'r099_p_b', 'r099_p_c', $now);

// --- 会社アイテム: X -> Y（scope=company/aggregated/team 用） ---
r099_insert_item($pdo, 'r099_c_x', '会社X', $testTenant, $testAdmin, $testAdmin, $now);
r099_insert_item($pdo, 'r099_c_y', '会社Y', $testTenant, $testAdmin, $testMember, $now);
r099_insert_dependency($pdo, 'r099_dep_xy', $testTenant, 'r099_c_x', 'r099_c_y', $now);

// --- プロジェクト配下: PROJ配下に X1 -> X2 ---
r099_insert_item($pdo, 'r099_proj', 'プロジェクト', null, $testAdmin, $testAdmin, $now, ['is_project' => 1]);
r099_insert_item($pdo, 'r099_proj_x1', 'プロジェクト子1', null, $testAdmin, $testAdmin, $now, ['project_id' => 'r099_proj']);
r099_insert_item($pdo, 'r099_proj_x2', 'プロジェクト子2', null, $testAdmin, $testAdmin, $now, ['project_id' => 'r099_proj']);
r099_insert_dependency($pdo, 'r099_dep_projx', null, 'r099_proj_x1', 'r099_proj_x2', $now);

// --- サブタスク: PARENTの子 S1 -> S2 ---
r099_insert_item($pdo, 'r099_parent', '親アイテム', null, $testAdmin, $testAdmin, $now);
r099_insert_item($pdo, 'r099_sub1', 'サブ1', null, $testAdmin, $testAdmin, $now, ['parent_id' => 'r099_parent']);
r099_insert_item($pdo, 'r099_sub2', 'サブ2', null, $testAdmin, $testAdmin, $now, ['parent_id' => 'r099_parent']);
r099_insert_dependency($pdo, 'r099_dep_sub', null, 'r099_sub1', 'r099_sub2', $now);

// --- テストハーネス ---
function r099_makeController($pdo, $userId, $tenantId, $joinedTenants) {
    return new class($pdo, $userId, $tenantId, $joinedTenants) extends ItemController {
        private $mockInput = [];
        private $lastResponse = null;
        private $lastError = null;

        public function __construct($pdo, $userId, $tenantId, $joinedTenants) {
            $this->pdo = $pdo;
            $this->currentUserId = $userId;
            $this->currentTenantId = $tenantId;
            $this->joinedTenants = $joinedTenants;
            $this->currentUser = ['sub' => $userId, 'role' => 'owner'];
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

        public function callPrivate($method, ...$args) {
            $ref = new ReflectionMethod('ItemController', $method);
            $ref->setAccessible(true);
            return $ref->invoke($this, ...$args);
        }
    };
}

function r099_findById($items, $id) {
    foreach ($items as $item) {
        if (($item['id'] ?? null) === $id) return $item;
    }
    return null;
}

$passed = 0;
$failed = 0;

function assert_array_set_equal($label, $actual, $expected) {
    global $passed, $failed;
    if (!is_array($actual)) {
        echo "  NG FAIL: $label\n";
        echo "    expected: " . var_export($expected, true) . "\n";
        echo "    actual  : " . var_export($actual, true) . " (not an array)\n";
        $failed++;
        return;
    }
    $a = $actual;
    $e = $expected;
    sort($a);
    sort($e);
    if ($a === $e) {
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
// テスト1: scope未指定（legacy、Single Tenant Mode）で dependsOn/blocks が正しい
// legacyブランチは items.tenant_id = ? でフィルタするため、tenant_id が NULL の
// 個人アイテムではなく会社アイテム（X->Y）で検証する
// ============================================================
echo "\n=== テスト1: legacy(scope未指定)一覧で dependsOn/blocks ===\n";
$_GET = [];
$ctrl = r099_makeController($pdo, $testAdmin, $testTenant, [$testTenant]);
$ctrl->callPrivate('getMyItems');
$resp = $ctrl->getLastResponse();
$x = r099_findById($resp, 'r099_c_x');
assert_array_set_equal('legacy: Xの dependsOn = []', $x['dependsOn'] ?? null, []);
assert_array_set_equal('legacy: Xの blocks = [Y]', $x['blocks'] ?? null, ['r099_c_y']);
$y = r099_findById($resp, 'r099_c_y');
assert_array_set_equal('legacy: Yの dependsOn = [X]', $y['dependsOn'] ?? null, ['r099_c_x']);

// ============================================================
// テスト2: scope=aggregated
// ============================================================
echo "\n=== テスト2: scope=aggregated ===\n";
$_GET = ['scope' => 'aggregated'];
$ctrl = r099_makeController($pdo, $testAdmin, $testTenant, [$testTenant]);
$ctrl->callPrivate('getMyItems');
$resp = $ctrl->getLastResponse();
$x = r099_findById($resp, 'r099_c_x');
assert_array_set_equal('会社Xの dependsOn = []', $x['dependsOn'] ?? null, []);
assert_array_set_equal('会社Xの blocks = [Y]', $x['blocks'] ?? null, ['r099_c_y']);
$y = r099_findById($resp, 'r099_c_y');
assert_array_set_equal('会社Yの dependsOn = [X]', $y['dependsOn'] ?? null, ['r099_c_x']);
$pb = r099_findById($resp, 'r099_p_b');
assert_array_set_equal('aggregated内の個人Bも dependsOn = [A]', $pb['dependsOn'] ?? null, ['r099_p_a']);

// ============================================================
// テスト3: scope=personal
// ============================================================
echo "\n=== テスト3: scope=personal ===\n";
$_GET = ['scope' => 'personal'];
$ctrl = r099_makeController($pdo, $testAdmin, '', []);
$ctrl->callPrivate('getMyItems');
$resp = $ctrl->getLastResponse();
$b = r099_findById($resp, 'r099_p_b');
assert_array_set_equal('personal: Bの dependsOn = [A]', $b['dependsOn'] ?? null, ['r099_p_a']);
assert_array_set_equal('personal: Bの blocks = [C]', $b['blocks'] ?? null, ['r099_p_c']);

// ============================================================
// テスト4: scope=company
// ============================================================
echo "\n=== テスト4: scope=company ===\n";
$_GET = ['scope' => 'company'];
$ctrl = r099_makeController($pdo, $testAdmin, $testTenant, [$testTenant]);
$ctrl->callPrivate('getMyItems');
$resp = $ctrl->getLastResponse();
$x = r099_findById($resp, 'r099_c_x');
assert_array_set_equal('company: Xの blocks = [Y]', $x['blocks'] ?? null, ['r099_c_y']);

// ============================================================
// テスト5: scope=team（管理者が他者担当分を取得）
// ============================================================
echo "\n=== テスト5: scope=team ===\n";
$_GET = ['scope' => 'team', 'assigned_to' => $testMember];
$ctrl = r099_makeController($pdo, $testAdmin, $testTenant, [$testTenant]);
$ctrl->callPrivate('getMyItems');
$resp = $ctrl->getLastResponse();
$y = r099_findById($resp, 'r099_c_y');
assert_array_set_equal('team: Yの dependsOn = [X]', $y['dependsOn'] ?? null, ['r099_c_x']);

// ============================================================
// テスト6: getProjectItems（project_id指定）
// ============================================================
echo "\n=== テスト6: getProjectItems ===\n";
$ctrl = r099_makeController($pdo, $testAdmin, '', []);
$ctrl->callPrivate('getProjectItems', 'r099_proj');
$resp = $ctrl->getLastResponse();
$x1 = r099_findById($resp, 'r099_proj_x1');
assert_array_set_equal('project: x1の blocks = [x2]', $x1['blocks'] ?? null, ['r099_proj_x2']);
$x2 = r099_findById($resp, 'r099_proj_x2');
assert_array_set_equal('project: x2の dependsOn = [x1]', $x2['dependsOn'] ?? null, ['r099_proj_x1']);

// ============================================================
// テスト7: getSubTasks（parent_id指定）
// ============================================================
echo "\n=== テスト7: getSubTasks ===\n";
$ctrl = r099_makeController($pdo, $testAdmin, '', []);
$ctrl->callPrivate('getSubTasks', 'r099_parent');
$resp = $ctrl->getLastResponse();
$s1 = r099_findById($resp, 'r099_sub1');
assert_array_set_equal('subtask: sub1の blocks = [sub2]', $s1['blocks'] ?? null, ['r099_sub2']);
$s2 = r099_findById($resp, 'r099_sub2');
assert_array_set_equal('subtask: sub2の dependsOn = [sub1]', $s2['dependsOn'] ?? null, ['r099_sub1']);

// ============================================================
// テスト8: show（単体取得）
// ============================================================
echo "\n=== テスト8: show ===\n";
$ctrl = r099_makeController($pdo, $testAdmin, '', []);
$ctrl->callPrivate('show', 'r099_p_b');
$resp = $ctrl->getLastResponse();
assert_array_set_equal('show: Bの dependsOn = [A]', $resp['dependsOn'] ?? null, ['r099_p_a']);
assert_array_set_equal('show: Bの blocks = [C]', $resp['blocks'] ?? null, ['r099_p_c']);

// ============================================================
// テスト9: N+1回避 - item_dependencies へのクエリは一覧取得1回につき1回のみ
// ============================================================
echo "\n=== テスト9: N+1回避（scope=aggregated、item_dependenciesクエリ回数） ===\n";
class R099CountingPDO extends PDO {
    public $depQueryCount = 0;
    public function prepare($query, $options = []): PDOStatement|false {
        if (stripos($query, 'item_dependencies') !== false) {
            $this->depQueryCount++;
        }
        return parent::prepare($query, $options);
    }
}
$dbPath = getenv('YOUKAN_DB_PATH') ?: (__DIR__ . '/../jbwos.sqlite');
$countingPdo = new R099CountingPDO('sqlite:' . $dbPath);
$countingPdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

$_GET = ['scope' => 'aggregated'];
$ctrl = r099_makeController($countingPdo, $testAdmin, $testTenant, [$testTenant]);
$ctrl->callPrivate('getMyItems');
assert_equal_int('item_dependenciesへのクエリは1回のみ', $countingPdo->depQueryCount, 1);

function assert_equal_int($label, $actual, $expected) {
    global $passed, $failed;
    if ($actual === $expected) {
        echo "  OK PASS: $label\n";
        $passed++;
    } else {
        echo "  NG FAIL: $label (expected $expected, actual $actual)\n";
        $failed++;
    }
}

// --- 後片付け ---
r099_cleanup($pdo, $testTenant, $testAdmin, $testMember);

echo "\n=== 結果: $passed passed, $failed failed ===\n";
if ($failed > 0) {
    echo "FAILED\n";
    exit(1);
} else {
    echo "SUCCESS\n";
    exit(0);
}
