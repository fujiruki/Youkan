<?php
/**
 * R-155 全体一覧ドラッグでプロジェクト移動 - バックエンド循環参照防止テスト
 *
 * 対象: ItemController::update() の parentId 変更時バリデーション
 * 仕様: docs/SPEC/09_全体一覧ドラッグでプロジェクト移動.md §7
 *
 * テストケース:
 * 1. 自分自身への move → 400
 * 2. 子タスクへの move（循環） → 400
 * 3. 孫タスクへの move（多階層循環） → 400
 * 4. project_id フォールバックで解決される子孫への move（循環） → 400
 * 5. 無関係な別プロジェクトへの正常な move → 200
 * 6. ルート直下への move（projectId連動） → 200
 * 7. サブプロジェクト配下への move（projectId連動） → 200
 * 8. Beaver work_package配下への move（projectId連動） → 200
 * 9. 所属と無関係なフィールド（工数・日付・担当・status）が move で保持される
 * 10. テナントを跨ぐ move は既存チェックにより 403（回帰確認）
 */

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';

$testUserA = 'r155_test_user_a';
$testTenantA = 'r155_test_tenant_a';
$testTenantB = 'r155_test_tenant_b'; // 未参加テナント

$pdo = getDB();

function r155_setupUsers($pdo, $testUserA, $testTenantA, $testTenantB) {
    $pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
        ->execute([$testUserA, 'r155_a@example.com', 'hash', 'R155 User A']);
    $pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
        ->execute([$testTenantA, 'R155 Tenant A']);
    $pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
        ->execute([$testTenantB, 'R155 Tenant B (Unauthorized)']);
    $pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
        ->execute([$testTenantA, $testUserA, 'owner']);
}

function r155_cleanupItems($pdo, $testUserA) {
    $pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserA]);
}

function r155_insertItem($pdo, $id, $title, $tenantId, $userId, $opts = []) {
    $now = time();
    $isProject = $opts['isProject'] ?? 0;
    $parentId = $opts['parentId'] ?? null;
    $projectId = $opts['projectId'] ?? null;
    $estimatedMinutes = $opts['estimatedMinutes'] ?? null;
    $dueDate = $opts['dueDate'] ?? null;
    $prepDate = $opts['prepDate'] ?? null;
    $assignedTo = $opts['assignedTo'] ?? null;
    $status = $opts['status'] ?? 'inbox';
    $pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, is_project, parent_id, project_id, estimated_minutes, due_date, prep_date, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$id, $title, $status, $tenantId, $userId, $assignedTo, $isProject ? 1 : 0, $parentId, $projectId, $estimatedMinutes, $dueDate, $prepDate, $now, $now]);
}

