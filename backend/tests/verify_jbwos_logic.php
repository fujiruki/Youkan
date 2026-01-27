<?php
// backend/tests/verify_jbwos_logic.php
require_once __DIR__ . '/../db.php';
require_once __DIR__ . '/../ItemController.php';
require_once __DIR__ . '/../UserController.php';

// Mock Environment for Testing
$_SESSION['user_id'] = 'test_user_jbwos'; // Create or use a test user
$_SESSION['tenant_id'] = 'test_tenant';
$_SESSION['role'] = 'admin';

$pdo = getDB();

// Setup Test User
$pdo->prepare("INSERT OR IGNORE INTO users (id, email, password_hash, display_name) VALUES (?, ?, ?, ?)")
    ->execute(['test_user_jbwos', 'test@example.com', 'hash', 'JBWOS Tester']);
$pdo->prepare("INSERT OR IGNORE INTO tenants (id, name) VALUES (?, ?)")
    ->execute(['test_tenant', 'Test Tenant']);
$pdo->prepare("INSERT OR IGNORE INTO memberships (tenant_id, user_id, role) VALUES (?, ?, ?)")
    ->execute(['test_tenant', 'test_user_jbwos', 'owner']);

echo "--- Starting JBWOS Logic Verification ---\n";

// Helper to simulate request
function simulateRequest($controller, $method, $data = [], $params = []) {
    // Hacky mocking of input
    $_SERVER['REQUEST_METHOD'] = $method;
    $_GET = $params;
    
    // Capture output
    ob_start();
    // Inject data via a reflection or just assume Controller reads php://input (which we can't easily mock without file writing)
    // Actually, BaseController::getInput() reads json_decode(file_get_contents('php://input'), true);
    // So we need to override `getInput` or use a subclass, OR just mock the controller method directly?
    // Let's use a subclass for testing.
}

class TestItemController extends ItemController {
    private $mockInput;
    public function setMockInput($data) { $this->mockInput = $data; }
    protected function getInput() { return $this->mockInput ?? []; }
    // Use Reflection to call private/protected methods
    private function callParent($method) {
        $reflection = new ReflectionMethod('ItemController', $method);
        $reflection->setAccessible(true);
        return $reflection->invoke($this);
    }
    // Override to prevent exit()
    protected function sendJSON($data) { echo json_encode($data); }
    protected function sendError($code, $msg) { echo "ERROR $code: $msg"; }
    
    public function publicCreate() { $this->callParent('create'); }
    public function publicUpdate($id) { $this->callParent('update'); } // Update takes arg? No, update($id)
    // Wait, update($id) is defined as private function update($id). 
    // Reflection invocation needs args.
    public function invokeUpdate($id) {
        $reflection = new ReflectionMethod('ItemController', 'update');
        $reflection->setAccessible(true);
        return $reflection->invoke($this, $id);
    }
    public function publicReorder() { $this->callParent('reorderFocus'); }
}

class TestUserController extends UserController {
    private $mockInput;
    public function setMockInput($data) { $this->mockInput = $data; }
    protected function getInput() { return $this->mockInput ?? []; }
    // Override to prevent exit()
    protected function sendJSON($data) { echo json_encode($data); }
    protected function sendError($code, $msg) { echo "ERROR $code: $msg"; }

    private function callParent($method) {
        $reflection = new ReflectionMethod('UserController', $method);
        $reflection->setAccessible(true);
        return $reflection->invoke($this);
    }

    public function publicUpdateProfile() { $this->callParent('updateProfile'); }
}

$ic = new TestItemController($pdo);
$uc = new TestUserController($pdo);

// Inject User Context (Bypassing Authenticate)
$refClass = new ReflectionClass('BaseController');
$propTenant = $refClass->getProperty('currentTenantId');
$propTenant->setAccessible(true);
$propTenant->setValue($ic, 'test_tenant');
$propTenant->setValue($uc, 'test_tenant');

$propUser = $refClass->getProperty('currentUserId');
$propUser->setAccessible(true);
$propUser->setValue($ic, 'test_user_jbwos');
$propUser->setValue($uc, 'test_user_jbwos');
$propJoined = $refClass->getProperty('joinedTenants');
$propJoined->setAccessible(true);
$propJoined->setValue($ic, ['test_tenant']);
$propJoined->setValue($uc, ['test_tenant']);

// 1. Create Items
echo "1. Creating Test Items...\n";
$ids = [];
for ($i=1; $i<=3; $i++) {
    $id = "jbwos_item_$i";
    $ic->setMockInput([
        'id' => $id,
        'title' => "Task $i",
        'status' => 'inbox',
        'focusOrder' => 0,
        'dueStatus' => 'future'
    ]);
    ob_start();
    $ic->publicCreate();
    $out = ob_get_clean();
    $ids[] = $id;
    echo "  Created $id: " . (strpos($out, 'success') ? "OK" : "FAIL $out") . "\n";
}

// 2. Test reorderFocus
echo "2. Testing reorderFocus...\n";
$ic->setMockInput([
    'items' => [
        ['id' => $ids[0], 'order' => 10],
        ['id' => $ids[1], 'order' => 20],
        ['id' => $ids[2], 'order' => 30]
    ]
]);
// Simulate param action=reorder_focus handled in main loop, but here calling direct method
ob_start();
$ic->publicReorder();
$out = ob_get_clean();
echo "  Reorder: " . (strpos($out, 'success') ? "OK" : "FAIL $out") . "\n";

// Verify DB
$stmt = $pdo->prepare("SELECT id, focus_order FROM items WHERE id IN (?, ?, ?) ORDER BY focus_order ASC");
$stmt->execute($ids);
$res = $stmt->fetchAll(PDO::FETCH_ASSOC);
foreach ($res as $r) {
    echo "  Item {$r['id']} Order: {$r['focus_order']}\n";
}

// 3. Test Intent & Due Status Update (Fix for 500 Error)
echo "3. Testing Intent & DueStatus Update...\n";
$target = $ids[0];
$ic->setMockInput([
    'isIntent' => true,
    'dueStatus' => 'today',
    'status' => 'focus'
]);
ob_start();
$ic->invokeUpdate($target);
$out = ob_get_clean();
echo "  Update $target: " . (strpos($out, 'success') ? "OK" : "FAIL $out") . "\n";

$check = $pdo->query("SELECT is_intent, due_status FROM items WHERE id='$target'")->fetch();
echo "  Check: is_intent={$check['is_intent']}, due_status={$check['due_status']}\n";

// 4. Test Active Task Pointer
echo "4. Testing Active Task Pointer...\n";
$uc->setMockInput([
    'activeTaskId' => $ids[1]
]);
ob_start();
$uc->publicUpdateProfile();
$out = ob_get_clean();
echo "  Update Profile: " . (strpos($out, 'success') ? "OK" : "FAIL $out") . "\n";

$uCheck = $pdo->query("SELECT active_task_id FROM users WHERE id='test_user_jbwos'")->fetch();
echo "  Active Task ID: {$uCheck['active_task_id']}\n";


echo "\n--- Verification Complete ---\n";
