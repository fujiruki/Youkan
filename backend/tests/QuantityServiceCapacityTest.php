<?php
// backend/tests/QuantityServiceCapacityTest.php
// R-130 / F-11: QuantityService::getDailyCapacityFromConfig のテスト。
// フロント側 capacity.test.ts と同一の優先順・同一の数値になることを確認する
// （1.日別例外 > 2.曜日パターン(0=定休日) > 3.holidays(weekly) > 4.未設定時の土日フォールバック > 5.default_daily_minutes）。
require_once __DIR__ . '/../QuantityService.php';

class MockCapacityPDO extends PDO {
    public function __construct() {}
}

class QuantityServiceCapacityTest {
    private $service;

    // 2026-02-09は月曜、2026-02-13は金曜、2026-02-14は土曜、2026-02-15は日曜
    private $monday = '2026-02-09';
    private $friday = '2026-02-13';
    private $saturday = '2026-02-14';
    private $sunday = '2026-02-15';

    public function __construct() {
        $this->service = new QuantityService(new MockCapacityPDO());
    }

    public function run() {
        echo "Running QuantityService::getDailyCapacityFromConfig Tests (R-130)...\n";
        $this->testRule5DefaultWhenNothingConfigured();
        $this->testRule4WeekendFallbackWhenUnconfigured();
        $this->testRule3HolidaysWeekly();
        $this->testRule2WeeklyPatternOverridesDefault();
        $this->testRule2ZeroMeansHoliday();
        $this->testRule2PriorityOverRule3();
        $this->testRule4WeekendZeroWithWeekdayOnlyPattern();
        $this->testRule2PriorityOverRule4();
        $this->testRule1ExceptionPriorityOverPattern();
        $this->testRule1ExceptionZeroIsHoliday();
        echo "All tests passed!\n";
    }

    private function testRule5DefaultWhenNothingConfigured() {
        echo "  [Test] 規則5: 何も設定がなければ平日はdefault_daily_minutes...";
        $config = ['default_daily_minutes' => 480, 'holidays' => [], 'exceptions' => []];
        $cap = $this->service->getDailyCapacityFromConfig(new DateTime($this->monday), $config);
        assert($cap === 480, "Expected 480, got $cap");
        echo " OK\n";
    }

    private function testRule4WeekendFallbackWhenUnconfigured() {
        echo "  [Test] 規則4: holidaysも曜日パターンも未設定なら土日は0...";
        $config = ['default_daily_minutes' => 480, 'holidays' => [], 'exceptions' => []];
        $sat = $this->service->getDailyCapacityFromConfig(new DateTime($this->saturday), $config);
        $sun = $this->service->getDailyCapacityFromConfig(new DateTime($this->sunday), $config);
        assert($sat === 0, "Sat: Expected 0, got $sat");
        assert($sun === 0, "Sun: Expected 0, got $sun");
        echo " OK\n";
    }

    private function testRule3HolidaysWeekly() {
        echo "  [Test] 規則3: holidays(weekly)に該当すれば0...";
        $config = ['default_daily_minutes' => 480, 'holidays' => [['type' => 'weekly', 'value' => '6']], 'exceptions' => []];
        $sat = $this->service->getDailyCapacityFromConfig(new DateTime($this->saturday), $config);
        // 日曜はholidaysに含まれないが、規則4（その曜日が土日なら0）でどのみち0
        $sun = $this->service->getDailyCapacityFromConfig(new DateTime($this->sunday), $config);
        assert($sat === 0, "Sat: Expected 0, got $sat");
        assert($sun === 0, "Sun: Expected 0, got $sun");
        echo " OK\n";
    }

