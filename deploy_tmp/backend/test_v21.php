<?php
// Test script to verify is_project functionality
require_once __DIR__ . '/db.php';

$pdo = getDB();

echo "=== V21 Migration Verification ===\n\n";

// 1. Check items table schema
echo "1. Items table columns with is_project:\n";
$stmt = $pdo->query("PRAGMA table_info(items)");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    if (strpos($row['name'], 'project') !== false || strpos($row['name'], 'parent') !== false) {
        echo "   - {$row['name']}: {$row['type']} (default: {$row['dflt_value']})\n";
    }
}

// 2. Check if projects table still exists
echo "\n2. Projects table exists: ";
$result = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name='projects'")->fetchColumn();
echo ($result ? "YES (ERROR - should be dropped!)" : "NO (CORRECT)") . "\n";

// 3. Count items with is_project = 1
echo "\n3. Items with is_project = 1: ";
$count = $pdo->query("SELECT COUNT(*) FROM items WHERE is_project = 1")->fetchColumn();
echo "$count\n";

// 4. Check indexes
echo "\n4. Indexes on items table:\n";
$stmt = $pdo->query("PRAGMA index_list(items)");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "   - {$row['name']}\n";
}

echo "\n=== Verification Complete ===\n";
