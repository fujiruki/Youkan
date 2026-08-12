<?php
/**
 * R-085: BaseController::updateEntity() のトランザクション処理テスト
 *
 * 背景:
 *   ItemController::update() は $this->pdo->beginTransaction() の中で
 *   updateEntity() を呼ぶ。updateEntity() は PDOException を catch すると
 *   sendError(500, 'Database Error during update') を呼ぶが、sendError() は
 *   内部で exit する。exit はスクリプトを即座に終了させるため、
 *   ItemController::update() 側の catch (Exception $e) { $this->pdo->rollBack(); }
 *   には絶対に到達せず、トランザクションが明示的にロールバックされないまま
 *   プロセスが終了していた。
 *
 *   本番PHPエラーログで確認された "database is locked" エラーの直接原因では
 *   ないが、書き込み失敗時にトランザクションを开いたまま終了するのは
 *   ロック保持時間を不必要に延ばす欠陥のため、updateEntity() 自身が
 *   例外を送出する前に確実にロールバックするよう修正する。
 *
 * 検証方法:
 *   sendError() をオーバーライドしてexitの代わりに例外を投げるテスト用
 *   サブクラスを使い、実際に存在しないカラムを更新させてPDOExceptionを
 *   意図的に発生させる。例外が伝播した時点で $pdo->inTransaction() が
 *   false になっている(=updateEntity内で既にロールバック済み)ことを確認する。
 */
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../BaseController.php';

$passed = 0;
$failed = 0;
function assertTrue($name, $cond, $detail = '') {
    global $passed, $failed;
    if ($cond) {
        echo "[PASS] $name\n";
        $passed++;
    } else {
        echo "[FAIL] $name" . ($detail ? " - $detail" : '') . "\n";
        $failed++;
    }
}

class TestUpdateEntityController extends BaseController {
    private array $mockInput = [];

    public function setMockInput(array $data) { $this->mockInput = $data; }
    protected function getInput() { return $this->mockInput; }
    protected function authenticate() { /* テスト用バイパス */ }
    protected function sendJSON($data) { /* テスト用: 出力しない */ }
    protected function sendError($code, $msg) { throw new Exception("ERROR $code: $msg"); }

    public function publicUpdateEntity(string $table, string $id, array $allowedFields) {
        return $this->updateEntity($table, $id, $allowedFields);
    }

    public function getPdo(): PDO { return $this->pdo; }
}

$controller = new TestUpdateEntityController();
$pdo = $controller->getPdo();

// --- セットアップ: テスト用アイテムを作成 ---
$testUserId = 'test_user_r085_rollback';
$testTenantId = 'test_tenant_r085_rollback';
$itemId = 'r085_rollback_test_item';

$pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testUserId, 'r085_rollback_test@example.com', 'hash', 'R085 Rollback Tester']);
$pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
    ->execute([$testTenantId, 'R085 Rollback Test Tenant']);
$pdo->prepare("DELETE FROM items WHERE id = ?")->execute([$itemId]);
$now = time();
$pdo->prepare("INSERT INTO items (id, title, status, tenant_id, created_by, assigned_to, created_at, updated_at)
               VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?)")
    ->execute([$itemId, 'R085 Rollback Test Task', $testTenantId, $testUserId, $testUserId, $now, $now]);

echo "=== R-085: updateEntity()のトランザクション・ロールバックテスト ===\n\n";

// --- テスト1: 実在しないカラムを更新させてPDOExceptionを発生させる ---
// ItemController::update()と同様、呼び出し元があらかじめbeginTransaction()した
// 状態を再現する
echo "テスト1: トランザクション中にupdateEntity()がPDOExceptionを受けた場合\n";
$pdo->beginTransaction();
$controller->setMockInput(['bogusColXyz' => 'test-value']);

$threwException = false;
$exceptionMessage = '';
try {
    $controller->publicUpdateEntity('items', $itemId, ['bogus_col_xyz']);
} catch (Exception $e) {
    $threwException = true;
    $exceptionMessage = $e->getMessage();
}

assertTrue(
    '存在しないカラムの更新はPDOException経由でエラー応答(500)になる',
    $threwException && strpos($exceptionMessage, 'ERROR 500') !== false,
    "message={$exceptionMessage}"
);

assertTrue(
    'sendError()到達時点でトランザクションは既にロールバック済み(inTransaction()===false)',
    $pdo->inTransaction() === false,
    'inTransaction=' . var_export($pdo->inTransaction(), true)
);

// 万一ロールバックされていなければテスト汚染を防ぐため後始末
if ($pdo->inTransaction()) {
    $pdo->rollBack();
}

// --- テスト2: 正常な更新は従来通りトランザクション内で成功する(回帰確認) ---
echo "\nテスト2: 正常な更新は従来通り成功する(回帰確認)\n";
$pdo->beginTransaction();
$controller->setMockInput(['title' => '更新後タイトル']);
$result = $controller->publicUpdateEntity('items', $itemId, ['title']);
$pdo->commit();

$stmt = $pdo->prepare("SELECT title FROM items WHERE id = ?");
$stmt->execute([$itemId]);
$updatedTitle = $stmt->fetchColumn();

assertTrue(
    '正常な更新はコミットされ、値が反映される',
    $result['success'] === true && $updatedTitle === '更新後タイトル',
    "title={$updatedTitle}"
);

// --- クリーンアップ ---
$pdo->prepare("DELETE FROM items WHERE id = ?")->execute([$itemId]);
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUserId]);
$pdo->prepare("DELETE FROM tenants WHERE id = ?")->execute([$testTenantId]);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
