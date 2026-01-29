<?php
// backend/tests/ManufacturingIntegrationTest.php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../Constants.php';

// Mocking authenticate for test
function run_mfg_test() {
    echo "--- Starting Manufacturing Integration TDD Test ---\n";
    $pdo = getDB();

    // 1. Preparation: Clean up test data
    $testTitle = 'TDD Test fabrication Item';
    $pdo->exec("DELETE FROM items WHERE title = '$testTitle'");
    
    // 2. Mocking Request to ManufacturingController (to be created)
    echo "Test Case 1: Create Fabrication Item\n";
    
    // For now, let's assume we have a service or controller method
    // In TDD, we call the code that doesn't exist yet.
    
    // Since we don't have the controller yet, let's define what we expect.
    $itemId = 'test_item_' . uniqid();
    $data = [
        'id' => $itemId,
        'title' => $testTitle,
        'category' => ManufacturingCategory::FABRICATION,
        'fab_minutes' => 120,
        'site_minutes' => 60,
        'labor_rate' => 5000,
        'tenant_id' => 't_default',
        'created_by' => 'u_default'
    ];

    // Act (Calling the service)
    require_once __DIR__ . '/../ManufacturingSyncService.php';
    ManufacturingSyncService::syncItem($pdo, $itemId, $data);

    echo "Verifying results...\n";
    
    // Check results
    $stmt = $pdo->prepare("SELECT * FROM manufacturing_items WHERE item_id = ?");
    $stmt->execute([$itemId]);
    $mfg = $stmt->fetch();
    
    if (!$mfg) {
        echo "[FAIL] manufacturing_items entry not found.\n";
    } else {
        echo "[SUCCESS] manufacturing_items entry created.\n";
    }
    
    // Check for auto-generated task
    $stmt = $pdo->prepare("SELECT * FROM items WHERE parent_id = ? AND title LIKE '%製作%'");
    $stmt->execute([$itemId]);
    $task = $stmt->fetch();
    
    if (!$task) {
        echo "[FAIL] Auto-generated production task not found.\n";
    } else {
        echo "[SUCCESS] Auto-generated task: " . $task['title'] . "\n";
    }
}

run_mfg_test();
