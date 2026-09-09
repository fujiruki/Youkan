<?php
/** R-0162: generated_task_role のAPIマッピング回帰。 */
$tmpDb = sys_get_temp_dir() . '/youkan_r0162_mapping_' . getmypid() . '.sqlite';
@unlink($tmpDb);
putenv('YOUKAN_DB_PATH=' . $tmpDb);

require_once __DIR__ . '/../BaseController.php';

$controller = new class extends BaseController {
    public function mapForTest(array $row): array {
        return $this->mapItemRow($row);
    }
};

$base = [
    'id' => 'item-1', 'title' => '請求', 'status' => 'pending',
    'created_at' => 0, 'updated_at' => 0, 'created_by' => null,
];
$generated = $controller->mapForTest($base + ['generated_task_role' => 'invoice']);
$ordinary = $controller->mapForTest($base);

$passed = 0;
$failed = 0;
function assert_r0162(string $label, bool $condition): void {
    global $passed, $failed;
    if ($condition) { echo "  ✓ PASS: $label\n"; $passed++; }
    else { echo "  ✗ FAIL: $label\n"; $failed++; }
}

assert_r0162('生成タスクはgeneratedTaskRoleを返す', ($generated['generatedTaskRole'] ?? null) === 'invoice');
assert_r0162('通常タスクはgeneratedTaskRole=nullを返す', array_key_exists('generatedTaskRole', $ordinary) && $ordinary['generatedTaskRole'] === null);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
@unlink($tmpDb);
exit($failed > 0 ? 1 : 0);
