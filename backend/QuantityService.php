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
}
