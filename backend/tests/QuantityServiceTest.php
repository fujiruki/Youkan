<?php
// backend/tests/QuantityServiceTest.php
require_once __DIR__ . '/../QuantityService.php';

// Mock DB connection (PDO)
class MockPDO extends PDO {
    public function __construct() {}
}

class QuantityServiceTest {
    private $service;
    private $mockPdo;

    public function __construct() {
        $this->mockPdo = new MockPDO();
        $this->service = new QuantityService($this->mockPdo);
    }

    public function run() {
        echo "Running QuantityService Tests...\n";
        $this->testCalculateDailyCapacity();
        $this->testContextLogic();
        echo "All tests passed!\n";
    }

    // Test 1: Daily Capacity Calculation
    private function testCalculateDailyCapacity() {
        echo "  [Test] Calculate Daily Capacity...";
        
        // Scenario A: Default Settings (Weekdays = 8h)
        $userDefaults = ['daily_capacity_minutes' => 480];
        $date = '2026-02-16'; // Monday
        $overrides = [];
        
        $capA = $this->service->getDailyCapacity($userDefaults, $date, $overrides);
        assert($capA === 480, "Expected 480, got $capA (Default)");

        // Scenario B: Override Logic
        $overrides = ['2026-02-16' => 300]; // Shortened day
        $capB = $this->service->getDailyCapacity($userDefaults, $date, $overrides);
        assert($capB === 300, "Expected 300, got $capB (Overridden)");

        echo " OK\n";
    }

    // Test 2: Context Logic (All/Company/Personal)
    private function testContextLogic() {
        echo "  [Test] Context Logic...";

        $tasks = [
            ['id' => 't1', 'estimated_minutes' => 60, 'tenant_id' => 't_company_a'], // Work
            ['id' => 't2', 'estimated_minutes' => 30, 'tenant_id' => 't_private'],   // Private
            ['id' => 't3', 'estimated_minutes' => 90, 'tenant_id' => 't_company_b']  // Work
        ];

        // Case All: Sum of everything
        $usageAll = $this->service->calculateUsage($tasks, 'all');
        assert($usageAll === 180, "Context All: Expected 180, got $usageAll");

        // Case Company: Work only
        $usageComp = $this->service->calculateUsage($tasks, 'work');
        assert($usageComp === 150, "Context Company: Expected 150 (60+90), got $usageComp");

        // Case Personal: Private only
        $usagePriv = $this->service->calculateUsage($tasks, 'private');
        assert($usagePriv === 30, "Context Personal: Expected 30, got $usagePriv");

        echo " OK\n";
    }
}

// Simple Runner
$test = new QuantityServiceTest();
$test->run();
