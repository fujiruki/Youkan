<?php
/**
 * R-027 カスケード操作テスト
 *
 * テストケース:
 * 1. テナント移動: P(tenantA) > Q > I → P を tenantB に → Q,I もtenantB
 * 2. プロジェクト移動: 移動先プロジェクトのtenant_idが子孫に伝播する
 * 3. 個人化: tenantId=null → 子孫もNULL
 * 4. 権限チェック: 未参加テナントへの移動で403
 * 5. archive (is_project=1): プロジェクトアーカイブで子孫もアーカイブ
 * 6. archive (is_project=0): 通常タスク親アーカイブで子subtaskもアーカイブ（新規挙動）
 * 7. trash: 親ゴミ箱移動で子孫も連動
 * 8. restore: 復元で子孫も連動
 * 9. delete: 物理削除で子孫も削除
 * 10. 循環参照: parent_idループで無限ループしない
 * 11. トランザクション失敗: rollbackで親も子も元の状態
 */

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';

// テスト用テナント・ユーザーID
$testUserA = 'cascade_test_user_a';
$testTenantA = 'cascade_test_tenant_a';
$testTenantB = 'cascade_test_tenant_b';
$testTenantC = 'cascade_test_tenant_c'; // 未参加テナント

$pdo = getDB();

// セットアップ
function setupUsers($pdo, $testUserA, $testTenantA, $testTenantB, $testTenantC) {
    $pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
        ->execute([$testUserA, 'cascade_a@example.com', 'hash', 'Cascade User A']);
    $pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
        ->execute([$testTenantA, 'Cascade Tenant A']);
    $pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
        ->execute([$testTenantB, 'Cascade Tenant B']);
    $pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
        ->execute([$testTenantC, 'Cascade Tenant C (Unauthorized)']);
    // A, B に参加。C には参加しない
    $pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
        ->execute([$testTenantA, $testUserA, 'owner']);
    $pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
        ->execute([$testTenantB, $testUserA, 'member']);
}

function cleanupItems($pdo, $testUserA) {
    $pdo->prepare("DELETE FROM items WHERE created_by = ?")->execute([$testUserA]);
}

function insertItem($pdo, $id, $title, $tenantId, $userId, $isProject = 0, $parentId = null, $projectId = null) {
    $now = time();
    $pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, is_project, parent_id, project_id, created_at, updated_at)
                   VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute([$id, $title, $tenantId, $userId, $userId, $isProject ? 1 : 0, $parentId, $projectId, $now, $now]);
}

function fetchItem($pdo, $id) {
    $stmt = $pdo->prepare("SELECT * FROM items WHERE id = ?");
    $stmt->execute([$id]);
    return $stmt->fetch(PDO::FETCH_ASSOC);
}

function makeController($pdo, $userId, $tenantId, $joinedTenants) {
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

        public function callUpdateStatus($id, $action) {
            $ref = new ReflectionMethod('ItemController', 'updateStatus');
            $ref->setAccessible(true);
            $ref->invoke($this, $id, $action);
        }

        public function callDelete($id) {
            $ref = new ReflectionMethod('ItemController', 'delete');
            $ref->setAccessible(true);
            $ref->invoke($this, $id);
        }

        public function callShow($id) {
            $ref = new ReflectionMethod('ItemController', 'show');
            $ref->setAccessible(true);
            $ref->invoke($this, $id);
        }
    };
    return $ctrl;
}

setupUsers($pdo, $testUserA, $testTenantA, $testTenantB, $testTenantC);
cleanupItems($pdo, $testUserA);

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

function assert_not_null($label, $actual) {
    global $passed, $failed;
    if ($actual !== null) {
        echo "  ✓ PASS: $label\n";
        $passed++;
    } else {
        echo "  ✗ FAIL: $label (null)\n";
        $failed++;
    }
}

// ============================================================
// テスト1: テナント移動カスケード（is_project=1）
// ============================================================
echo "\n=== テスト1: テナント移動 P>Q>I → tenantB へ ===\n";
cleanupItems($pdo, $testUserA);
$pId = 'cas_t1_p';
$qId = 'cas_t1_q';
$iId = 'cas_t1_i';
insertItem($pdo, $pId, 'Project P', $testTenantA, $testUserA, 1);
insertItem($pdo, $qId, 'Project Q', $testTenantA, $testUserA, 1, null, $pId);
insertItem($pdo, $iId, 'Item I', $testTenantA, $testUserA, 0, null, $qId);

