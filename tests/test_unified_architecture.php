<?php
// tests/test_unified_architecture.php
require_once 'backend/db.php';
require_once 'backend/ProjectController.php'; // Will be refactored
require_once 'backend/ItemController.php';

echo "=== TDD: Unified Item Architecture ===\n";

// Mock Auth
$testUserId = 'u_test_' . uniqid();
$testTenantId = 't_test_' . uniqid();

// We need to inject these into Controllers or mock the BaseController context
// For this simple script, we assume Controllers can be instantiated and we can force context if we modify them, 
// OR we rely on a test helper in BaseController (which we added: 'mock-debug-token').

// However, to strictly test the CONTROLLER logic, we might need to subclass or use a "TestContext".
// Let's assume we can modify BaseController to accept injected context for testing, 
// or simpler: Just direct DB verification after calling methods.

// 1. Setup DB
$pdo = getDB();

try {
    // 2. Test Concept: Create a Project (should be in ITEMS table)
    echo "[Test 1] Creating Project (should act as Item)...\n";
    
    // Simulate API Input for Project
    // We can't easily mock php://input for Controller without a wrapper.
    // So we'll test the Logic directly if possible, or use a helper that doesn't rely on `getInput()`.
    // Actually, `ProjectController::create()` is private and called by handleRequest.
    // We should refactor Controllers to have public `createProject()` methods for testability?
    // OR, we write the logic in a Service class. 
    // JBWOS architecture uses Controllers as Logic holders commonly (Simple).
    
    // Plan B: Direct DB Insertion utilizing the Intended Logic to verify Schema.
    // If we migrate `projects` to `items`, we verify that we can insert a project into `items`.
    
    $projectId = 'prj_' . uniqid();
    $title = "TDD Project " . rand(100,999);
    
    // We expect this to fail if columns don't exist yet
    $stmt = $pdo->prepare("
        INSERT INTO items (id, title, project_type, status, tenant_id, created_at, updated_at)
        VALUES (?, ?, 'general', 'inbox', ?, ?, ?)
    ");
    
    $stmt->execute([$projectId, $title, $testTenantId, time(), time()]);
    echo "  -> Inserted Project into Items (Manual SQL).\n";
    
    // Verify it's in items
    $check = $pdo->query("SELECT * FROM items WHERE id = '$projectId'")->fetch(PDO::FETCH_ASSOC);
    if ($check && $check['id'] === $projectId && $check['project_type'] === 'general') {
        echo "  -> PASS: Project exists in items table with project_type.\n";
    } else {
        echo "  -> FAIL: Could not verify project in items table.\n";
    }
    
    // 3. Test Concept: Create a Task under Project
    echo "[Test 2] Creating Task under Project...\n";
    $taskId = 'task_' . uniqid();
    $stmt = $pdo->prepare("
        INSERT INTO items (id, title, parent_id, status, tenant_id, created_at, updated_at)
        VALUES (?, 'Child Task', ?, 'inbox', ?, ?, ?)
    ");
    $stmt->execute([$taskId, $projectId, $testTenantId, time(), time()]);
    
    $checkChild = $pdo->query("SELECT * FROM items WHERE id = '$taskId'")->fetch(PDO::FETCH_ASSOC);
    if ($checkChild && $checkChild['parent_id'] === $projectId) {
         echo "  -> PASS: Child task linked to project (Item-to-Item).\n";
    } else {
         echo "  -> FAIL: Child task linkage failed.\n";
    }

    // 4. Test Concept: Load Calculation (Load Calendar)
    // This logic enters `CalendarController`.
    echo "[Test 3] Testing Load Calculation Logic (Mock)...\n";
    // Add estimated time
    $pdo->exec("UPDATE items SET estimated_minutes = 60 WHERE id = '$taskId'");
    
    // Query sum
    $sqlLoad = "
        SELECT SUM(estimated_minutes) as load 
        FROM items 
        WHERE (parent_id = '$projectId' OR id = '$projectId')
    ";
    $load = $pdo->query($sqlLoad)->fetchColumn();
    if ($load == 60) {
        echo "  -> PASS: Load calculated correctly from unified items.\n";
    } else {
        echo "  -> FAIL: Load calculation wrong ($load != 60).\n";
    }

} catch (Exception $e) {
    echo "  -> ERROR: " . $e->getMessage() . "\n";
    if (strpos($e->getMessage(), 'no such column') !== false) {
        echo "     (Expected Failure before Migration: Columns missing)\n";
    }
}
