<?php
// backend/QuantityService.php

class QuantityService {
    private $pdo;

    public function __construct($pdo) {
        $this->pdo = $pdo;
    }

    /**
     * Calculate usage total for a specific date and context
     */
    public function calculateUsage($tasks, $context) {
        $totalMinutes = 0;

        foreach ($tasks as $task) {
            $isPrivate = ($task['tenant_id'] === 't_private');

            // Context Filtering Logic
            if ($context === 'company' && $isPrivate) {
                continue; // Skip private in Company mode
            }
            if ($context === 'personal' && !$isPrivate) {
                continue; // Skip work in Personal mode
            }
            // 'all' includes both

            $totalMinutes += (int)($task['estimated_minutes'] ?? 0);
        }

        return $totalMinutes;
    }

    /**
     * Get User's Daily Capacity based on defaults and overrides
     */
    public function getDailyCapacity($user, $date, $overrides = []) {
        // 1. Check for specific date override
        if (isset($overrides[$date])) {
            return (int)$overrides[$date];
        }

        // 2. Fallback to default setting
        return (int)($user['daily_capacity_minutes'] ?? 480);
    }

    /**
     * R-130 / F-11: 日次キャパの決定規則。フロント logic/capacity.ts の getDailyCapacity と同じ規則
     * （式は1箇所ずつ・優先順を揃える）。QuantityService側の唯一の実装。
     * 優先順:
     * 1. 日別例外 exceptions[YYYY-MM-DD]（0＝休み）
     * 2. 曜日パターン standard_weekly_pattern[曜日]（0＝定休日）
     * 3. holidays（weekly指定）に該当すれば0
     * 4. 1〜3で値が決まらず、その曜日が土日なら0（既定の週休2日。曜日パターンに平日しか
     *    保存されていない既存データでも土日は休みのまま）
     * 5. それ以外は default_daily_minutes
     * $capacityConfig = ['default_daily_minutes' => int, 'holidays' => HolidayRule[], 'exceptions' => [date => minutes], 'standard_weekly_pattern' => [曜日 => 分]|null]
     */
    public function getDailyCapacityFromConfig(DateTime $date, array $capacityConfig): int {
        $dateStr = $date->format('Y-m-d');
        $exceptions = $capacityConfig['exceptions'] ?? [];

        // 1. 日別例外（最優先）
        if (array_key_exists($dateStr, $exceptions)) {
            return (int)$exceptions[$dateStr];
        }

        $dayIndex = (int)$date->format('w'); // 0=Sun ... 6=Sat
        $weeklyPattern = $capacityConfig['standard_weekly_pattern'] ?? null;

        // 2. 曜日パターン
        if (is_array($weeklyPattern) && array_key_exists($dayIndex, $weeklyPattern)) {
            return (int)$weeklyPattern[$dayIndex];
        }

        // 3. holidays（weekly指定）
        $holidays = $capacityConfig['holidays'] ?? [];
        $isWeekly = false;
        foreach ($holidays as $h) {
            if (($h['type'] ?? '') === 'weekly' && (string)($h['value'] ?? '') === (string)$dayIndex) {
                $isWeekly = true;
                break;
            }
        }
        if ($isWeekly) {
            return 0;
        }

        // 4. 1〜3で値が決まらず、その曜日が土日なら既定の週休2日
        if ($dayIndex === 0 || $dayIndex === 6) {
            return 0;
        }

        // 5. 既定値
        return (int)($capacityConfig['default_daily_minutes'] ?? 480);
    }

    /**
     * R-128: 納期/マイ期限の早い方（有効締切）を Unix timestamp（日単位）で返す。
     * フロント logic/flowAutoPlace.ts の getEffectiveDeadline と同じ式。
     * $item = ['due_date' => 'YYYY-MM-DD'|null, 'prep_date' => int(unix seconds)|null]
     * R-140: ReviewQueueService／IntegrationController::digest からも使うため public static
     */
    public static function getEffectiveDeadlineFromItem(array $item): ?int {
        $dueTime = null;
        if (!empty($item['due_date'])) {
            $ts = strtotime($item['due_date']);
            if ($ts !== false) {
                $dueTime = strtotime(date('Y-m-d', $ts) . ' 00:00:00');
            }
        }

        $prepTime = null;
        if (!empty($item['prep_date'])) {
            $prepTime = strtotime(date('Y-m-d', (int)$item['prep_date']) . ' 00:00:00');
        }

        if ($dueTime !== null && $prepTime !== null) return min($dueTime, $prepTime);
        return $dueTime ?? $prepTime;
    }

