<?php
require_once 'db.php';
$id = 'item_697f37ef1a9fb';
$db = getDB();
echo "Checking ID: $id\n";

// 1. Exact match
$stmt = $db->prepare("SELECT id, title, tenant_id FROM items WHERE id = ?");
$stmt->execute([$id]);
$item = $stmt->fetch(PDO::FETCH_ASSOC);

if ($item) {
    echo "EXACT MATCH FOUND: " . json_encode($item) . "\n";
} else {
    echo "EXACT MATCH NOT FOUND. Checking without prefix...\n";
    // 2. Try without 'item_' prefix
    $id_raw = str_replace('item_', '', $id);
    $stmt->execute([$id_raw]);
    $item = $stmt->fetch(PDO::FETCH_ASSOC);
    if ($item) {
        echo "MATCH WITHOUT PREFIX FOUND: " . json_encode($item) . "\n";
    } else {
        echo "STILL NOT FOUND: $id_raw\n";
    }
}

// 3. List recent items to see ID format
echo "\nRecent items ID format sample:\n";
$stmt = $db->query("SELECT id, title FROM items ORDER BY created_at DESC LIMIT 5");
while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
    echo "ID: " . $row['id'] . " | Title: " . $row['title'] . "\n";
}
