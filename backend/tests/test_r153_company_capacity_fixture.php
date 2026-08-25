<?php
// R-153 (h): 会社日次キャパ算出（memberships.is_core=1 の合計）が
// フロント QuantityEngine のテナント集計と同一であることを、
// 共有フィクスチャ fixtures/company_capacity_cases.json（TS側 companyCapacity.fixture.test.ts と同じファイル）で検証する。
// 定義を変えるときはフィクスチャを先に変える。
require_once __DIR__ . '/../services/BeaverCapacityService.php';

$fixture = json_decode(file_get_contents(__DIR__ . '/fixtures/company_capacity_cases.json'), true);

// フィクスチャはフロント形（camelCase）。PHP側はDB行相当（snake_case＋capacity_profile配列）へ変換する
$members = array_map(fn($m) => [
    'user_id' => $m['userId'],
    'is_core' => $m['isCore'] ? 1 : 0,
    'daily_capacity_minutes' => $m['dailyCapacityMinutes'],
    'capacity_profile' => $m['capacityProfile'],
], $fixture['members']);

$config = [
    'default_daily_minutes' => $fixture['capacity_config']['defaultDailyMinutes'],
    'holidays' => $fixture['capacity_config']['holidays'],
    'exceptions' => $fixture['capacity_config']['exceptions'],
    'standard_weekly_pattern' => $fixture['capacity_config']['standardWeeklyPattern'] ?? null,
];

$passed = 0;
$failed = 0;
foreach ($fixture['cases'] as $case) {
    $actual = BeaverCapacityService::calcCompanyDailyCapacity(
        new DateTime($case['date'], new DateTimeZone('Asia/Tokyo')),
        $members,
        $config,
        $fixture['tenant_id']
    );
    if ($actual === $case['expected_minutes']) {
        echo "[PASS] {$case['name']}\n";
        $passed++;
    } else {
        echo "[FAIL] {$case['name']}\n  expected: {$case['expected_minutes']}\n  actual:   {$actual}\n";
        $failed++;
    }
}

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