    /**
     * R-128: 今週の残量（F-27）。純粋関数。式は 02_機能仕様.md F-27 に厳密に従う
     * （単純合計。逆算配分・安全係数は使わない）。
     * フロント logic/weekLoad.ts の calcWeekLoad と同じ式・同じキー名（snake_case）。
     * 片方だけを直さない。同一フィクスチャで両者が同じ数値を返すことをテストで確認する。
     *
     * @param array $items 各要素は ['id','title','status','is_project','estimated_minutes','due_date','prep_date','deleted_at','is_archived']
     * @param array $capacityConfig ['default_daily_minutes','holidays','exceptions']
     * @param string $today 'YYYY-MM-DD'
     * @param string|null $excludeItemId over_candidates からのみ除外する（直近に作成・更新した本人）
     */
    public function calcWeekLoad(array $items, array $capacityConfig, string $today, ?string $excludeItemId = null): array {
        $excludedStatuses = ['done', 'cancelled', 'someday'];

        $todayDate = new DateTime($today);
        $todayDate->setTime(0, 0, 0);
        $dayOfWeek = (int)$todayDate->format('N'); // 1=Mon ... 7=Sun
        $weekEndDate = (clone $todayDate)->modify('+' . (7 - $dayOfWeek) . ' days');
        $weekEndTs = $weekEndDate->getTimestamp();

        $capacityMinutes = 0;
        $cursor = clone $todayDate;
        while ($cursor <= $weekEndDate) {
            $capacityMinutes += $this->getDailyCapacityFromConfig($cursor, $capacityConfig);
            $cursor->modify('+1 day');
        }

        $targets = [];
        foreach ($items as $item) {
            if (!empty($item['deleted_at'])) continue;
            if (!empty($item['is_archived'])) continue;
            if (!empty($item['is_project'])) continue;
            if (in_array($item['status'] ?? null, $excludedStatuses, true)) continue;

            $deadline = self::getEffectiveDeadlineFromItem($item);
            if ($deadline === null || $deadline > $weekEndTs) continue;

            $targets[] = ['item' => $item, 'deadline' => $deadline];
        }

        $needMinutes = 0;
        foreach ($targets as $t) {
            $needMinutes += (int)($t['item']['estimated_minutes'] ?? 0);
        }
        $shortfallMinutes = max(0, $needMinutes - $capacityMinutes);

        $candidates = array_values(array_filter(
            $targets,
            fn($t) => ($t['item']['id'] ?? null) !== $excludeItemId
        ));
        usort($candidates, fn($a, $b) => $b['deadline'] <=> $a['deadline']);
        $overCandidates = array_map(function ($t) {
            return [
                'id' => $t['item']['id'],
                'title' => $t['item']['title'],
                'deadline' => date('Y-m-d', $t['deadline']),
                'estimated_minutes' => (int)($t['item']['estimated_minutes'] ?? 0)
            ];
        }, array_slice($candidates, 0, 2));

        return [
            'capacity_minutes' => $capacityMinutes,
            'need_minutes' => $needMinutes,
            'shortfall_minutes' => $shortfallMinutes,
            'week_end' => $weekEndDate->format('Y-m-d'),
            'over_candidates' => $overCandidates
        ];
    }

    /**
     * R-128: DBからユーザーのキャパ設定・アイテムを読み出して calcWeekLoad を呼ぶ薄いラッパー。
     * 計算式は一切ここに持たない（calcWeekLoad に一本化）。
     */
    public function calcWeekLoadForUser($userId, array $tenantIds, string $today, ?string $excludeItemId = null): array {
        $stmt = $this->pdo->prepare('SELECT daily_capacity_minutes, preferences FROM users WHERE id = ?');
        $stmt->execute([$userId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $preferences = [];
        if (!empty($user['preferences'])) {
            $decoded = json_decode($user['preferences'], true);
            if (is_array($decoded)) $preferences = $decoded;
        }
        $exceptions = $preferences['capacity_profile']['exceptions'] ?? [];
        // R-130: 曜日パターン（フロント PersonalSettingsScreen の表形式エディタで保存、users.preferences.capacity_profile.standardWeeklyPattern）
        $standardWeeklyPattern = $preferences['capacity_profile']['standardWeeklyPattern'] ?? null;
        if (is_array($standardWeeklyPattern)) {
            // JSON経由で数値キーが文字列化されるため、getDailyCapacityFromConfigの int キー参照に合わせて正規化
            $normalizedPattern = [];
            foreach ($standardWeeklyPattern as $day => $minutes) {
                $normalizedPattern[(int)$day] = (int)$minutes;
            }
            $standardWeeklyPattern = $normalizedPattern;
        } else {
            $standardWeeklyPattern = null;
        }

        $capacityConfig = [
            'default_daily_minutes' => (int)($user['daily_capacity_minutes'] ?? 480),
            // [NEW] CloudYoukanRepository.getCapacityConfig はholidaysを常に空配列で返す
            // （曜日休日設定はDBに保存されない）。getDailyCapacityFromConfigの「未設定なら土日休日」
            // フォールバックで、フロントの実運用動作と一致させる
            'holidays' => [],
            'exceptions' => $exceptions,
            'standard_weekly_pattern' => $standardWeeklyPattern,
        ];

        $tenantIds = array_values(array_unique(array_filter($tenantIds, fn($t) => $t !== null && $t !== '')));
        $tenantClause = "(items.tenant_id IS NULL OR items.tenant_id = '')";
        $tenantParams = [];
        if (!empty($tenantIds)) {
            $placeholders = implode(',', array_fill(0, count($tenantIds), '?'));
            $tenantClause = "(items.tenant_id IN ($placeholders) OR items.tenant_id IS NULL OR items.tenant_id = '')";
            $tenantParams = $tenantIds;
        }

        $sql = "SELECT id, title, status, is_project, estimated_minutes, due_date, prep_date, deleted_at, is_archived
                FROM items
                WHERE (items.created_by = ? OR items.assigned_to = ?) AND $tenantClause";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute(array_merge([$userId, $userId], $tenantParams));
        $items = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $this->calcWeekLoad($items, $capacityConfig, $today, $excludeItemId);
    }
}
