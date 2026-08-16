<?php
/**
 * R-105 カレンダー系エンドポイントが items.meta を返すことのテスト
 * 仕様: docs/SPEC/04_データ設計.md §3.5「ガント時間軸タイムラインのブロック位置（R-105）」
 *
 * バグ: CalendarController の3つのSELECT文が明示カラムリストで items.meta を含まないため、
 * ガントビューが使う /calendar/items?mode=gantt のレスポンスで meta が常に null になり、
 * ドラッグ調整した gantt_time_blocks がリロード後に消えたように見える。
 *
 * テストケース:
 * 1. getItems（mode=gantt）で meta.gantt_time_blocks が返る
 * 2. getItems（mode=range）で meta.gantt_time_blocks が返る
 * 3. getLoad で meta.gantt_time_blocks が返る
 * 4. getCompletedItems で meta.gantt_time_blocks が返る
 * 5. meta が NULL のアイテムは meta === null で返る（後方互換）
 */

$tmpDb = sys_get_temp_dir() . '/youkan_r105_test_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../CalendarController.php';

$pdo = getDB();

// completed_at は db.php の自動カラム追加対象外のため、新規DBでは自前で用意する
$itemCols = array_column($pdo->query("PRAGMA table_info(items)")->fetchAll(PDO::FETCH_ASSOC), 'name');
if (!in_array('completed_at', $itemCols)) {
    $pdo->exec("ALTER TABLE items ADD COLUMN completed_at INTEGER DEFAULT NULL");
}

$testUser = 'u_r105_test';
$today = date('Y-m-d');
$now = time();
$metaJson = json_encode(['gantt_time_blocks' => [$today => 480]]);

$pdo->exec("DELETE FROM items WHERE id LIKE 'r105_%'");
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUser]);

$pdo->prepare("INSERT INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute([$testUser, 'r105@example.com', 'hash', 'R105テスト']);

$pdo->prepare("
    INSERT INTO items (id, title, status, created_by, assigned_to, due_date, estimated_minutes, is_project, meta, created_at, updated_at)
    VALUES (?, ?, 'inbox', ?, ?, ?, 720, 0, ?, ?, ?)
")->execute(['r105_with_meta', 'meta付きアイテム', $testUser, $testUser, $today, $metaJson, $now, $now]);

$pdo->prepare("
    INSERT INTO items (id, title, status, created_by, assigned_to, due_date, estimated_minutes, is_project, meta, created_at, updated_at)
    VALUES (?, ?, 'inbox', ?, ?, ?, 120, 0, NULL, ?, ?)
")->execute(['r105_no_meta', 'metaなしアイテム', $testUser, $testUser, $today, $now, $now]);

$pdo->prepare("
    INSERT INTO items (id, title, status, created_by, assigned_to, due_date, estimated_minutes, is_project, meta, completed_at, created_at, updated_at)
    VALUES (?, ?, 'done', ?, ?, ?, 60, 0, ?, ?, ?, ?)
")->execute(['r105_completed', '完了アイテム', $testUser, $testUser, $today, $metaJson, $now, $now, $now]);

function r105_makeController($pdo, $userId) {
    return new class($pdo, $userId) extends CalendarController {
        public function __construct($pdo, $userId) {
            $this->pdo = $pdo;
            $this->currentUserId = $userId;
            $this->currentTenantId = null;
            $this->joinedTenants = [];
            $this->currentUser = ['sub' => $userId, 'role' => 'owner'];
        }
        protected function authenticate() {}
        protected function sendError($code, $msg) { throw new Exception("ERROR $code: $msg"); }
    };
}

function r105_captureJson($controller, $method, $params) {
    ob_start();
    $controller->$method($params);
    return json_decode(ob_get_clean(), true);
}

function r105_findById($items, $id) {
    foreach ($items as $item) {
        if (($item['id'] ?? null) === $id) return $item;
    }
    return null;
}

$passed = 0;
$failed = 0;

function assertEq($label, $actual, $expected) {
    global $passed, $failed;
    if ($actual === $expected) {
        echo "  OK PASS: $label\n";
        $passed++;
    } else {
        echo "  NG FAIL: $label\n";
        echo "    expected: " . var_export($expected, true) . "\n";
        echo "    actual  : " . var_export($actual, true) . "\n";
        $failed++;
    }
}

echo "=== R-105: カレンダー系エンドポイントの meta 露出テスト ===\n\n";

$controller = r105_makeController($pdo, $testUser);
$expectedMeta = ['gantt_time_blocks' => [$today => 480]];
$range = ['start_date' => $today, 'end_date' => $today];

echo "[1] getItems (mode=gantt)\n";
$ganttItems = r105_captureJson($controller, 'getItems', $range + ['mode' => 'gantt']);
$item = r105_findById($ganttItems, 'r105_with_meta');
assertEq('gantt モードで meta.gantt_time_blocks が返る', $item['meta'] ?? null, $expectedMeta);

echo "\n[2] getItems (mode=range)\n";
$rangeItems = r105_captureJson($controller, 'getItems', $range);
$item = r105_findById($rangeItems, 'r105_with_meta');
assertEq('range モードで meta.gantt_time_blocks が返る', $item['meta'] ?? null, $expectedMeta);

echo "\n[3] getLoad\n";
$loadItems = $controller->getLoad(['year' => intval(date('Y')), 'month' => intval(date('n'))]);
$item = r105_findById($loadItems, 'r105_with_meta');
assertEq('getLoad で meta.gantt_time_blocks が返る', $item['meta'] ?? null, $expectedMeta);

echo "\n[4] getCompletedItems\n";
$completedItems = r105_captureJson($controller, 'getCompletedItems', $range);
$item = r105_findById($completedItems, 'r105_completed');
assertEq('getCompletedItems で meta.gantt_time_blocks が返る', $item['meta'] ?? null, $expectedMeta);

echo "\n[5] 後方互換: meta が NULL のアイテム\n";
$item = r105_findById($ganttItems, 'r105_no_meta');
assertEq('meta 未設定アイテムは meta === null', array_key_exists('meta', $item) ? $item['meta'] : 'MISSING', null);

$pdo->exec("DELETE FROM items WHERE id LIKE 'r105_%'");
$pdo->prepare("DELETE FROM users WHERE id = ?")->execute([$testUser]);
unset($pdo);
@unlink($tmpDb);

echo "\n=== 結果: $passed passed, $failed failed ===\n";
exit($failed > 0 ? 1 : 0);
