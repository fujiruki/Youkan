<?php
/**
 * R-065-Y2 テスト: CalendarController のルーティングがクエリ文字列付き URI でも正しく動作すること
 *
 * テストケース:
 * 1. /calendar/completed（クエリなし）→ getCompletedItems に振り分けられる
 * 2. /calendar/completed?start_date=...（クエリあり）→ getCompletedItems に振り分けられる
 * 3. /calendar/items（クエリなし）→ getItems に振り分けられる
 * 4. /calendar/items?start_date=...（クエリあり）→ getItems に振り分けられる
 * 5. /calendar?year=2026&month=6（getLoad パス）→ getLoad に振り分けられる
 */

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

/**
 * REQUEST_URI からルートを判定するロジックを抽出してテスト
 * CalendarController::handleRequest() と同一のロジック
 */
function resolveCalendarRoute($requestUri) {
    $path = parse_url($requestUri, PHP_URL_PATH);
    if (preg_match('#/completed$#', $path)) {
        return 'getCompletedItems';
    } elseif (preg_match('#/items$#', $path)) {
        return 'getItems';
    } else {
        return 'getLoad';
    }
}

echo "=== R-065-Y2: カレンダールーティング（クエリ文字列対応）テスト ===\n\n";

// テスト1: /calendar/completed（クエリなし）
assertEq(
    '/calendar/completed はクエリなしで getCompletedItems',
    resolveCalendarRoute('/contents/Youkan/backend/index.php/calendar/completed'),
    'getCompletedItems'
);

// テスト2: /calendar/completed?start_date=...（クエリあり）← バグの根本原因
assertEq(
    '/calendar/completed?start_date=...&end_date=... はクエリありでも getCompletedItems',
    resolveCalendarRoute('/contents/Youkan/backend/index.php/calendar/completed?start_date=2026-06-01&end_date=2026-06-30'),
    'getCompletedItems'
);

// テスト3: /calendar/items（クエリなし）
assertEq(
    '/calendar/items はクエリなしで getItems',
    resolveCalendarRoute('/contents/Youkan/backend/index.php/calendar/items'),
    'getItems'
);

// テスト4: /calendar/items?start_date=...（クエリあり）← バグの根本原因
assertEq(
    '/calendar/items?start_date=...&end_date=... はクエリありでも getItems',
    resolveCalendarRoute('/contents/Youkan/backend/index.php/calendar/items?start_date=2026-06-01&end_date=2026-06-30'),
    'getItems'
);

// テスト5: /calendar?year=2026&month=6（getLoad パス）
assertEq(
    '/calendar?year=2026&month=6 は getLoad',
    resolveCalendarRoute('/contents/Youkan/backend/index.php/calendar?year=2026&month=6'),
    'getLoad'
);

// テスト6: 開発環境のローカルパス形式でも動作する
assertEq(
    'ローカル開発環境パスでも /calendar/completed?query が getCompletedItems',
    resolveCalendarRoute('/calendar/completed?start_date=2026-06-01&end_date=2026-06-30'),
    'getCompletedItems'
);

// テスト7: 無効なサブパス（例: /calendar/zzz?x=1）は getLoad にフォールスルー
assertEq(
    '無効サブパス /calendar/zzz?x=1 は getLoad にフォールスルー',
    resolveCalendarRoute('/contents/Youkan/backend/index.php/calendar/zzz?x=1'),
    'getLoad'
);

echo "\n=== 結果: {$passed} passed, {$failed} failed ===\n";
exit($failed > 0 ? 1 : 0);