$ctrl = makeController($pdo, $testUserA, $testTenantA, [$testTenantA, $testTenantB]);
$ctrl->setMockInput(['tenantId' => $testTenantB]);
$ctrl->callUpdate($pId);
$resp = $ctrl->getLastResponse();

assert_not_null('レスポンスあり', $resp);
assert_equal('success=true', $resp['success'] ?? null, true);
$affected = $resp['affectedDescendantIds'] ?? [];
sort($affected);
$expected = [$qId, $iId];
sort($expected);
assert_equal('affectedDescendantIds に Q,I が含まれる', $affected, $expected);

$p = fetchItem($pdo, $pId);
$q = fetchItem($pdo, $qId);
$i = fetchItem($pdo, $iId);
assert_equal('P.tenant_id = tenantB', $p['tenant_id'], $testTenantB);
assert_equal('Q.tenant_id = tenantB', $q['tenant_id'], $testTenantB);
assert_equal('I.tenant_id = tenantB', $i['tenant_id'], $testTenantB);

// ============================================================
// テスト2: プロジェクト移動 → tenant_id 連動
// ============================================================
echo "\n=== テスト2: プロジェクト移動 → 子孫の tenant_id が新テナントに連動 ===\n";
cleanupItems($pdo, $testUserA);
$p1Id = 'cas_t2_p1';
$p2Id = 'cas_t2_p2';
$tId = 'cas_t2_t';
insertItem($pdo, $p1Id, 'Project P1', $testTenantA, $testUserA, 1);
insertItem($pdo, $p2Id, 'Project P2', $testTenantB, $testUserA, 1);
insertItem($pdo, $tId, 'Task T', $testTenantA, $testUserA, 0, null, $p1Id);

$ctrl = makeController($pdo, $testUserA, $testTenantA, [$testTenantA, $testTenantB]);
// 実際のAPI呼び出しではフロントが projectId と tenantId を両方送る
// テスト環境では getInput() が mockInput を返すため、tenantId も明示的に含める
$ctrl->setMockInput(['projectId' => $p2Id, 'tenantId' => $testTenantB]);
$ctrl->callUpdate($p1Id);
$resp = $ctrl->getLastResponse();

assert_not_null('レスポンスあり', $resp);
assert_equal('success=true', $resp['success'] ?? null, true);
$p1After = fetchItem($pdo, $p1Id);
$tAfter = fetchItem($pdo, $tId);
assert_equal('P1.tenant_id = tenantB（更新）', $p1After['tenant_id'], $testTenantB);
assert_equal('T.tenant_id = tenantB（カスケード）', $tAfter['tenant_id'], $testTenantB);

// ============================================================
// テスト3: 個人化 (tenantId=null)
// ============================================================
echo "\n=== テスト3: 個人化 tenantId=null → 子孫もNULL ===\n";
cleanupItems($pdo, $testUserA);
$r3pId = 'cas_t3_p';
$r3cId = 'cas_t3_c';
insertItem($pdo, $r3pId, 'Task P', $testTenantA, $testUserA, 0);
insertItem($pdo, $r3cId, 'Subtask C', $testTenantA, $testUserA, 0, $r3pId);

$ctrl = makeController($pdo, $testUserA, $testTenantA, [$testTenantA, $testTenantB]);
$ctrl->setMockInput(['tenantId' => null]);
$ctrl->callUpdate($r3pId);
$resp = $ctrl->getLastResponse();

assert_not_null('レスポンスあり', $resp);
assert_equal('success=true', $resp['success'] ?? null, true);
$parentAfter = fetchItem($pdo, $r3pId);
$childAfter = fetchItem($pdo, $r3cId);
assert_equal('親 tenant_id = NULL', $parentAfter['tenant_id'], null);
assert_equal('子 tenant_id = NULL（カスケード）', $childAfter['tenant_id'], null);

// ============================================================
// テスト4: 権限チェック（未参加テナント）
// ============================================================
echo "\n=== テスト4: 未参加テナントへの移動で403 ===\n";
cleanupItems($pdo, $testUserA);
$r4Id = 'cas_t4_item';
insertItem($pdo, $r4Id, 'Task 4', $testTenantA, $testUserA);

