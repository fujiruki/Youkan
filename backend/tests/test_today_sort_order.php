<?php
/**
 * TodayController commits ソート順テスト
 *
 * 期待: focusステータスのタスクが「着手開始日が近い順」で返される
 * - due_dateが近いものが先頭
 * - due_date未設定のタスクは後ろに回す
 * - sort_orderが手動設定されている場合はそちらを優先
 */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../TodayController.php';

$pdo = getDB();

// テスト用データのセットアップ
$testUserId = 'test_user_sort';
$testTenantId = 'test_tenant_sort';

$pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testUserId, 'sort_test@example.com', 'hash', 'Sort Tester']);
$pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
    ->execute([$testTenantId, 'Sort Test Tenant']);
$pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
    ->execute([$testTenantId, $testUserId, 'owner']);

// 既存テストデータをクリア
$pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserId]);

// テストデータ: 3つのfocusタスク（due_dateが異なる）
$now = time();
$items = [
    [
        'id' => 'sort_item_no_due',
        'title' => '期限なしタスク',
        'status' => 'focus',
        'due_date' => null,
        'sort_order' => 0,
        'estimated_minutes' => 60,
    ],
    [
        'id' => 'sort_item_far_due',
        'title' => '遠い期限タスク',
        'status' => 'focus',
        'due_date' => strtotime('+30 days') * 1000, // 30日後（ミリ秒）
        'sort_order' => 0,
        'estimated_minutes' => 120,
    ],
    [
        'id' => 'sort_item_near_due',
        'title' => '近い期限タスク',
        'status' => 'focus',
        'due_date' => strtotime('+3 days') * 1000, // 3日後（ミリ秒）
        'sort_order' => 0,
        'estimated_minutes' => 30,
    ],
];

$insertSql = "INSERT INTO items (id, title, status, due_date, sort_order, estimated_minutes, tenant_id, created_by, assigned_to, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
$stmt = $pdo->prepare($insertSql);

foreach ($items as $item) {
    $stmt->execute([
        $item['id'],
        $item['title'],
        $item['status'],
        $item['due_date'],
        $item['sort_order'],
        $item['estimated_minutes'],
        $testTenantId,
        $testUserId,
        $testUserId,
        $now,
        $now,
    ]);
}

echo "=== TodayController commits ソート順テスト ===\n\n";

// TodayControllerのgetTodayを呼び出す（テスト用サブクラス）
class TestTodayController extends TodayController {
    private $mockUserId;
    private $mockTenantId;

    public function setTestContext($userId, $tenantId) {
        $this->mockUserId = $userId;
        $this->mockTenantId = $tenantId;
    }

    public function testGetToday() {
        // Reflectionでprotectedプロパティを設定
        $refClass = new ReflectionClass('BaseController');
        $propTenant = $refClass->getProperty('currentTenantId');
        $propTenant->setAccessible(true);
        $propTenant->setValue($this, $this->mockTenantId);

        $propUser = $refClass->getProperty('currentUserId');
        $propUser->setAccessible(true);
        $propUser->setValue($this, $this->mockUserId);

        $propJoined = $refClass->getProperty('joinedTenants');
        $propJoined->setAccessible(true);
        $propJoined->setValue($this, [$this->mockTenantId]);

        // authenticateをバイパスしてgetTodayのロジックを直接実行
        // getTodayはauthenticateを呼ぶのでオーバーライドが必要
        return $this->getToday();
    }

    // authenticateをバイパス
    protected function authenticate() {
        // テスト用: 何もしない
    }

    // sendJSON/sendErrorでexitしないようにオーバーライド
    protected function sendJSON($data) {
        echo json_encode($data);
    }

    protected function sendError($code, $msg) {
        echo "ERROR $code: $msg";
    }
}

$controller = new TestTodayController();
$controller->setTestContext($testUserId, $testTenantId);
$result = $controller->testGetToday();

$passed = 0;
$failed = 0;

// テスト1: commitsが3件返されること
echo "テスト1: commitsが3件返される\n";
if (count($result['commits']) === 3) {
    echo "  PASS\n";
    $passed++;
} else {
    echo "  FAIL: 期待=3, 実際=" . count($result['commits']) . "\n";
    $failed++;
}

// テスト2: sort_orderが全て0の場合、due_dateが近い順にソートされること
// 期待順: near_due(3日後) → far_due(30日後) → no_due(期限なし)
echo "テスト2: due_dateが近い順にソート（sort_orderが0の場合）\n";
$ids = array_map(fn($c) => $c['id'], $result['commits']);
$expectedOrder = ['sort_item_near_due', 'sort_item_far_due', 'sort_item_no_due'];
if ($ids === $expectedOrder) {
    echo "  PASS\n";
    $passed++;
} else {
    echo "  FAIL: 期待=" . implode(', ', $expectedOrder) . " 実際=" . implode(', ', $ids) . "\n";
    $failed++;
}

// テスト3: sort_orderが手動設定されている場合はそちらを優先
echo "テスト3: sort_orderが手動設定されている場合の優先\n";
$pdo->prepare("UPDATE items SET sort_order = 1 WHERE id = 'sort_item_no_due'")->execute();
$pdo->prepare("UPDATE items SET sort_order = 2 WHERE id = 'sort_item_far_due'")->execute();
$pdo->prepare("UPDATE items SET sort_order = 3 WHERE id = 'sort_item_near_due'")->execute();

$result2 = $controller->testGetToday();
$ids2 = array_map(fn($c) => $c['id'], $result2['commits']);
$expectedOrder2 = ['sort_item_no_due', 'sort_item_far_due', 'sort_item_near_due'];
if ($ids2 === $expectedOrder2) {
    echo "  PASS\n";
    $passed++;
} else {
    echo "  FAIL: 期待=" . implode(', ', $expectedOrder2) . " 実際=" . implode(', ', $ids2) . "\n";
    $failed++;
}

// クリーンアップ
$pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$testTenantId]);
$pdo->prepare("DELETE FROM memberships WHERE user_id = ?")->execute([$testUserId]);

echo "\n=== 結果: $passed passed, $failed failed ===\n";
exit($failed > 0 ? 1 : 0);
