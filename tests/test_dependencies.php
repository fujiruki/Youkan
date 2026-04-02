<?php
// tests/test_dependencies.php
// DependencyController のユニットテスト（TDD: RED → GREEN）
require_once __DIR__ . '/../backend/db.php';
require_once __DIR__ . '/../backend/DependencyController.php';

echo "=== TDD: DependencyController ===\n\n";

$pdo = getDB();
$passed = 0;
$failed = 0;

function assert_eq($label, $expected, $actual) {
    global $passed, $failed;
    if ($expected === $actual) {
        echo "  PASS: $label\n";
        $passed++;
    } else {
        echo "  FAIL: $label (expected: " . var_export($expected, true) . ", got: " . var_export($actual, true) . ")\n";
        $failed++;
    }
}

function assert_true($label, $value) {
    assert_eq($label, true, (bool)$value);
}

// テスト用テナント・アイテム準備
$tenantId = 't_dep_test_' . uniqid();
$itemA = 'item_a_' . uniqid();
$itemB = 'item_b_' . uniqid();
$itemC = 'item_c_' . uniqid();
$itemD = 'item_d_' . uniqid();
$now = time();

foreach ([$itemA, $itemB, $itemC, $itemD] as $id) {
    $pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_at, updated_at) VALUES (?, ?, 'inbox', ?, ?, ?)")
        ->execute([$id, "Test $id", $tenantId, $now, $now]);
}

// DependencyController のメソッドを直接テストするためのテスト用サブクラス
class TestDependencyController extends DependencyController {
    private $testTenantId;
    private $testJoinedTenants;

    public function __construct($tenantId) {
        parent::__construct();
        $this->testTenantId = $tenantId;
        $this->testJoinedTenants = [$tenantId];
    }

    protected function authenticate() {
        $this->currentTenantId = $this->testTenantId;
        $this->joinedTenants = $this->testJoinedTenants;
        $this->currentUserId = 'u_test';
    }

    // 公開ラッパー: 循環チェック
    public function testHasCycle($sourceId, $targetId) {
        return $this->hasCycle($sourceId, $targetId);
    }

    // 公開ラッパー: 依存関係作成（DB直接）
    public function testCreateDependency($sourceId, $targetId) {
        return $this->createDependencyDirect($sourceId, $targetId);
    }

    // 公開ラッパー: 依存関係取得
    public function testGetDependencies($itemId = null) {
        return $this->getDependenciesDirect($itemId);
    }

    // 公開ラッパー: 依存関係削除
    public function testDeleteDependency($id) {
        return $this->deleteDependencyDirect($id);
    }
}

$ctrl = new TestDependencyController($tenantId);

// ==============================
echo "[Test 1] 依存関係の作成\n";
$dep1 = $ctrl->testCreateDependency($itemA, $itemB);
assert_true('依存関係が作成される', $dep1);
assert_eq('sourceItemIdが正しい', $itemA, $dep1['sourceItemId']);
assert_eq('targetItemIdが正しい', $itemB, $dep1['targetItemId']);
assert_true('IDが存在する', !empty($dep1['id']));
assert_true('createdAtが存在する', !empty($dep1['createdAt']));

// ==============================
echo "\n[Test 2] 依存関係の取得（item_id指定）\n";
$deps = $ctrl->testGetDependencies($itemA);
assert_eq('A関連の依存が1件', 1, count($deps));
assert_eq('sourceがA', $itemA, $deps[0]['sourceItemId']);

$depsB = $ctrl->testGetDependencies($itemB);
assert_eq('B関連の依存も1件（targetとして）', 1, count($depsB));

// ==============================
echo "\n[Test 3] 重複チェック（同じペア）\n";
$dup = $ctrl->testCreateDependency($itemA, $itemB);
assert_eq('重複は null を返す', null, $dup);

// ==============================
echo "\n[Test 4] 循環参照チェック（直接: A→B, B→A）\n";
$hasCycle = $ctrl->testHasCycle($itemB, $itemA);
assert_true('B→Aは循環する', $hasCycle);

// ==============================
echo "\n[Test 5] 循環参照チェック（間接: A→B→C→A）\n";
$dep2 = $ctrl->testCreateDependency($itemB, $itemC);
assert_true('B→Cが作成される', $dep2);

$hasCycle2 = $ctrl->testHasCycle($itemC, $itemA);
assert_true('C→Aは循環する（A→B→C→A）', $hasCycle2);

// ==============================
echo "\n[Test 6] 循環しない依存は許可\n";
$hasCycle3 = $ctrl->testHasCycle($itemC, $itemD);
assert_true('C→Dは循環しない', !$hasCycle3);

$dep3 = $ctrl->testCreateDependency($itemC, $itemD);
assert_true('C→Dが作成される', $dep3);

// ==============================
echo "\n[Test 7] 依存関係の削除\n";
$delResult = $ctrl->testDeleteDependency($dep1['id']);
assert_true('削除が成功', $delResult);

$depsAfter = $ctrl->testGetDependencies($itemA);
// A→B は削除されたが、A はまだ B→C チェーン上にはない（B→Cだけ残る）
// A に関連する依存は 0 件になる
assert_eq('A関連の依存が0件', 0, count($depsAfter));

// ==============================
echo "\n[Test 8] 自己参照は循環\n";
$selfCycle = $ctrl->testHasCycle($itemA, $itemA);
assert_true('A→Aは循環する', $selfCycle);

// クリーンアップ
foreach ([$itemA, $itemB, $itemC, $itemD] as $id) {
    $pdo->prepare("DELETE FROM items WHERE id = ?")->execute([$id]);
}
$pdo->prepare("DELETE FROM item_dependencies WHERE tenant_id = ?")->execute([$tenantId]);

echo "\n=== 結果: $passed passed, $failed failed ===\n";
exit($failed > 0 ? 1 : 0);
