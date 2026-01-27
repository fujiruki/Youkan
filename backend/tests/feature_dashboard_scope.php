<?php
// backend/tests/feature_dashboard_scope.php
// TDD Script for JBWOS Reborn - Dashboard Aggregation Logic
// Goal: Ensure 'scope=dashboard' returns Personal + Assigned Company Items

require_once __DIR__ . '/../db.php'; // Assuming db.php is in backend root based on previous context
require_once __DIR__ . '/../ItemController.php';

// Mock Environment
$_SESSION['user_id'] = 'user_tdd_001';
// We simulate no specific tenant context to test aggregation, 
// OR a specific context to test if it still fetches mixed data.
// Let's assume the Dashboard is accessed with a "Primary" context or None.
$_SESSION['tenant_id'] = 'tenant_tdd_A'; 

echo "--- Setting up Test Data ---\n";

$pdo = getDB();
echo "DB Connected.\n";
$tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table'")->fetchAll(PDO::FETCH_COLUMN);
echo "Tables: " . implode(', ', $tables) . "\n";


// Cleanup
/*
$pdo->exec("DELETE FROM items WHERE created_by = 'user_tdd_001'");
$pdo->exec("DELETE FROM tenants WHERE id IN ('tenant_tdd_A', 'tenant_tdd_B')");
$pdo->exec("DELETE FROM users WHERE id = 'user_tdd_001'");
$pdo->exec("DELETE FROM memberships WHERE user_id = 'user_tdd_001'");
*/

// 1. Create User
$pdo->exec("INSERT INTO users (id, display_name, email, password_hash) VALUES ('user_tdd_001', 'TDD User', 'tdd@example.com', 'hash')");

// 2. Create Tenants
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('tenant_tdd_A', 'Company A', " . time() . ")");
$pdo->exec("INSERT INTO tenants (id, name, created_at) VALUES ('tenant_tdd_B', 'Company B', " . time() . ")");

// 3. Memberships
$pdo->exec("INSERT INTO memberships (tenant_id, user_id, role) VALUES ('tenant_tdd_A', 'user_tdd_001', 'admin')");
$pdo->exec("INSERT INTO memberships (tenant_id, user_id, role) VALUES ('tenant_tdd_B', 'user_tdd_001', 'member')");

// 4. Create Items
// Item 1: Personal (No Tenant), Focus
// Item 1: Personal (No Tenant/Empty), Focus
$pdo->prepare("INSERT INTO items (id, title, status, created_by, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    ->execute(['item_personal_1', 'Personal Focus Task', 'focus', 'user_tdd_001', '', time(), time()]);

try {
    $params = ['item_compA_1', 'Company A Focus Task', 'focus', 'user_tdd_001', 'tenant_tdd_A', 'user_tdd_001', time(), time()];
    echo "Inserting Item 2 Params: " . json_encode($params) . "\n";
    $pdo->prepare("INSERT INTO items (id, title, status, created_by, tenant_id, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        ->execute($params);
    echo "Item 2 Inserted.\n";
} catch (PDOException $e) {
    echo "Insert Item 2 Failed: " . $e->getMessage() . "\n";
    exit(1);
}

// Item 3: Company B (Other Context), Focus, Assigned to Me
$pdo->prepare("INSERT INTO items (id, title, status, created_by, tenant_id, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    ->execute(['item_compB_1', 'Company B Focus Task', 'focus', 'other_user', 'tenant_tdd_B', 'user_tdd_001', time(), time()]);

// Item 4: Company B, Focus, NOT Assigned to Me (Should NOT appear)
$pdo->prepare("INSERT INTO items (id, title, status, created_by, tenant_id, assigned_to, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    ->execute(['item_compB_noise', 'Company B Other Task', 'focus', 'other_user', 'tenant_tdd_B', 'other_user', time(), time()]);

// Item 5: Inbox (Personal) - Should appear if we fetch 'all' or specific status
$pdo->prepare("INSERT INTO items (id, title, status, created_by, tenant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    ->execute(['item_personal_inbox', 'Personal Inbox Task', 'inbox', 'user_tdd_001', '', time(), time()]);


// Mock Controller to bypass JWT Authentication
class TestItemController extends ItemController {
    public function authenticate() {
        // Mock Auth based on Session
        $this->currentUserId = $_SESSION['user_id'];
        $this->currentTenantId = $_SESSION['tenant_id'];
        
        // Mock Joined Tenants (Logic from BaseController, slightly simplified)
        if ($this->currentUserId) {
             $stmt = $this->pdo->prepare("SELECT tenant_id FROM memberships WHERE user_id = ?");
             $stmt->execute([$this->currentUserId]);
             $this->joinedTenants = $stmt->fetchAll(PDO::FETCH_COLUMN);
        }
    }
}

echo "--- Executing ItemController::handleRequest(GET, scope=dashboard) ---\n";

// Mock GET parameters
$_GET['scope'] = 'dashboard';
// Note: We need to verify if 'dashboard' scope filters by status or returns everything for the frontend to filter.
// The Plan says: "ViewModel filters by status". So Controller should return ALL statuses (Focus, Inbox, Pending...).
// But it should NOT return Company B's unrelated items.

// Capture Output
ob_start();
$controller = new TestItemController();
$controller->handleRequest('GET');
$output = ob_get_clean();

$response = json_decode($output, true);

if (json_last_error() !== JSON_ERROR_NONE) {
    echo "FAILED: Invalid JSON Response: $output\n";
    exit(1);
}

echo "Response Count: " . count($response) . "\n";

// Verification
$foundIds = array_column($response, 'id');
$expectedIds = ['item_personal_1', 'item_compA_1', 'item_compB_1', 'item_personal_inbox'];
$missing = array_diff($expectedIds, $foundIds);
$unexpected = array_diff($foundIds, $expectedIds);

if (empty($missing) && !in_array('item_compB_noise', $foundIds)) {
    echo "SUCCESS: Fetched correct aggregated items.\n";
    foreach ($response as $item) {
        printf("[%s] %s (Tenant: %s) Status: %s\n", 
            $item['id'], 
            $item['title'], 
            $item['tenantId'] ?? 'Personal', // tenantId might be null
            $item['status']
        );
    }
} else {
    echo "FAILED:\n";
    echo "Missing: " . implode(', ', $missing) . "\n";
    echo "Unexpected: " . implode(', ', $unexpected) . "\n";
    exit(1);
}