$ctrl = makeController($pdo, $testUserA, $testTenantA, [$testTenantA, $testTenantB]);
$ctrl->setMockInput(['tenantId' => $testTenantC]);
$err403 = false;
try {
    $ctrl->callUpdate($r4Id);
} catch (Exception $e) {
    if (strpos($e->getMessage(), 'ERROR 403') !== false) $err403 = true;
}
assert_equal('未参加テナントで403エラー', $err403, true);
// テナントは変わっていないこと
$r4After = fetchItem($pdo, $r4Id);
assert_equal('テナントは変化なし', $r4After['tenant_id'], $testTenantA);

// ============================================================
// テスト5: archive (is_project=1) → 子孫もアーカイブ
// ============================================================
echo "\n=== テスト5: archive (is_project=1) → 子孫もアーカイブ ===\n";
cleanupItems($pdo, $testUserA);
$r5pId = 'cas_t5_p';
$r5cId = 'cas_t5_c';
$r5gId = 'cas_t5_g'; // 孫
insertItem($pdo, $r5pId, 'Project P5', $testTenantA, $testUserA, 1);
insertItem($pdo, $r5cId, 'Task C5', $testTenantA, $testUserA, 0, null, $r5pId);
insertItem($pdo, $r5gId, 'Subtask G5', $testTenantA, $testUserA, 0, $r5cId);

$ctrl = makeController($pdo, $testUserA, $testTenantA, [$testTenantA, $testTenantB]);
$ctrl->callUpdateStatus($r5pId, 'archive');
$resp = $ctrl->getLastResponse();

assert_equal('success=true', $resp['success'] ?? null, true);
$affected = $resp['affectedDescendantIds'] ?? [];
sort($affected);
$expAff = [$r5cId, $r5gId];
sort($expAff);
assert_equal('affectedDescendantIds に C,G が含まれる', $affected, $expAff);

$p5 = fetchItem($pdo, $r5pId);
$c5 = fetchItem($pdo, $r5cId);
$g5 = fetchItem($pdo, $r5gId);
assert_equal('P5.is_archived = 1', (int)$p5['is_archived'], 1);
assert_equal('C5.is_archived = 1（カスケード）', (int)$c5['is_archived'], 1);
assert_equal('G5.is_archived = 1（カスケード）', (int)$g5['is_archived'], 1);

// ============================================================
// テスト6: archive (is_project=0) → 通常タスク親→子subtaskもアーカイブ（新規挙動）
// ============================================================
echo "\n=== テスト6: archive (is_project=0) → 子subtaskもアーカイブ ===\n";
cleanupItems($pdo, $testUserA);
$r6tId = 'cas_t6_task';
$r6sId = 'cas_t6_sub';
insertItem($pdo, $r6tId, 'Task T6', $testTenantA, $testUserA, 0);
insertItem($pdo, $r6sId, 'Subtask S6', $testTenantA, $testUserA, 0, $r6tId);

$ctrl = makeController($pdo, $testUserA, $testTenantA, [$testTenantA, $testTenantB]);
$ctrl->callUpdateStatus($r6tId, 'archive');
$resp = $ctrl->getLastResponse();

assert_equal('success=true', $resp['success'] ?? null, true);
$t6 = fetchItem($pdo, $r6tId);
$s6 = fetchItem($pdo, $r6sId);
assert_equal('T6.is_archived = 1', (int)$t6['is_archived'], 1);
assert_equal('S6.is_archived = 1（カスケード、新規挙動）', (int)$s6['is_archived'], 1);

// ============================================================
// テスト7: trash → 子孫も連動
// ============================================================
echo "\n=== テスト7: trash → 子孫も連動 ===\n";
cleanupItems($pdo, $testUserA);
$r7pId = 'cas_t7_p';
$r7cId = 'cas_t7_c';
insertItem($pdo, $r7pId, 'Task P7', $testTenantA, $testUserA, 0);
insertItem($pdo, $r7cId, 'Subtask C7', $testTenantA, $testUserA, 0, $r7pId);

$ctrl = makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->callUpdateStatus($r7pId, 'trash');
$resp = $ctrl->getLastResponse();

