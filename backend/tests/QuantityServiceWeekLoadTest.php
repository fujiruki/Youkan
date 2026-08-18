<?php
// backend/tests/QuantityServiceWeekLoadTest.php
// R-128: QuantityService::calcWeekLoad のテスト。
// フロント側 weekLoad.test.ts の「共有フィクスチャ」テストと同一の入力・同一の数値になることを確認する
// （02_機能仕様.md F-27 / 05_技術設計.md R-128節: 式は1箇所ずつ、同一フィクスチャで数値一致）。
require_once __DIR__ . '/../QuantityService.php';

class MockWeekLoadPDO extends PDO {
    public function __construct() {}
}

class QuantityServiceWeekLoadTest {
    private $service;

    // テスト基準日: 2026-08-18（火）。週は月曜始まり: 2026-08-17(月)〜2026-08-23(日)
    private $today = '2026-08-18';

    // フロント weekLoad.test.ts の CAPACITY_CONFIG と同一（土日休日、平日8h=480分）
    private $capacityConfig = [
        'default_daily_minutes' => 480,
        'holidays' => [
            ['type' => 'weekly', 'value' => '0'],
            ['type' => 'weekly', 'value' => '6'],
        ],
        'exceptions' => [],
    ];

    public function __construct() {
        $this->service = new QuantityService(new MockWeekLoadPDO());
    }

    private function item($id, $title, $status, $dueDate, $estimatedMinutes = 0, $overrides = []) {
        return array_merge([
            'id' => $id,
            'title' => $title,
            'status' => $status,
            'is_project' => 0,
            'estimated_minutes' => $estimatedMinutes,
            'due_date' => $dueDate,
            'prep_date' => null,
            'deleted_at' => null,
            'is_archived' => 0,
        ], $overrides);
    }

    public function run() {
        echo "Running QuantityService::calcWeekLoad Tests (R-128)...\n";
        $this->testCapacityOnly();
        $this->testSharedFixtureParity();
        $this->testOverCandidates();
        $this->testExcludeItemId();
        $this->testExceptionOverridesHoliday();
        echo "All tests passed!\n";
    }

    private function testCapacityOnly() {
        echo "  [Test] capacity_minutes: 週末休日、今日(火)〜日曜...";
        $result = $this->service->calcWeekLoad([], $this->capacityConfig, $this->today);
        // 火水木金(480*4=1920) + 土日(0) = 1920
        assert($result['capacity_minutes'] === 1920, "Expected 1920, got {$result['capacity_minutes']}");
        assert($result['week_end'] === '2026-08-23', "Expected week_end=2026-08-23, got {$result['week_end']}");
        echo " OK\n";
    }

    // フロント weekLoad.test.ts「共有フィクスチャ」と同一の入力・同一の数値
    private function testSharedFixtureParity() {
        echo "  [Test] 共有フィクスチャ: need=2400(40h) capacity=1920(32h) shortfall=480(8h)...";

        $items = [
            $this->item('a', 'A', 'todo', '2026-08-19', 900),
            $this->item('b', 'B', 'inbox', '2026-08-22', 900),
            $this->item('c', 'C', 'focus', '2026-08-10', 600), // 期限超過も含む
            $this->item('e', 'E', 'inbox', '2026-08-20'),      // 目安なし=0
            $this->item('d', 'D', 'inbox', '2026-08-25', 999), // 週末より後は対象外
            $this->item('f', 'F', 'done', '2026-08-21', 300),  // status対象外
            $this->item('g', 'G', 'inbox', '2026-08-21', 100, ['is_project' => 1]), // プロジェクト対象外
            $this->item('h', 'H', 'inbox', '2026-08-21', 50, ['deleted_at' => time()]), // 削除済み対象外
        ];

        $result = $this->service->calcWeekLoad($items, $this->capacityConfig, $this->today);

        assert($result['capacity_minutes'] === 1920, "capacity_minutes: expected 1920, got {$result['capacity_minutes']}");
        assert($result['need_minutes'] === 2400, "need_minutes: expected 2400, got {$result['need_minutes']}");
        assert($result['shortfall_minutes'] === 480, "shortfall_minutes: expected 480, got {$result['shortfall_minutes']}");
        assert($result['week_end'] === '2026-08-23', "week_end: expected 2026-08-23, got {$result['week_end']}");

        echo " OK\n";
    }

    private function testOverCandidates() {
        echo "  [Test] over_candidates: 有効締切が遅い順に最大2件...";

        $items = [
            $this->item('a', 'A', 'todo', '2026-08-19', 900),
            $this->item('b', 'B', 'inbox', '2026-08-22', 900),
            $this->item('c', 'C', 'focus', '2026-08-10', 600),
            $this->item('e', 'E', 'inbox', '2026-08-20'),
        ];

        $result = $this->service->calcWeekLoad($items, $this->capacityConfig, $this->today);
        $expected = [
            ['id' => 'b', 'title' => 'B', 'deadline' => '2026-08-22', 'estimated_minutes' => 900],
            ['id' => 'e', 'title' => 'E', 'deadline' => '2026-08-20', 'estimated_minutes' => 0],
        ];
        assert($result['over_candidates'] === $expected, "over_candidates mismatch: " . json_encode($result['over_candidates']));

        echo " OK\n";
    }

    private function testExcludeItemId() {
        echo "  [Test] excludeItemId: 直近に作成・更新した本人はover_candidatesからのみ除く...";

        $items = [
            $this->item('a', 'A', 'todo', '2026-08-19', 900),
            $this->item('b', 'B', 'inbox', '2026-08-22', 900),
            $this->item('c', 'C', 'focus', '2026-08-10', 600),
        ];

        $result = $this->service->calcWeekLoad($items, $this->capacityConfig, $this->today, 'b');
        $ids = array_map(fn($c) => $c['id'], $result['over_candidates']);
        assert($ids === ['a', 'c'], "Expected ['a','c'], got " . json_encode($ids));
        assert($result['need_minutes'] === 2400, "need_minutes should still include excluded item: expected 2400, got {$result['need_minutes']}");

        echo " OK\n";
    }

    private function testExceptionOverridesHoliday() {
        echo "  [Test] 日別例外（exceptions）が休日ルールより優先される...";

        $base = $this->service->calcWeekLoad([], $this->capacityConfig, $this->today)['capacity_minutes'];

        $config = $this->capacityConfig;
        $config['exceptions'] = ['2026-08-19' => 0]; // 水曜を休みに
        $withException = $this->service->calcWeekLoad([], $config, $this->today)['capacity_minutes'];

        assert($withException === $base - 480, "Expected " . ($base - 480) . ", got $withException");

        echo " OK\n";
    }
}

$test = new QuantityServiceWeekLoadTest();
$test->run();
