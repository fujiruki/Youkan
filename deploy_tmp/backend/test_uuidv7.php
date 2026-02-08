<?php
/**
 * UUID v7 Unit Test
 * 
 * テスト項目:
 * 1. UUID v7 の形式が正しいか
 * 2. 生成された UUID が時間順にソート可能か
 * 3. バリデーション関数が正しく動作するか
 */

require_once __DIR__ . '/Uuidv7.php';

function test_uuid_format() {
    $uuid = Uuidv7::generate();
    
    // Basic format check
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $uuid)) {
        echo "FAIL: UUID format is invalid: $uuid\n";
        return false;
    }
    
    // Version check (7th character of 3rd group should be '7')
    $parts = explode('-', $uuid);
    if ($parts[2][0] !== '7') {
        echo "FAIL: UUID version is not 7: $uuid\n";
        return false;
    }
    
    // Variant check (1st character of 4th group should be 8, 9, a, or b)
    if (!in_array($parts[3][0], ['8', '9', 'a', 'b'])) {
        echo "FAIL: UUID variant is incorrect: $uuid\n";
        return false;
    }
    
    echo "PASS: UUID format test - $uuid\n";
    return true;
}

function test_uuid_sorting() {
    $uuids = [];
    
    // Generate UUIDs with small delays
    for ($i = 0; $i < 5; $i++) {
        $uuids[] = Uuidv7::generate();
        usleep(10000); // 10ms delay
    }
    
    // UUIDs should already be in ascending order (because they are time-based)
    $sorted = $uuids;
    sort($sorted); // Lexicographical sort should maintain time order
    
    if ($uuids === $sorted) {
        echo "PASS: UUID sorting test - UUIDs are naturally sortable\n";
        foreach ($uuids as $uuid) {
            echo "  - $uuid (ts: " . Uuidv7::extractTimestamp($uuid) . ")\n";
        }
        return true;
    } else {
        echo "FAIL: UUID sorting test\n";
        echo "Original: " . implode(', ', $uuids) . "\n";
        echo "Sorted:   " . implode(', ', $sorted) . "\n";
        return false;
    }
}

function test_uuid_validation() {
    $valid = Uuidv7::generate();
    $invalid = 'not-a-uuid';
    $wrongVersion = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'; // v4 format placeholder
    
    $results = [];
    
    if (Uuidv7::isValid($valid)) {
        echo "PASS: Valid UUID recognized\n";
        $results[] = true;
    } else {
        echo "FAIL: Valid UUID not recognized: $valid\n";
        $results[] = false;
    }
    
    if (!Uuidv7::isValid($invalid)) {
        echo "PASS: Invalid string rejected\n";
        $results[] = true;
    } else {
        echo "FAIL: Invalid string accepted\n";
        $results[] = false;
    }
    
    return !in_array(false, $results);
}

// Run tests
echo "=== UUID v7 Unit Tests ===\n\n";

$allPassed = true;
$allPassed = test_uuid_format() && $allPassed;
$allPassed = test_uuid_sorting() && $allPassed;
$allPassed = test_uuid_validation() && $allPassed;

echo "\n";
if ($allPassed) {
    echo "✅ All tests passed!\n";
    exit(0);
} else {
    echo "❌ Some tests failed.\n";
    exit(1);
}