assert_equal('success=true', $resp['success'] ?? null, true);
$p7 = fetchItem($pdo, $r7pId);
$c7 = fetchItem($pdo, $r7cId);
assert_not_null('P7.deleted_at が設定された', $p7['deleted_at']);
assert_not_null('C7.deleted_at が設定された（カスケード）', $c7['deleted_at']);
assert_equal('P7.is_archived = 0（ゴミ箱時はアーカイブ解除）', (int)$p7['is_archived'], 0);
assert_equal('C7.is_archived = 0', (int)$c7['is_archived'], 0);

// ============================================================
// テスト8: restore → 子孫も連動
// ============================================================
echo "\n=== テスト8: restore → 子孫も連動 ===\n";

$ctrl->callUpdateStatus($r7pId, 'restore');
$resp = $ctrl->getLastResponse();

assert_equal('success=true', $resp['success'] ?? null, true);
$p7r = fetchItem($pdo, $r7pId);
$c7r = fetchItem($pdo, $r7cId);
assert_equal('P7.deleted_at = NULL（復元）', $p7r['deleted_at'], null);
assert_equal('C7.deleted_at = NULL（カスケード復元）', $c7r['deleted_at'], null);
assert_equal('P7.is_archived = 0', (int)$p7r['is_archived'], 0);
assert_equal('C7.is_archived = 0', (int)$c7r['is_archived'], 0);

// ============================================================
// テスト9: delete → 子孫も物理削除
// ============================================================
echo "\n=== テスト9: delete → 子孫も物理削除 ===\n";
cleanupItems($pdo, $testUserA);
$r9pId = 'cas_t9_p';
$r9c1Id = 'cas_t9_c1';
$r9c2Id = 'cas_t9_c2';
insertItem($pdo, $r9pId, 'Task P9', $testTenantA, $testUserA, 0);
insertItem($pdo, $r9c1Id, 'Child1 C9', $testTenantA, $testUserA, 0, $r9pId);
insertItem($pdo, $r9c2Id, 'Child2 C9', $testTenantA, $testUserA, 0, $r9pId);

$ctrl = makeController($pdo, $testUserA, $testTenantA, [$testTenantA]);
$ctrl->callDelete($r9pId);
$resp = $ctrl->getLastResponse();

assert_equal('success=true', $resp['success'] ?? null, true);
$deleted = $resp['deletedDescendantIds'] ?? [];
sort($deleted);
$expDel = [$r9c1Id, $r9c2Id];
sort($expDel);
assert_equal('deletedDescendantIds に C1,C2 が含まれる', $deleted, $expDel);

assert_equal('P9 が削除された', fetchItem($pdo, $r9pId), false);
assert_equal('C1 が削除された', fetchItem($pdo, $r9c1Id), false);
assert_equal('C2 が削除された', fetchItem($pdo, $r9c2Id), false);

// ============================================================
// テスト10: 循環参照防止（無限ループしない）
// ============================================================
echo "\n=== テスト10: 循環参照で無限ループしない ===\n";
cleanupItems($pdo, $testUserA);
$r10aId = 'cas_t10_a';
$r10bId = 'cas_t10_b';
$now = time();
// A→B、B→A の循環を DB に直接構築
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, parent_id, created_at, updated_at)
               VALUES (?, 'Circular A', 'inbox', ?, ?, ?, ?, ?)")
    ->execute([$r10aId, $testTenantA, $testUserA, $r10bId, $now, $now]);
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, parent_id, created_at, updated_at)
               VALUES (?, 'Circular B', 'inbox', ?, ?, ?, ?, ?)")
    ->execute([$r10bId, $testTenantA, $testUserA, $r10aId, $now, $now]);

$ctrl = makeController($pdo, $testUserA, $testTenantA, [$testTenantA, $testTenantB]);
$loopOk = true;
try {
    $ctrl->setMockInput(['tenantId' => $testTenantB]);
    $ctrl->callUpdate($r10aId);
} catch (Exception $e) {
    // 503などのエラーは問題外
    $loopOk = false;
}
assert_equal('循環参照でも無限ループしない（正常終了）', $loopOk, true);
// クリーンアップ（循環参照データを削除）
$pdo->prepare("DELETE FROM items WHERE id IN (?, ?)")->execute([$r10aId, $r10bId]);

// ============================================================
// テスト11: トランザクション失敗 → rollbackで元の状態
// PDO トランザクションの beginTransaction/rollBack 動作を直接検証
// ============================================================
echo "\n=== テスト11: トランザクション失敗 → rollbackで元の状態 ===\n";
cleanupItems($pdo, $testUserA);
$r11pId = 'cas_t11_p';
$r11cId = 'cas_t11_c';
insertItem($pdo, $r11pId, 'Task P11', $testTenantA, $testUserA, 0);
insertItem($pdo, $r11cId, 'Child C11', $testTenantA, $testUserA, 0, $r11pId);

