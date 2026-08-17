<?php
/**
 * R-125 状態todo追加・pending付帯情報・decision_hold統合テスト
 *
 * テストケース:
 * 1. items テーブルに pending_condition / review_date カラムが存在する（マイグレーション）
 * 2. 既存の status='decision_hold' アイテムがマイグレーションで status='pending' に変換される
 * 3. ItemController::update() で status='todo' を受け入れる
 * 4. ItemController::update() で pending_condition / review_date を更新でき、
 *    mapItemRow() でキャメルケース（pendingCondition/reviewDate）として返る
 * 5. DecisionController::resolve() の decision='later' は status='todo' を書き込む
 * 6. DecisionController::resolve() の decision='hold' は status='pending' を書き込む
 *    （旧レガシー値 decision_hold の新規書き込みをしない）
 */

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';
require_once __DIR__ . '/../DecisionController.php';

$testUserId = 'r125_test_user';
$testTenantId = 'r125_test_tenant';

$pdo = getDB();

$pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testUserId, 'r125_test@example.com', 'hash', 'R-125 Test User']);
$pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
    ->execute([$testTenantId, 'R-125 Test Tenant']);
$pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
    ->execute([$testTenantId, $testUserId, 'owner']);

function r125_cleanup($pdo, $userId) {
    $pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$userId]);
}

function r125_insertItemDirect($pdo, $id, $title, $status, $tenantId, $userId) {
    $now = time();
    $pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, is_project, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)")
        ->execute([$id, $title, $status, $tenantId, $userId, $userId, $now, $now]);
}

