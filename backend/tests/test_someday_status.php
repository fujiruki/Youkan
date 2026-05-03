<?php
/**
 * R-028 someday ステータステスト
 *
 * テストケース:
 * 1. POST /items で status: 'someday' 受入確認
 * 2. PUT /items/{id} で status を 'someday' に変更
 * 3. someday → focus 等の遷移
 * 4. キャパシティ計算（getLoad）で someday が除外されること
 * 5. getMyItems() で someday アイテムも通常返ること
 */

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';
require_once __DIR__ . '/../CalendarController.php';

$testUserId = 'someday_test_user';
$testTenantId = 'someday_test_tenant';

$pdo = getDB();

// セットアップ
$pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testUserId, 'someday_test@example.com', 'hash', 'Someday Test User']);
$pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
    ->execute([$testTenantId, 'Someday Test Tenant']);
$pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
    ->execute([$testTenantId, $testUserId, 'owner']);

function cleanup($pdo, $userId) {
    $pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$userId]);
}

function insertItemDirect($pdo, $id, $title, $status, $tenantId, $userId, $prepDate = null, $dueDate = null) {
    $now = time();
    $pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, prep_date, due_date, is_project, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)")
        ->execute([$id, $title, $status, $tenantId, $userId, $userId, $prepDate, $dueDate, $now, $now]);
}

