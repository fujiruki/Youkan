<?php
// backend/tests/test_review_queue_service.php
// R-140: ReviewQueueService::build が TS logic/reviewQueue.ts の buildReviewQueue と同一定義であることを、
// 共有フィクスチャ fixtures/review_queue_cases.json（TS 側 reviewQueue.fixture.test.ts と同じファイル）で検証する。
require_once __DIR__ . '/../ReviewQueueService.php';

$fixture = json_decode(file_get_contents(__DIR__ . '/fixtures/review_queue_cases.json'), true);

$passed = 0;
$failed = 0;
foreach ($fixture['cases'] as $case) {
    $actual = array_values(array_map(fn($i) => $i['id'], ReviewQueueService::build($case['items'], $case['today'])));
    if ($actual === $case['expected_ids']) {
        echo "[PASS] {$case['name']}\n";
        $passed++;
    } else {
        echo "[FAIL] {$case['name']}\n  expected: " . json_encode($case['expected_ids'], JSON_UNESCAPED_UNICODE) . "\n  actual:   " . json_encode($actual, JSON_UNESCAPED_UNICODE) . "\n";
        $failed++;
    }
}

// 空入力
$empty = ReviewQueueService::build([], '2026-08-18');
if ($empty === []) { echo "[PASS] 空入力は空配列\n"; $passed++; } else { echo "[FAIL] 空入力は空配列\n"; $failed++; }

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
