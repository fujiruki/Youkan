<?php
/**
 * reorderFocus() テスト: sort_orderカラムを更新することを確認
 *
 * 現状の問題: focus_orderを更新しているが、TodayControllerはsort_orderでソート
 * 期待: sort_orderが更新されること
 */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';

$pdo = getDB();

$testUserId = 'test_user_reorder';
$testTenantId = 'test_tenant_reorder';

// セットアップ
$pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testUserId, 'reorder_test@example.com', 'hash', 'Reorder Tester']);
$pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
    ->execute([$testTenantId, 'Reorder Test Tenant']);
$pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
    ->execute([$testTenantId, $testUserId, 'owner']);

// テストデータクリア
$pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserId]);

// テストアイテム作成
$now = time();
$itemIds = ['reorder_a', 'reorder_b', 'reorder_c'];
foreach ($itemIds as $i => $id) {
    $pdo->prepare("INSERT INTO items (id, title, status, sort_order, tenant_id, created_by, assigned_to, created_at, updated_at)
                   VALUES (?, ?, 'focus', 0, ?, ?, ?, ?, ?)")
        ->execute([$id, "Task $id", $testTenantId, $testUserId, $testUserId, $now, $now]);
}

// テスト用サブクラス
class TestReorderController extends ItemController {
    private $mockInput = [];

    protected function getInput() { return $this->mockInput; }
    public function setMockInput($data) { $this->mockInput = $data; }
    protected function sendJSON($data) { echo json_encode($data); }
    protected function sendError($code, $msg) { echo "ERROR $code: $msg"; }
    protected function authenticate() { /* テスト用バイパス */ }

    public function publicReorder() {
        $reflection = new ReflectionMethod('ItemController', 'reorderFocus');
        $reflection->setAccessible(true);
        return $reflection->invoke($this);
    }
}

$controller = new TestReorderController();
$refClass = new ReflectionClass('BaseController');

$propTenant = $refClass->getProperty('currentTenantId');
$propTenant->setAccessible(true);
$propTenant->setValue($controller, $testTenantId);

$propUser = $refClass->getProperty('currentUserId');
$propUser->setAccessible(true);
$propUser->setValue($controller, $testUserId);

$propJoined = $refClass->getProperty('joinedTenants');
$propJoined->setAccessible(true);
$propJoined->setValue($controller, [$testTenantId]);

echo "=== reorderFocus() sort_order更新テスト ===\n\n";

$passed = 0;
$failed = 0;

// テスト1: reorderFocusでsort_orderが更新されること
echo "テスト1: sort_orderカラムが更新される\n";
$controller->setMockInput([
    'items' => [
        ['id' => 'reorder_c', 'order' => 1],
        ['id' => 'reorder_a', 'order' => 2],
        ['id' => 'reorder_b', 'order' => 3],
    ]
]);

ob_start();
$controller->publicReorder();
$output = ob_get_clean();

// DB確認: sort_orderが更新されているか
$stmt = $pdo->prepare("SELECT id, sort_order FROM items WHERE id IN ('reorder_a', 'reorder_b', 'reorder_c') ORDER BY sort_order ASC");
$stmt->execute();
$results = $stmt->fetchAll(PDO::FETCH_ASSOC);

$expectedSortOrders = ['reorder_c' => 1, 'reorder_a' => 2, 'reorder_b' => 3];
$allCorrect = true;
foreach ($results as $row) {
    $expected = $expectedSortOrders[$row['id']];
    if ((int)$row['sort_order'] !== $expected) {
        echo "  FAIL: {$row['id']} の sort_order: 期待=$expected, 実際={$row['sort_order']}\n";
        $allCorrect = false;
    }
}

if ($allCorrect) {
    echo "  PASS\n";
    $passed++;
} else {
    $failed++;
}

// テスト2: 個人タスク（tenant_id=NULL）の並べ替えが動作すること
echo "テスト2: 個人タスク（tenant_id=NULL）の並べ替え\n";

// 個人タスクを作成
$pdo->prepare("INSERT INTO items (id, title, status, sort_order, tenant_id, created_by, assigned_to, created_at, updated_at)
               VALUES ('personal_reorder_1', 'Personal 1', 'focus', 0, NULL, ?, ?, ?, ?)")
    ->execute([$testUserId, $testUserId, $now, $now]);
$pdo->prepare("INSERT INTO items (id, title, status, sort_order, tenant_id, created_by, assigned_to, created_at, updated_at)
               VALUES ('personal_reorder_2', 'Personal 2', 'focus', 0, NULL, ?, ?, ?, ?)")
    ->execute([$testUserId, $testUserId, $now, $now]);

// tenant_idをNULLに設定してリオーダー
$propTenant->setValue($controller, null);

$controller->setMockInput([
    'items' => [
        ['id' => 'personal_reorder_2', 'order' => 1],
        ['id' => 'personal_reorder_1', 'order' => 2],
    ]
]);

ob_start();
$controller->publicReorder();
$output2 = ob_get_clean();

$stmt2 = $pdo->prepare("SELECT id, sort_order FROM items WHERE id IN ('personal_reorder_1', 'personal_reorder_2') ORDER BY sort_order ASC");
$stmt2->execute();
$results2 = $stmt2->fetchAll(PDO::FETCH_ASSOC);

if (count($results2) === 2 && (int)$results2[0]['sort_order'] === 1 && $results2[0]['id'] === 'personal_reorder_2') {
    echo "  PASS\n";
    $passed++;
} else {
    echo "  FAIL: 個人タスクのsort_order更新が失敗\n";
    foreach ($results2 as $r) {
        echo "    {$r['id']}: sort_order={$r['sort_order']}\n";
    }
    $failed++;
}

// クリーンアップ
$pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$testTenantId]);
$pdo->prepare("DELETE FROM memberships WHERE user_id = ?")->execute([$testUserId]);

echo "\n=== 結果: $passed passed, $failed failed ===\n";
exit($failed > 0 ? 1 : 0);