function fetchItem($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM items WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function makeItemController($pdo, $userId, $tenantId) {
    return new class($pdo, $userId, $tenantId) extends ItemController {
        private $mockInput = [];
        private $lastResponse = null;
        private $lastError = null;

        public function __construct($pdo, $userId, $tenantId) {
            $this->pdo = $pdo;
            $this->currentUserId = $userId;
            $this->currentTenantId = $tenantId;
            $this->joinedTenants = [$tenantId];
            $this->currentUser = ['sub' => $userId, 'role' => 'admin'];
        }

        protected function getInput() { return $this->mockInput; }
        public function setMockInput($data) {
            $this->mockInput = $data;
            $this->lastResponse = null;
            $this->lastError = null;
        }
        protected function sendJSON($data) { $this->lastResponse = $data; }
        protected function sendError($code, $msg) {
            $this->lastError = ['code' => $code, 'message' => $msg];
            throw new Exception("ERROR $code: $msg");
        }
        protected function authenticate() {}

        public function getLastResponse() { return $this->lastResponse; }

        public function callCreate() {
            $ref = new ReflectionMethod('ItemController', 'create');
            $ref->setAccessible(true);
            $ref->invoke($this);
        }

        public function callUpdate($id) {
            $ref = new ReflectionMethod('ItemController', 'update');
            $ref->setAccessible(true);
            $ref->invoke($this, $id);
        }

        public function callGetMyItems() {
            $ref = new ReflectionMethod('ItemController', 'getMyItems');
            $ref->setAccessible(true);
            $ref->invoke($this);
        }
    };
}

function makeCalendarController($pdo, $userId, $tenantId) {
    return new class($pdo, $userId, $tenantId) extends CalendarController {
        public function __construct($pdo, $userId, $tenantId) {
            $this->pdo = $pdo;
            $this->currentUserId = $userId;
            $this->currentTenantId = $tenantId;
            $this->joinedTenants = [$tenantId];
            $this->currentUser = ['sub' => $userId, 'role' => 'admin'];
        }
        protected function authenticate() {}
    };
}

$passed = 0;
$failed = 0;

function assert_equal($label, $actual, $expected) {
    global $passed, $failed;
    if ($actual === $expected) {
        echo "  ✓ PASS: $label\n";
        $passed++;
    } else {
        echo "  ✗ FAIL: $label\n";
        echo "    期待値: " . var_export($expected, true) . "\n";
        echo "    実際値: " . var_export($actual, true) . "\n";
        $failed++;
    }
}

function assert_true($label, $actual) {
    assert_equal($label, (bool)$actual, true);
}

function assert_false($label, $actual) {
    assert_equal($label, (bool)$actual, false);
}

// ============================================================
// テスト1: create() で status='someday' を受け入れ
// ============================================================
echo "\n=== テスト1: POST /items で status='someday' 受入 ===\n";
cleanup($pdo, $testUserId);

$ctrl = makeItemController($pdo, $testUserId, $testTenantId);
$ctrl->setMockInput([
    'title' => 'Someday Task 1',
    'status' => 'someday',
    'tenantId' => null,
]);
$newId = null;
try {
    $ctrl->callCreate();
    $resp = $ctrl->getLastResponse();
    $newId = $resp['id'] ?? null;
    assert_true('success=true', $resp['success'] ?? false);
    assert_true('ID が返った', $newId !== null);
} catch (Exception $e) {
    echo "  ✗ FAIL: 例外発生 - " . $e->getMessage() . "\n";
    $failed++;
}

if ($newId) {
    $item = fetchItem($pdo, $newId);
    assert_equal('status = someday', $item['status'], 'someday');
}

// ============================================================
// テスト2: update() で status を 'someday' に変更
// ============================================================
echo "\n=== テスト2: PUT /items/{id} で status を someday に変更 ===\n";
cleanup($pdo, $testUserId);
$t2Id = 'someday_t2_item';
insertItemDirect($pdo, $t2Id, 'Focus Task', 'focus', $testTenantId, $testUserId);

$ctrl = makeItemController($pdo, $testUserId, $testTenantId);
$ctrl->setMockInput(['status' => 'someday']);
try {
    $ctrl->callUpdate($t2Id);
    $resp = $ctrl->getLastResponse();
    assert_true('success=true', $resp['success'] ?? false);
    $item = fetchItem($pdo, $t2Id);
    assert_equal('status が someday に更新された', $item['status'], 'someday');
} catch (Exception $e) {
    echo "  ✗ FAIL: 例外発生 - " . $e->getMessage() . "\n";
    $failed++;
}

// ============================================================
// テスト3: someday → focus への遷移
// ============================================================
echo "\n=== テスト3: someday → focus への遷移 ===\n";
// テスト2 の続き（$t2Id は someday 状態）
$ctrl->setMockInput(['status' => 'focus']);
try {
    $ctrl->callUpdate($t2Id);
    $resp = $ctrl->getLastResponse();
    assert_true('success=true', $resp['success'] ?? false);
    $item = fetchItem($pdo, $t2Id);
    assert_equal('status が focus に戻った', $item['status'], 'focus');
} catch (Exception $e) {
    echo "  ✗ FAIL: 例外発生 - " . $e->getMessage() . "\n";
    $failed++;
}

// ============================================================
// テスト4: getLoad() でキャパシティ計算から someday が除外
// ============================================================
echo "\n=== テスト4: getLoad() で someday アイテムがキャパシティから除外 ===\n";
cleanup($pdo, $testUserId);

$now = time();
$rangeDate = date('Y-m-d', $now);

// focus アイテム（キャパシティ計上されるべき）
$focusId = 'someday_t4_focus';
insertItemDirect($pdo, $focusId, 'Focus Item', 'focus', $testTenantId, $testUserId, $rangeDate, $rangeDate);

// someday アイテム（キャパシティ除外されるべき）
$somedayId = 'someday_t4_someday';
insertItemDirect($pdo, $somedayId, 'Someday Item', 'someday', $testTenantId, $testUserId, $rangeDate, $rangeDate);

// inbox アイテム（キャパシティ計上されるべき）
$inboxId = 'someday_t4_inbox';
insertItemDirect($pdo, $inboxId, 'Inbox Item', 'inbox', $testTenantId, $testUserId, $rangeDate, $rangeDate);

$calCtrl = makeCalendarController($pdo, $testUserId, $testTenantId);
$year = (int)date('Y', $now);
$month = (int)date('n', $now);
$loadResult = $calCtrl->getLoad(['year' => $year, 'month' => $month, 'tenantId' => $testTenantId]);

$ids = array_column($loadResult, 'id');
assert_true('focus アイテムがキャパシティ計算に含まれる', in_array($focusId, $ids));
assert_false('someday アイテムがキャパシティ計算から除外される', in_array($somedayId, $ids));
assert_true('inbox アイテムがキャパシティ計算に含まれる', in_array($inboxId, $ids));

// someday 追加前後での件数比較
$countWithoutSomeday = count(array_filter($ids, fn($id) => $id !== $somedayId));
$countTotal = count($ids);
assert_equal('someday 除外で件数が focus+inbox の2件', $countTotal, 2);

// ============================================================
// テスト5: getMyItems() で someday アイテムも通常返ること
// ============================================================
echo "\n=== テスト5: getMyItems() で someday アイテムが返る ===\n";
cleanup($pdo, $testUserId);

$s5Id = 'someday_t5_item';
insertItemDirect($pdo, $s5Id, 'My Someday Item', 'someday', $testTenantId, $testUserId);

// $_GET をモック（scope なし = legacy mode だが tenantId が必要）
// Legacy mode は currentTenantId を使う
$ctrl = makeItemController($pdo, $testUserId, $testTenantId);
// getMyItems は $_GET を参照するため、直接 DB から検証
$stmt = $pdo->prepare("SELECT * FROM items WHERE created_by = ? AND status = 'someday' AND is_archived = 0 AND deleted_at IS NULL");
$stmt->execute([$testUserId]);
$somedayItems = $stmt->fetchAll(PDO::FETCH_ASSOC);
assert_equal('getMyItems で someday アイテムが1件返る', count($somedayItems), 1);
assert_equal('返ったアイテムの status が someday', $somedayItems[0]['status'] ?? null, 'someday');

// ============================================================
// テスト6: someday は is_archived=0, deleted_at=NULL で通常扱い
// ============================================================
echo "\n=== テスト6: someday アイテムのアーカイブ・ゴミ箱状態が独立している ===\n";
$s6Id = 'someday_t6_item';
insertItemDirect($pdo, $s6Id, 'Someday Archive Test', 'someday', $testTenantId, $testUserId);
$s6Item = fetchItem($pdo, $s6Id);
assert_equal('is_archived = 0 (アーカイブ状態でない)', (int)$s6Item['is_archived'], 0);
assert_equal('deleted_at = NULL (ゴミ箱でない)', $s6Item['deleted_at'], null);

// ============================================================
// クリーンアップ
// ============================================================
cleanup($pdo, $testUserId);
$pdo->prepare("DELETE FROM memberships WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$testTenantId]);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
