<?php
/**
 * テスト: projectTitle フォールバックロジック
 *
 * 問題: project_id が NULL のアイテムでも parent_title が
 * projectTitle として返される（BaseController::mapItemRow 142行目）
 *
 * 期待: project_id が NULL/空の場合、projectTitle は NULL になるべき
 */

require_once __DIR__ . '/../BaseController.php';

class TestableBaseController extends BaseController {
    public function __construct() {
        // DB接続不要（mapItemRowのテストのみ）
    }

    public function testMapItemRow($item) {
        return $this->mapItemRow($item);
    }
}

$controller = new TestableBaseController();
$passed = 0;
$failed = 0;

function assertTest($name, $actual, $expected) {
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

// テスト1: project_id あり + real_project_title あり → projectTitle = real_project_title
$item1 = [
    'id' => 'item-1',
    'title' => 'タスクA',
    'project_id' => 'proj-001',
    'parent_id' => 'proj-001',
    'real_project_title' => '総会',
    'parent_title' => '総会',
    'status' => 'inbox',
    'interrupt' => 0,
    'is_boosted' => 0,
    'is_project' => 0,
    'is_intent' => 0,
    'is_archived' => 0,
    'estimated_minutes' => 30,
    'focus_order' => 0,
    'due_status' => null,
    'project_type' => null,
    'project_category' => null,
    'client_name' => null,
    'site_name' => null,
    'gross_profit_target' => 0,
    'assignee_name' => null,
    'assignee_color' => null,
    'deleted_at' => null,
    'prep_date' => null,
    'work_days' => 1,
    'delegation' => null,
    'tenant_id' => 't1',
    'assigned_to' => null,
    'created_by' => null,
];
$result1 = $controller->testMapItemRow($item1);
assertTest(
    'project_id あり + real_project_title あり → projectTitle = real_project_title',
    $result1['projectTitle'],
    '総会'
);

// テスト2: project_id が NULL + parent_title あり → projectTitle は NULL であるべき
$item2 = $item1;
$item2['id'] = 'item-2';
$item2['project_id'] = null;
$item2['real_project_title'] = null;
$item2['parent_id'] = 'some-parent';
$item2['parent_title'] = '親タスク名';
$result2 = $controller->testMapItemRow($item2);
assertTest(
    'project_id が NULL + parent_title あり → projectTitle は NULL',
    $result2['projectTitle'],
    null
);

// テスト3: project_id が NULL + parent_title が NULL → projectTitle は NULL
$item3 = $item2;
$item3['id'] = 'item-3';
$item3['parent_title'] = null;
$result3 = $controller->testMapItemRow($item3);
assertTest(
    'project_id が NULL + parent_title が NULL → projectTitle は NULL',
    $result3['projectTitle'],
    null
);

// テスト4: project_id が空文字 + parent_title あり → projectTitle は NULL
$item4 = $item2;
$item4['id'] = 'item-4';
$item4['project_id'] = '';
$item4['parent_title'] = '親タスク名';
$result4 = $controller->testMapItemRow($item4);
assertTest(
    'project_id が空文字 + parent_title あり → projectTitle は NULL',
    $result4['projectTitle'],
    null
);

// テスト5: project_id あり + real_project_title が NULL → projectTitle は NULL
// （project_idはあるがJOIN結果がない異常ケース。parent_titleにフォールバックしない）
$item5 = $item1;
$item5['id'] = 'item-5';
$item5['project_id'] = 'proj-999';
$item5['real_project_title'] = null;
$item5['parent_title'] = '親タスク名';
$result5 = $controller->testMapItemRow($item5);
assertTest(
    'project_id あり + real_project_title が NULL → projectTitle は NULL（parent_titleにフォールバックしない）',
    $result5['projectTitle'],
    null
);

// テスト6: parentTitle フィールドが別途返されること
assertTest(
    'parentTitle フィールドが parent_title の値を持つ',
    $result2['parentTitle'] ?? 'NOT_SET',
    '親タスク名'
);

echo "\n--- 結果: $passed passed, $failed failed ---\n";
exit($failed > 0 ? 1 : 0);