function r155_fetchItem($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM items WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function r155_makeController($pdo, $userId, $tenantId, $joinedTenants) {
    $ctrl = new class($pdo, $userId, $tenantId, $joinedTenants) extends ItemController {
        private $mockInput = [];
        private $lastResponse = null;
        private $lastError = null;

        public function __construct($pdo, $userId, $tenantId, $joinedTenants) {
            $this->pdo = $pdo;
            $this->currentUserId = $userId;
            $this->currentTenantId = $tenantId;
            $this->joinedTenants = $joinedTenants;
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
        public function getLastError() { return $this->lastError; }

        public function callUpdate($id) {
            $ref = new ReflectionMethod('ItemController', 'update');
            $ref->setAccessible(true);
            $ref->invoke($this, $id);
        }
    };
    return $ctrl;
}

r155_setupUsers($pdo, $testUserA, $testTenantA, $testTenantB);
r155_cleanupItems($pdo, $testUserA);

$passed = 0;
$failed = 0;

function r155_assert_equal($label, $actual, $expected) {
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

function r155_expect400($ctrl, $id, $label) {
    global $passed, $failed;
    try {
        $ctrl->callUpdate($id);
        echo "  ✗ FAIL: $label (エラーが発生しなかった)\n";
        $failed++;
    } catch (Exception $e) {
        if (strpos($e->getMessage(), 'ERROR 400') !== false) {
            echo "  ✓ PASS: $label\n";
            $passed++;
        } else {
            echo "  ✗ FAIL: $label (期待: 400, 実際: {$e->getMessage()})\n";
            $failed++;
        }
    }
}

// ============================================================
// テスト1: 自分自身への move → 400
// ============================================================
echo "\n=== テスト1: 自分自身への move は 400 ===\n";
r155_cleanupItems($pdo, $testUserA);
$t1Id = 'r155_t1_a';
r155_insertItem($pdo, $t1Id, 'Task A', $testTenantA, $testUserA);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->setMockInput(['parentId' => $t1Id]);
r155_expect400($ctrl, $t1Id, '自分自身へのmoveは400');
$t1After = r155_fetchItem($pdo, $t1Id);
r155_assert_equal('parent_id は変更されていない', $t1After['parent_id'], null);

// ============================================================
// テスト2: 子タスクへの move（循環） → 400
// ============================================================
echo "\n=== テスト2: 子タスクへの move（循環） は 400 ===\n";
r155_cleanupItems($pdo, $testUserA);
$t2aId = 'r155_t2_a';
$t2bId = 'r155_t2_b';
r155_insertItem($pdo, $t2aId, 'Task A', $testTenantA, $testUserA);
r155_insertItem($pdo, $t2bId, 'Task B (child of A)', $testTenantA, $testUserA, ['parentId' => $t2aId]);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->setMockInput(['parentId' => $t2bId]);
r155_expect400($ctrl, $t2aId, 'A→Bへのmove（Bの親がA）は循環で400');
$t2aAfter = r155_fetchItem($pdo, $t2aId);
r155_assert_equal('A.parent_id は変更されていない', $t2aAfter['parent_id'], null);

// ============================================================
// テスト3: 孫タスクへの move（多階層循環） → 400
// ============================================================
echo "\n=== テスト3: 孫タスクへの move（多階層循環） は 400 ===\n";
r155_cleanupItems($pdo, $testUserA);
$t3aId = 'r155_t3_a';
$t3bId = 'r155_t3_b';
$t3cId = 'r155_t3_c';
r155_insertItem($pdo, $t3aId, 'Task A', $testTenantA, $testUserA);
r155_insertItem($pdo, $t3bId, 'Task B (child of A)', $testTenantA, $testUserA, ['parentId' => $t3aId]);
r155_insertItem($pdo, $t3cId, 'Task C (child of B, grandchild of A)', $testTenantA, $testUserA, ['parentId' => $t3bId]);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->setMockInput(['parentId' => $t3cId]);
r155_expect400($ctrl, $t3aId, 'A→Cへのmove（Cは孫）は循環で400');

// ============================================================
// テスト4: project_id フォールバックで解決される子孫への move（循環） → 400
// Y2 §6.1: is_project=1 ノード配下の子は parent_id === project_id === 親id になりうる。
// さらに parent_id を持たず project_id のみで親を指す子（フォールバック解決）でも
// 循環を検知できることを確認する。
// ============================================================
echo "\n=== テスト4: project_idフォールバック解決の子孫への move は 400 ===\n";
r155_cleanupItems($pdo, $testUserA);
$t4wpId = 'r155_t4_wp'; // work_package相当（is_project=1）
$t4childId = 'r155_t4_child'; // parent_idなし、project_idのみでwpを指す
r155_insertItem($pdo, $t4wpId, 'WorkPackage WP', $testTenantA, $testUserA, ['isProject' => 1]);
r155_insertItem($pdo, $t4childId, 'Child via project_id fallback', $testTenantA, $testUserA, ['projectId' => $t4wpId]);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->setMockInput(['parentId' => $t4childId]);
r155_expect400($ctrl, $t4wpId, 'WP→child(project_idのみ)へのmoveは循環で400');

// ============================================================
// テスト5: 無関係な別プロジェクトへの正常な move → 200
// ============================================================
echo "\n=== テスト5: 無関係な別プロジェクトへの正常な move は 200 ===\n";
r155_cleanupItems($pdo, $testUserA);
$t5p1Id = 'r155_t5_p1';
$t5p2Id = 'r155_t5_p2';
$t5taskId = 'r155_t5_task';
r155_insertItem($pdo, $t5p1Id, 'Project P1', $testTenantA, $testUserA, ['isProject' => 1]);
r155_insertItem($pdo, $t5p2Id, 'Project P2', $testTenantA, $testUserA, ['isProject' => 1]);
r155_insertItem($pdo, $t5taskId, 'Task in P1', $testTenantA, $testUserA, ['projectId' => $t5p1Id]);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->setMockInput(['parentId' => null, 'projectId' => $t5p2Id]);
$ctrl->callUpdate($t5taskId);
$resp = $ctrl->getLastResponse();
r155_assert_equal('success=true', $resp['success'] ?? null, true);
$t5after = r155_fetchItem($pdo, $t5taskId);
r155_assert_equal('project_id = P2', $t5after['project_id'], $t5p2Id);
r155_assert_equal('parent_id = NULL', $t5after['parent_id'], null);

// ============================================================
// テスト6/7/8: parentId変更に伴いprojectIdも正しく更新される
// (6) ルート直下 (7) サブプロジェクト配下 (8) Beaver work_package配下
// ============================================================
echo "\n=== テスト6: ルート直下への move（projectId連動） は 200 ===\n";
r155_cleanupItems($pdo, $testUserA);
$t6rootId = 'r155_t6_root';
$t6taskId = 'r155_t6_task';
r155_insertItem($pdo, $t6rootId, 'Root Project', $testTenantA, $testUserA, ['isProject' => 1]);
r155_insertItem($pdo, $t6taskId, 'Task (no project)', $testTenantA, $testUserA);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->setMockInput(['parentId' => null, 'projectId' => $t6rootId]);
$ctrl->callUpdate($t6taskId);
$resp = $ctrl->getLastResponse();
r155_assert_equal('success=true', $resp['success'] ?? null, true);
$t6after = r155_fetchItem($pdo, $t6taskId);
r155_assert_equal('project_id = root', $t6after['project_id'], $t6rootId);
r155_assert_equal('parent_id = NULL（案件直下）', $t6after['parent_id'], null);

echo "\n=== テスト7: サブプロジェクト配下への move（projectId連動） は 200 ===\n";
r155_cleanupItems($pdo, $testUserA);
$t7rootId = 'r155_t7_root';
$t7subId = 'r155_t7_sub';
$t7taskId = 'r155_t7_task';
r155_insertItem($pdo, $t7rootId, 'Root Project', $testTenantA, $testUserA, ['isProject' => 1]);
r155_insertItem($pdo, $t7subId, 'SubProject', $testTenantA, $testUserA, ['isProject' => 1, 'parentId' => $t7rootId, 'projectId' => $t7rootId]);
r155_insertItem($pdo, $t7taskId, 'Task (no project)', $testTenantA, $testUserA);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->setMockInput(['parentId' => $t7subId, 'projectId' => $t7rootId]);
$ctrl->callUpdate($t7taskId);
$resp = $ctrl->getLastResponse();
r155_assert_equal('success=true', $resp['success'] ?? null, true);
$t7after = r155_fetchItem($pdo, $t7taskId);
r155_assert_equal('parent_id = サブプロジェクト', $t7after['parent_id'], $t7subId);
r155_assert_equal('project_id = ルート案件', $t7after['project_id'], $t7rootId);

echo "\n=== テスト8: Beaver work_package配下への move（projectId連動） は 200 ===\n";
r155_cleanupItems($pdo, $testUserA);
$t8rootId = 'r155_t8_root';
$t8wpId = 'r155_t8_wp';
$t8taskId = 'r155_t8_task';
r155_insertItem($pdo, $t8rootId, 'Beaver Root Project', $testTenantA, $testUserA, ['isProject' => 1]);
// Y2 §3: work_packageは is_project=1, parent_id=NULL, project_id=案件ルートID
r155_insertItem($pdo, $t8wpId, 'WorkPackage', $testTenantA, $testUserA, ['isProject' => 1, 'projectId' => $t8rootId]);
r155_insertItem($pdo, $t8taskId, 'Task (no project)', $testTenantA, $testUserA);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->setMockInput(['parentId' => $t8wpId, 'projectId' => $t8rootId]);
$ctrl->callUpdate($t8taskId);
$resp = $ctrl->getLastResponse();
r155_assert_equal('success=true', $resp['success'] ?? null, true);
$t8after = r155_fetchItem($pdo, $t8taskId);
r155_assert_equal('parent_id = work_package', $t8after['parent_id'], $t8wpId);
r155_assert_equal('project_id = ルート案件', $t8after['project_id'], $t8rootId);

// ============================================================
// テスト9: 所属と無関係なフィールドが move で保持される
// ============================================================
echo "\n=== テスト9: move で工数・日付・担当・status が保持される ===\n";
r155_cleanupItems($pdo, $testUserA);
$t9p1Id = 'r155_t9_p1';
$t9p2Id = 'r155_t9_p2';
$t9taskId = 'r155_t9_task';
r155_insertItem($pdo, $t9p1Id, 'Project P1', $testTenantA, $testUserA, ['isProject' => 1]);
r155_insertItem($pdo, $t9p2Id, 'Project P2', $testTenantA, $testUserA, ['isProject' => 1]);
r155_insertItem($pdo, $t9taskId, 'Task with data', $testTenantA, $testUserA, [
    'projectId' => $t9p1Id,
    'estimatedMinutes' => 90,
    'dueDate' => '2026-09-01',
    'prepDate' => '2026-08-30',
    'assignedTo' => $testUserA,
    'status' => 'next',
]);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->setMockInput(['parentId' => null, 'projectId' => $t9p2Id]);
$ctrl->callUpdate($t9taskId);
$resp = $ctrl->getLastResponse();
r155_assert_equal('success=true', $resp['success'] ?? null, true);
$t9after = r155_fetchItem($pdo, $t9taskId);
r155_assert_equal('project_id = P2（所属変更のみ反映）', $t9after['project_id'], $t9p2Id);
r155_assert_equal('estimated_minutes 保持', (int)$t9after['estimated_minutes'], 90);
r155_assert_equal('due_date 保持', $t9after['due_date'], '2026-09-01');
r155_assert_equal('prep_date 保持', $t9after['prep_date'], '2026-08-30');
r155_assert_equal('assigned_to 保持', $t9after['assigned_to'], $testUserA);
r155_assert_equal('status 保持', $t9after['status'], 'next');

// ============================================================
// テスト10: テナントを跨ぐ move は既存チェックにより 403（回帰確認）
// ============================================================
echo "\n=== テスト10: テナントを跨ぐ move は 403（既存チェックの回帰確認） ===\n";
r155_cleanupItems($pdo, $testUserA);
$t10taskId = 'r155_t10_task';
$t10otherTenantProjectId = 'r155_t10_other_proj';
// tenantB側にプロジェクトを作成（tenantA側ユーザーは未参加）
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, is_project, created_at, updated_at) VALUES (?, 'Other Tenant Project', 'inbox', ?, 'r155_other_user', 1, ?, ?)")
    ->execute([$t10otherTenantProjectId, $testTenantB, time(), time()]);
r155_insertItem($pdo, $t10taskId, 'Task in tenantA', $testTenantA, $testUserA);

$ctrl = r155_makeController($pdo, $testUserA, $testTenantA, [$testTenantA]); // tenantBに未参加
$ctrl->setMockInput(['parentId' => $t10otherTenantProjectId, 'projectId' => $t10otherTenantProjectId]);
$err403 = false;
try {
    $ctrl->callUpdate($t10taskId);
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'ERROR 403') !== false) $err403 = true;
}
r155_assert_equal('テナント跨ぎで403', $err403, true);
$t10after = r155_fetchItem($pdo, $t10taskId);
r155_assert_equal('parent_id は変更されていない', $t10after['parent_id'], null);
$pdo->prepare("DELETE FROM items WHERE id = ?")->execute([$t10otherTenantProjectId]);

// ============================================================
// クリーンアップ
// ============================================================
r155_cleanupItems($pdo, $testUserA);
$pdo->prepare("DELETE FROM memberships WHERE user_id = ?")->execute([$testUserA]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserA]);
$pdo->prepare("DELETE FROM tenants WHERE id IN (?, ?)")->execute([$testTenantA, $testTenantB]);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