    private function testRule4WeekendZeroWithWeekdayOnlyPattern() {
        echo "  [Test] 規則4: 曜日パターンに平日しか保存されていなくても土日は0（既存データの平日のみパターン）...";
        $config = [
            'default_daily_minutes' => 480,
            'holidays' => [],
            'exceptions' => [],
            'standard_weekly_pattern' => [1 => 480, 2 => 480, 3 => 480, 4 => 480, 5 => 480], // 土日キーを省略
        ];
        $sat = $this->service->getDailyCapacityFromConfig(new DateTime($this->saturday), $config);
        $sun = $this->service->getDailyCapacityFromConfig(new DateTime($this->sunday), $config);
        assert($sat === 0, "Sat: Expected 0, got $sat");
        assert($sun === 0, "Sun: Expected 0, got $sun");
        echo " OK\n";
    }

    private function testRule2PriorityOverRule4() {
        echo "  [Test] 規則2は規則4より優先される（土曜に明示値があればそれを使う）...";
        $config = [
            'default_daily_minutes' => 480,
            'holidays' => [],
            'exceptions' => [],
            'standard_weekly_pattern' => [6 => 480], // 土曜だけ稼働と明示
        ];
        $sat = $this->service->getDailyCapacityFromConfig(new DateTime($this->saturday), $config);
        assert($sat === 480, "Sat: Expected 480, got $sat");
        echo " OK\n";
    }

    private function testRule2WeeklyPatternOverridesDefault() {
        echo "  [Test] 規則2: 曜日パターンがあればそれを使う（平日を240分に変更できる）...";
        $config = [
            'default_daily_minutes' => 480,
            'holidays' => [],
            'exceptions' => [],
            'standard_weekly_pattern' => [1 => 240, 2 => 240, 3 => 240, 4 => 240, 5 => 240],
        ];
        $cap = $this->service->getDailyCapacityFromConfig(new DateTime($this->monday), $config);
        assert($cap === 240, "Expected 240, got $cap");
        echo " OK\n";
    }

    private function testRule2ZeroMeansHoliday() {
        echo "  [Test] 規則2: 曜日パターンで0を指定した曜日は定休日になる（holidays未設定でも）...";
        $config = [
            'default_daily_minutes' => 480,
            'holidays' => [],
            'exceptions' => [],
            'standard_weekly_pattern' => [1 => 480, 2 => 480, 3 => 480, 4 => 480, 5 => 0],
        ];
        $cap = $this->service->getDailyCapacityFromConfig(new DateTime($this->friday), $config);
        assert($cap === 0, "Expected 0, got $cap");
        echo " OK\n";
    }

    private function testRule2PriorityOverRule3() {
        echo "  [Test] 規則2は規則3(holidays)より優先される...";
        $config = [
            'default_daily_minutes' => 480,
            'holidays' => [['type' => 'weekly', 'value' => '1']], // 月曜をholidaysで定休日指定
            'exceptions' => [],
            'standard_weekly_pattern' => [1 => 300], // だが曜日パターンで300分と明示
        ];
        $cap = $this->service->getDailyCapacityFromConfig(new DateTime($this->monday), $config);
        assert($cap === 300, "Expected 300, got $cap");
        echo " OK\n";
    }

    private function testRule1ExceptionPriorityOverPattern() {
        echo "  [Test] 規則1: 日別例外が最優先（曜日パターンより優先）...";
        $config = [
            'default_daily_minutes' => 480,
            'holidays' => [],
            'exceptions' => [$this->monday => 120],
            'standard_weekly_pattern' => [1 => 0], // 月曜は定休日設定
        ];
        $cap = $this->service->getDailyCapacityFromConfig(new DateTime($this->monday), $config);
        assert($cap === 120, "Expected 120, got $cap");
        echo " OK\n";
    }

    private function testRule1ExceptionZeroIsHoliday() {
        echo "  [Test] 規則1: 日別例外0は休みとして扱われる...";
        $config = ['default_daily_minutes' => 480, 'holidays' => [], 'exceptions' => [$this->monday => 0]];
        $cap = $this->service->getDailyCapacityFromConfig(new DateTime($this->monday), $config);
        assert($cap === 0, "Expected 0, got $cap");
        echo " OK\n";
    }
}

$test = new QuantityServiceCapacityTest();
$test->run();
