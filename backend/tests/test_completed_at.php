<?php
/**
 * completed_at テスト: ステータス変更時の自動記録を確認
 *
 * テストケース:
 * 1. status=doneに変更したとき、completed_atにUnixタイムスタンプが記録される
 * 2. done以外のステータスに戻したとき、completed_atがNULLにリセットされる
 * 3. done以外→done以外の変更では、completed_atは変化しない
 */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';

$pdo = getDB();

$testUserId = 'test_user_completed_at';
$testTenantId = 'test_tenant_completed_at';

// セットアップ
$pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testUserId, 'completed_at_test@example.com', 'hash', 'CompletedAt Tester']);
$pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
    ->execute([$testTenantId, 'CompletedAt Test Tenant']);
$pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
    ->execute([$testTenantId, $testUserId, 'owner']);

// テストデータクリア
$pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserId]);

// テストアイテム作成
$now = time();
$itemId = 'completed_at_test_item';
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, created_at, updated_at)
               VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?)")
    ->execute([$itemId, 'CompletedAt Test Task', $testTenantId, $testUserId, $testUserId, $now, $now]);

// テスト用サブクラス
class TestCompletedAtController extends ItemController {
    private $mockInput = [];

    protected function getInput() { return $this->mockInput; }
    public function setMockInput($data) { $this->mockInput = $data; }
    protected function sendJSON($data) { /* テスト用: 出力しない */ }
    protected function sendError($code, $msg) { throw new Exception("ERROR $code: $msg"); }
    protected function authenticate() { /* テスト用バイパス */ }

    public function publicUpdate($id) {
        $reflection = new ReflectionMethod('ItemController', 'update');
        $reflection->setAccessible(true);
        return $reflection->invoke($this, $id);
    }
}

$controller = new TestCompletedAtController();
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

$propCurrentUser = $refClass->getProperty('currentUser');
$propCurrentUser->setAccessible(true);
$propCurrentUser->setValue($controller, ['sub' => $testUserId, 'role' => 'admin']);

echo "=== completed_at 自動記録テスト ===\n\n";

$passed = 0;
$failed = 0;

// テスト1: status=doneに変更→completed_atが記録される
echo "テスト1: status=doneに変更したとき、completed_atが記録される\n";
$beforeTime = time();
$controller->setMockInput(['status' => 'done']);
$controller->publicUpdate($itemId);
$afterTime = time();

$row = $pdo->prepare("SELECT completed_at, status FROM items WHERE id = ?")->execute([$itemId]);
$item = $pdo->prepare("SELECT completed_at, status FROM items WHERE id = ?")->fetch(PDO::FETCH_ASSOC);
// 再取得
$stmt = $pdo->prepare("SELECT completed_at, status FROM items WHERE id = ?");
$stmt->execute([$itemId]);
$item = $stmt->fetch(PDO::FETCH_ASSOC);

if ($item['status'] === 'done' && $item['completed_at'] !== null && $item['completed_at'] >= $beforeTime && $item['completed_at'] <= $afterTime) {
    echo "  ✓ PASS: completed_at = {$item['completed_at']} (範囲: {$beforeTime}〜{$afterTime})\n";
    $passed++;
} else {
    echo "  ✗ FAIL: status={$item['status']}, completed_at={$item['completed_at']}\n";
    $failed++;
}

// テスト2: done→focusに戻したとき、completed_atがNULLになる
echo "\nテスト2: done→focusに戻したとき、completed_atがNULLにリセットされる\n";
$controller->setMockInput(['status' => 'focus']);
$controller->publicUpdate($itemId);

$stmt = $pdo->prepare("SELECT completed_at, status FROM items WHERE id = ?");
$stmt->execute([$itemId]);
$item = $stmt->fetch(PDO::FETCH_ASSOC);

if ($item['status'] === 'focus' && $item['completed_at'] === null) {
    echo "  ✓ PASS: completed_at = NULL\n";
    $passed++;
} else {
    echo "  ✗ FAIL: status={$item['status']}, completed_at={$item['completed_at']}\n";
    $failed++;
}

// テスト3: inbox→focusの変更では、completed_atは変化しない（NULLのまま）
echo "\nテスト3: done以外→done以外ではcompleted_atは変化しない\n";
$controller->setMockInput(['status' => 'inbox']);
$controller->publicUpdate($itemId);

$stmt = $pdo->prepare("SELECT completed_at, status FROM items WHERE id = ?");
$stmt->execute([$itemId]);
$item = $stmt->fetch(PDO::FETCH_ASSOC);

if ($item['completed_at'] === null) {
    echo "  ✓ PASS: completed_at = NULL（変化なし）\n";
    $passed++;
} else {
    echo "  ✗ FAIL: completed_at={$item['completed_at']}（NULLであるべき）\n";
    $failed++;
}

// テスト4: 再度doneに変更→completed_atが更新される
echo "\nテスト4: 再度doneに変更→completed_atが新しいタイムスタンプで記録される\n";
sleep(1);
$beforeTime2 = time();
$controller->setMockInput(['status' => 'done']);
$controller->publicUpdate($itemId);

$stmt = $pdo->prepare("SELECT completed_at, status FROM items WHERE id = ?");
$stmt->execute([$itemId]);
$item = $stmt->fetch(PDO::FETCH_ASSOC);

if ($item['completed_at'] !== null && $item['completed_at'] >= $beforeTime2) {
    echo "  ✓ PASS: completed_at = {$item['completed_at']} (>= {$beforeTime2})\n";
    $passed++;
} else {
    echo "  ✗ FAIL: completed_at={$item['completed_at']}\n";
    $failed++;
}

// クリーンアップ
$pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$testTenantId]);
$pdo->prepare("DELETE FROM memberships WHERE user_id = ?")->execute([$testUserId]);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
