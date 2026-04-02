<?php
// tests/test_auto_chain.php
// 新規アイテム作成時の自動チェーン追加テスト（TDD: RED → GREEN）
require_once __DIR__ . '/../backend/db.php';
require_once __DIR__ . '/../backend/ItemController.php';

echo "=== TDD: 自動チェーン追加 ===\n\n";

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

function assert_null($label, $value) {
    global $passed, $failed;
    if ($value === null) {
        echo "  PASS: $label\n";
        $passed++;
    } else {
        echo "  FAIL: $label (expected: null, got: " . var_export($value, true) . ")\n";
        $failed++;
    }
}

// テスト用サブクラス
class TestItemControllerAutoChain extends ItemController {
    private $testTenantId;

    public function __construct($tenantId) {
        parent::__construct();
        $this->testTenantId = $tenantId;
    }

    protected function authenticate() {
        $this->currentTenantId = $this->testTenantId;
        $this->joinedTenants = [$this->testTenantId];
        $this->currentUserId = 'u_test_autochain';
    }

    // テスト用: チェーン末尾ノード検出
    public function testFindChainTail($projectId) {
        $this->authenticate();
        return $this->findChainTail($projectId);
    }

    // テスト用: 自動チェーン追加+flow配置
    public function testAutoChainAndPlace($newItemId, $projectId) {
        $this->authenticate();
        return $this->autoChainAndPlace($newItemId, $projectId);
    }
}

$tenantId = 't_autochain_' . uniqid();
$projectId = 'proj_' . uniqid();
$now = time();

// プロジェクト作成
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, is_project, project_type, created_by, created_at, updated_at) VALUES (?, 'テストプロジェクト', 'focus', ?, 1, 'general', 'u_test_autochain', ?, ?)")
    ->execute([$projectId, $tenantId, $now, $now]);

$ctrl = new TestItemControllerAutoChain($tenantId);

// --- テスト1: 依存関係なしの場合、末尾ノードはnull ---
echo "[テスト1] 依存関係なしの場合、末尾ノードはnull\n";
$tail = $ctrl->testFindChainTail($projectId);
assert_null('チェーンなしで末尾はnull', $tail);

// アイテムA, B, Cを作成（project_id付き）
$itemA = 'item_chain_a_' . uniqid();
$itemB = 'item_chain_b_' . uniqid();
$itemC = 'item_chain_c_' . uniqid();

foreach ([[$itemA, 'A'], [$itemB, 'B'], [$itemC, 'C']] as [$id, $label]) {
    $pdo->prepare("INSERT INTO items (id, title, status, tenant_id, project_id, created_by, created_at, updated_at) VALUES (?, ?, 'inbox', ?, ?, 'u_test_autochain', ?, ?)")
        ->execute([$id, "タスク$label", $tenantId, $projectId, $now, $now]);
}

// A→B, B→C のチェーンを作成
$pdo->prepare("INSERT INTO item_dependencies (id, tenant_id, source_item_id, target_item_id, created_at) VALUES (?, ?, ?, ?, ?)")
    ->execute(['dep_test_1_' . uniqid(), $tenantId, $itemA, $itemB, $now]);
$pdo->prepare("INSERT INTO item_dependencies (id, tenant_id, source_item_id, target_item_id, created_at) VALUES (?, ?, ?, ?, ?)")
    ->execute(['dep_test_2_' . uniqid(), $tenantId, $itemB, $itemC, $now]);

// --- テスト2: チェーンA→B→Cの末尾はC ---
echo "\n[テスト2] チェーンA→B→Cの末尾はC\n";
$tail = $ctrl->testFindChainTail($projectId);
assert_eq('末尾ノードはC', $itemC, $tail);

// Cにflow座標を設定
$pdo->prepare("UPDATE items SET meta = ? WHERE id = ?")
    ->execute([json_encode(['flow_x' => 0, 'flow_y' => 300]), $itemC]);

// --- テスト3: 新アイテムDを追加 → C→Dの依存が自動作成 ---
echo "\n[テスト3] 新アイテム追加時にチェーン末尾と接続\n";
$itemD = 'item_chain_d_' . uniqid();
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, project_id, created_by, created_at, updated_at) VALUES (?, 'タスクD', 'inbox', ?, ?, 'u_test_autochain', ?, ?)")
    ->execute([$itemD, $tenantId, $projectId, $now, $now]);

$result = $ctrl->testAutoChainAndPlace($itemD, $projectId);
assert_true('自動チェーン作成成功', $result);

// C→Dの依存関係が存在するか確認
$stmt = $pdo->prepare("SELECT * FROM item_dependencies WHERE source_item_id = ? AND target_item_id = ? AND tenant_id = ?");
$stmt->execute([$itemC, $itemD, $tenantId]);
$dep = $stmt->fetch(PDO::FETCH_ASSOC);
assert_true('C→Dの依存関係が存在する', !empty($dep));

// Dのflow座標がCの下に配置されているか確認
$stmt = $pdo->prepare("SELECT meta FROM items WHERE id = ?");
$stmt->execute([$itemD]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);
$meta = json_decode($row['meta'], true);
assert_eq('Dのflow_x = Cのflow_x(0)', 0, $meta['flow_x'] ?? null);
assert_eq('Dのflow_y = Cのflow_y + 150', 450, $meta['flow_y'] ?? null);

// --- テスト4: 末尾ノードがDに更新されている ---
echo "\n[テスト4] 新しい末尾ノードはD\n";
$tail = $ctrl->testFindChainTail($projectId);
assert_eq('末尾ノードはD', $itemD, $tail);

// クリーンアップ
$pdo->exec("DELETE FROM item_dependencies WHERE tenant_id = '$tenantId'");
$pdo->exec("DELETE FROM items WHERE tenant_id = '$tenantId'");

echo "\n=== 結果: $passed passed, $failed failed ===\n";
exit($failed > 0 ? 1 : 0);