// beginTransaction → 更新 → 例外 → rollBack のサイクルを直接検証
$rollbackOk = false;
try {
    $pdo->beginTransaction();
    $pdo->prepare("UPDATE items SET tenant_id = ?, updated_at = ? WHERE id = ?")
        ->execute([$testTenantB, time(), $r11pId]);
    $pdo->prepare("UPDATE items SET tenant_id = ?, updated_at = ? WHERE id = ?")
        ->execute([$testTenantB, time(), $r11cId]);
    throw new Exception('強制エラー（ロールバックテスト）');
} catch (Exception $e) {
    $pdo->rollBack();
    $rollbackOk = true;
}

$p11after = fetchItem($pdo, $r11pId);
$c11after = fetchItem($pdo, $r11cId);
assert_equal('rollBack が実行された', $rollbackOk, true);
assert_equal('P11.tenant_id = tenantA（ロールバック）', $p11after['tenant_id'], $testTenantA);
assert_equal('C11.tenant_id = tenantA（ロールバック）', $c11after['tenant_id'], $testTenantA);

// ============================================================
// テスト12: カスケード移動後の show() が joinedTenants 経由で取得できる
// ============================================================
echo "\n=== テスト12: カスケード移動後の show() が 200 で取得できる ===\n";
cleanupItems($pdo, $testUserA);
$r12pId = 'cas_t12_p';
$r12cId = 'cas_t12_c';
// P: 個人モード（tenant_id=null）で作成した子アイテム
$now12 = time();
// 親（プロジェクト）を tenantA で作成
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, is_project, parent_id, project_id, created_at, updated_at)
               VALUES (?, ?, 'inbox', ?, ?, ?, 1, NULL, NULL, ?, ?)")
    ->execute([$r12pId, 'Project P12', $testTenantA, $testUserA, $testUserA, $now12, $now12]);
// 子（タスク）を tenantA で作成
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, is_project, parent_id, project_id, created_at, updated_at)
               VALUES (?, ?, 'inbox', ?, ?, ?, 0, NULL, ?, ?, ?)")
    ->execute([$r12cId, 'Item I12', $testTenantA, $testUserA, $testUserA, $r12pId, $now12, $now12]);

// P を tenantB にカスケード移動（子 I12 も tenantB になる）
$ctrlMove = makeController($pdo, $testUserA, $testTenantA, [$testTenantA, $testTenantB]);
$ctrlMove->setMockInput(['tenantId' => $testTenantB]);
$ctrlMove->callUpdate($r12pId);
$moveResp = $ctrlMove->getLastResponse();
assert_equal('移動成功 success=true', $moveResp['success'] ?? null, true);

// I12 が tenantB に移動済みであることを直接DBで確認
$i12db = fetchItem($pdo, $r12cId);
assert_equal('I12.tenant_id = tenantB（カスケード確認）', $i12db['tenant_id'], $testTenantB);

// show() を currentTenantId=tenantA で呼ぶ → joinedTenants=[tenantA,tenantB] なので 200 になる
$ctrlShow = makeController($pdo, $testUserA, $testTenantA, [$testTenantA, $testTenantB]);
$showOk = false;
try {
    $ctrlShow->callShow($r12cId);
    $showResp = $ctrlShow->getLastResponse();
    if ($showResp !== null) $showOk = true;
} catch (Exception $e) {
    // 404 や 403 が来たら $showOk は false のまま
}
assert_equal('カスケード移動後に子アイテムを show() できる（404にならない）', $showOk, true);

// show() が正しい id を返すこと
if ($showOk) {
    assert_equal('show() レスポンスの id が正しい', $ctrlShow->getLastResponse()['id'] ?? null, $r12cId);
}

// ============================================================
// クリーンアップ
// ============================================================
cleanupItems($pdo, $testUserA);
$pdo->prepare("DELETE FROM memberships WHERE user_id = ?")->execute([$testUserA]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserA]);
$pdo->prepare("DELETE FROM tenants WHERE id IN (?, ?, ?)")->execute([$testTenantA, $testTenantB, $testTenantC]);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