function r125_fetchItem($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM items WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function r125_makeItemController($pdo, $userId, $tenantId) {
    return new class($pdo, $userId, $tenantId) extends ItemController {
        private $mockInput = [];
        private $lastResponse = null;

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
        }
        protected function sendJSON($data) { $this->lastResponse = $data; }
        protected function sendError($code, $msg) { throw new Exception("ERROR $code: $msg"); }
        protected function authenticate() {}

        public function getLastResponse() { return $this->lastResponse; }

        public function callUpdate($id) {
            $ref = new ReflectionMethod('ItemController', 'update');
            $ref->setAccessible(true);
            $ref->invoke($this, $id);
        }

        public function callShow($id) {
            $ref = new ReflectionMethod('ItemController', 'show');
            $ref->setAccessible(true);
            $ref->invoke($this, $id);
        }
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

// ============================================================
// テスト1: pending_condition / review_date カラムの存在確認
// ============================================================
echo "\n=== テスト1: items テーブルに pending_condition / review_date カラムが存在する ===\n";
$columns = [];
$stmt = $pdo->query("PRAGMA table_info(items)");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) { $columns[] = $row['name']; }
assert_true('pending_condition カラムが存在する', in_array('pending_condition', $columns));
assert_true('review_date カラムが存在する', in_array('review_date', $columns));

// ============================================================
// テスト2: decision_hold → pending への一括移行SQL（db.php のマイグレーションと同一のSQL）
// ============================================================
// 注記: db.php のマイグレーションは「pending_condition カラムが存在しない時に1回だけ」実行される
// ガード付きのため、共有dev DB（jbwos.sqlite）に対して getDB() を再呼出ししても
// 2回目以降は発火しない（意図的な一回限りの移行。R-124の decision_rejected と同じ設計）。
// ここでは db.php に実装するUPDATE文そのものが正しくdecision_holdのみを移行することを検証する。
echo "\n=== テスト2: decision_hold → pending 移行SQLの正しさ ===\n";
r125_cleanup($pdo, $testUserId);
$holdId = 'r125_legacy_hold_item';
$pendingId = 'r125_legacy_pending_item';
r125_insertItemDirect($pdo, $holdId, 'Legacy Hold Item', 'decision_hold', $testTenantId, $testUserId);
r125_insertItemDirect($pdo, $pendingId, 'Already Pending Item', 'pending', $testTenantId, $testUserId);

// db.php に実装する移行SQLと同一の文を直接実行して検証する
$pdo->exec("UPDATE items SET status = 'pending' WHERE status = 'decision_hold'");

$item = r125_fetchItem($pdo, $holdId);
assert_equal('decision_hold は pending に変換される', $item['status'] ?? null, 'pending');
$item2 = r125_fetchItem($pdo, $pendingId);
assert_equal('既にpendingのアイテムは影響を受けない', $item2['status'] ?? null, 'pending');

// ============================================================
// テスト3: ItemController::update() で status='todo' を受け入れる
// ============================================================
echo "\n=== テスト3: PUT /items/{id} で status='todo' を受入 ===\n";
r125_cleanup($pdo, $testUserId);
$t3Id = 'r125_t3_item';
r125_insertItemDirect($pdo, $t3Id, 'Inbox Task', 'inbox', $testTenantId, $testUserId);

$ctrl = r125_makeItemController($pdo, $testUserId, $testTenantId);
$ctrl->setMockInput(['status' => 'todo']);
try {
    $ctrl->callUpdate($t3Id);
    $resp = $ctrl->getLastResponse();
    assert_true('success=true', $resp['success'] ?? false);
    $item = r125_fetchItem($pdo, $t3Id);
    assert_equal('status が todo に更新された', $item['status'], 'todo');
} catch (Exception $e) {
    echo "  ✗ FAIL: 例外発生 - " . $e->getMessage() . "\n";
    $failed++;
}

// ============================================================
// テスト4: pending_condition / review_date の更新とキャメルケース応答
// ============================================================
echo "\n=== テスト4: pending_condition / review_date の更新・取得（キャメルケース） ===\n";
r125_cleanup($pdo, $testUserId);
$t4Id = 'r125_t4_item';
r125_insertItemDirect($pdo, $t4Id, 'Pending Task', 'pending', $testTenantId, $testUserId);

$ctrl = r125_makeItemController($pdo, $testUserId, $testTenantId);
$ctrl->setMockInput([
    'pendingCondition' => '展示会の募集要項が公開されたら',
    'reviewDate' => '2026-10-01',
]);
try {
    $ctrl->callUpdate($t4Id);
    $resp = $ctrl->getLastResponse();
    assert_true('success=true', $resp['success'] ?? false);

    $item = r125_fetchItem($pdo, $t4Id);
    assert_equal('pending_condition がDBに保存された', $item['pending_condition'], '展示会の募集要項が公開されたら');
    assert_equal('review_date がDBに保存された', $item['review_date'], '2026-10-01');

    // GET /items/{id} 相当でキャメルケース応答を確認
    $ctrl2 = r125_makeItemController($pdo, $testUserId, $testTenantId);
    $ctrl2->callShow($t4Id);
    $showResp = $ctrl2->getLastResponse();
    assert_equal('pendingCondition がキャメルケースで返る', $showResp['pendingCondition'] ?? null, '展示会の募集要項が公開されたら');
    assert_equal('reviewDate がキャメルケースで返る', $showResp['reviewDate'] ?? null, '2026-10-01');
} catch (Exception $e) {
    echo "  ✗ FAIL: 例外発生 - " . $e->getMessage() . "\n";
    $failed++;
}

// ============================================================
// テスト5: DecisionController::resolve() の 'later' は status='todo'
// ============================================================
echo "\n=== テスト5: DecisionController::resolve() decision='later' → status='todo' ===\n";
r125_cleanup($pdo, $testUserId);
$t5Id = 'r125_t5_item';
r125_insertItemDirect($pdo, $t5Id, 'Later Task', 'inbox', $testTenantId, $testUserId);

$decisionCtrl = new DecisionController($pdo);
$result = $decisionCtrl->resolve($t5Id, ['decision' => 'later']);
assert_equal('resolve() の new_status が todo', $result['new_status'] ?? null, 'todo');
$item = r125_fetchItem($pdo, $t5Id);
assert_equal('DBのstatusがtodoに更新された', $item['status'], 'todo');

// ============================================================
// テスト6: DecisionController::resolve() の 'hold' は status='pending'（decision_holdではない）
// ============================================================
echo "\n=== テスト6: DecisionController::resolve() decision='hold' → status='pending'（旧decision_holdの新規書込みなし） ===\n";
r125_cleanup($pdo, $testUserId);
$t6Id = 'r125_t6_item';
r125_insertItemDirect($pdo, $t6Id, 'Hold Task', 'inbox', $testTenantId, $testUserId);

$decisionCtrl = new DecisionController($pdo);
$result = $decisionCtrl->resolve($t6Id, ['decision' => 'hold']);
assert_equal('resolve() の new_status が pending（decision_holdではない）', $result['new_status'] ?? null, 'pending');
$item = r125_fetchItem($pdo, $t6Id);
assert_equal('DBのstatusがpendingに更新された', $item['status'], 'pending');

// ============================================================
// クリーンアップ
// ============================================================
r125_cleanup($pdo, $testUserId);
$pdo->prepare("DELETE FROM memberships WHERE user_id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$testTenantId]);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
