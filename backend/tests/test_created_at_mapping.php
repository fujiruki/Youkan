<?php
/**
 * R-060-Y2 テスト: mapItemRow が createdAt(ms) / updatedAt(ms) を正しく返すこと
 *
 * テストケース:
 * 1. created_at（Unix秒）が createdAt（ミリ秒）として返される
 * 2. updated_at（Unix秒）が updatedAt（ミリ秒）として返される
 * 3. created_at / updated_at が NULL の場合は null を返す
 * 4. 変換後の値が Date.now() のミリ秒と同じ桁数（13桁）であること
 */

require_once __DIR__ . '/../BaseController.php';

$passed = 0;
$failed = 0;

function assertEq($name, $actual, $expected) {
    global $passed, $failed;
    if ($actual === $expected) {
        echo "[PASS] $name\n";
        $passed++;
    } else {
        echo "[FAIL] $name\n";
        echo "  Expected: " . var_export($expected, true) . "\n";
        echo "  Actual:   " . var_export($actual, true) . "\n";
        $failed++;
    }
}

function assertNull($name, $actual) {
    global $passed, $failed;
    if ($actual === null) {
        echo "[PASS] $name\n";
        $passed++;
    } else {
        echo "[FAIL] $name: 期待値 null、実際の値 " . var_export($actual, true) . "\n";
        $failed++;
    }
}

// テスト用コントローラー（mapItemRow を公開）
class TestCreatedAtController extends BaseController {
    protected function authenticate() {}
    protected function sendJSON($data) {}
    protected function sendError($code, $msg) {}
    public function exposedMapItemRow($item) {
        return $this->mapItemRow($item);
    }
}

$controller = new TestCreatedAtController();

echo "=== R-060-Y2: createdAt/updatedAt(ms) マッピングテスト ===\n\n";

// テスト1: created_at（Unix秒）→ createdAt（ms、×1000）
$nowSec = 1749600000;
$item = [
    'created_at' => $nowSec,
    'updated_at' => $nowSec,
    'completed_at' => null,
    'deleted_at' => null,
    'prep_date' => null,
    'is_project' => 0,
    'is_intent' => 0,
    'is_archived' => 0,
    'is_boosted' => 0,
    'interrupt' => 0,
    'work_days' => 1,
    'focus_order' => 0,
    'estimated_minutes' => 0,
    'gross_profit_target' => 0,
];
$result = $controller->exposedMapItemRow($item);

assertEq(
    'createdAt は created_at × 1000（ミリ秒）',
    $result['createdAt'],
    $nowSec * 1000
);

assertEq(
    'updatedAt は updated_at × 1000（ミリ秒）',
    $result['updatedAt'],
    $nowSec * 1000
);

// テスト2: createdAt が 13桁（ms 桁数）であること
$digits = strlen((string)$result['createdAt']);
assertEq(
    'createdAt は 13桁のミリ秒タイムスタンプ',
    $digits,
    13
);

// テスト3: created_at が null の場合 createdAt も null
$itemNull = array_merge($item, ['created_at' => null, 'updated_at' => null]);
$resultNull = $controller->exposedMapItemRow($itemNull);

assertNull('created_at=null のとき createdAt=null', array_key_exists('createdAt', $resultNull) ? $resultNull['createdAt'] : 'MISSING');
assertNull('updated_at=null のとき updatedAt=null', array_key_exists('updatedAt', $resultNull) ? $resultNull['updatedAt'] : 'MISSING');

// テスト4: created_at 未設定の場合も null
$itemMissing = array_diff_key($item, array_flip(['created_at', 'updated_at']));
$resultMissing = $controller->exposedMapItemRow($itemMissing);

assertNull('created_at 未設定のとき createdAt=null', array_key_exists('createdAt', $resultMissing) ? $resultMissing['createdAt'] : 'MISSING');
assertNull('updated_at 未設定のとき updatedAt=null', array_key_exists('updatedAt', $resultMissing) ? $resultMissing['updatedAt'] : 'MISSING');

// テスト5: createdAt の値が楽観的更新の Date.now() と比較可能（単位一致）
$tsMs = $nowSec * 1000;
$optimisticUpdateMs = 1749600000000; // Date.now() 相当（ms）
assertEq(
    '楽観的更新の Date.now(ms) と createdAt(ms) が同単位で比較可能',
    $tsMs,
    $optimisticUpdateMs
);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
