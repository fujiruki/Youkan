<?php
// backend/IntegrationController.php
require_once 'BaseController.php';
require_once 'QuantityService.php';
require_once 'ReviewQueueService.php';
require_once 'TodayController.php';

class IntegrationController extends BaseController {

    public function handleRequest($method, $path) {
        // /integrations/inbox
        if (preg_match('#^/inbox$#', $path) && $method === 'POST') {
            $this->createInboxItem();
        } elseif (preg_match('#^/digest$#', $path) && $method === 'GET') {
            $this->digest();
        } else {
            http_response_code(404);
            echo json_encode(['error' => 'Integration endpoint not found']);
        }
    }

    private function createInboxItem() {
        // R-140: BaseController::authenticate()（JWT／api_token 両対応）に一本化
        $this->authenticate();
        $userId = $this->currentUserId;

        $input = $this->getInput();
        if (!isset($input['title'])) {
            $this->sendError(400, 'Title is required');
        }

        // R-141: tenant_id は authenticate() が解決した currentTenantId。明示時は所属テナントのみ採用
        $tenantId = $this->currentTenantId;
        if (!empty($input['tenant_id'])) {
            if (!in_array($input['tenant_id'], $this->joinedTenants, true)) {
                $this->sendError(400, 'Not a member of the specified tenant');
            }
            $tenantId = $input['tenant_id'];
        }
        if (!$tenantId) {
            $this->sendError(500, 'User has no tenant');
        }

        // Create Item
        // Using UUID for ID
        $id = uniqid('item-temp-'); // Or standard UUID generator if available in PHP env without deps
        // Actually uniqid is fine for temp, but strictly we might want UUID v4.
        // Let's use simple uniqid for speed as per deps constraint, or random_bytes.
        $id = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );

        $now = time() * 1000; // items table uses MS timestamp?
        // Wait, items in JBWOSRepository `createdAt: number` (JS timestamp)
        // DB Schema in migrate_v7: `created_at INTEGER` (Unix TS usually).
        // Standardize: Use Unix Timestamp (Seconds) for SQLite compatibility, multiply by 1000 for JS frontend if needed.
        // But existing items table? Let's check `ItemController`.
        // `ItemController`: $now = time() * 1000;

        $stmt = $this->pdo->prepare("
            INSERT INTO items (id, title, status, memo, created_at, updated_at, created_by, tenant_id)
            VALUES (?, ?, 'inbox', ?, ?, ?, ?, ?)
        ");

        $title = $input['title'];
        $memo = $input['memo'] ?? '';

        $stmt->execute([$id, $title, $memo, $now, $now, $userId, $tenantId]);

        // R-128: 今週の残量（F-27）。番頭が不足時に一言返せるようレスポンスに同梱する
        $weekLoad = (new QuantityService($this->pdo))
            ->calcWeekLoadForUser($userId, $this->joinedTenants, date('Y-m-d'), $id);

        $this->sendJSON(['id' => $id, 'message' => 'Added to Inbox via Shortcut', 'week_load' => $weekLoad]);
    }

    /**
     * R-140 / F-56: GET /integrations/digest?date=YYYY-MM-DD&limit=3
     * 番頭の朝・昼・夜のメッセージに必要な数字を1リクエストで返す。文言・評価語は含めない。
     */
    private function digest() {
        $this->authenticate();

        $today = $_GET['date'] ?? '';
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $today)) {
            $today = date('Y-m-d');
        }
        $limit = min(20, max(1, (int)($_GET['limit'] ?? 3)));
        $todayStart = strtotime($today . ' 00:00:00');
        $weekStart = $todayStart - ((int)date('N', $todayStart) - 1) * 86400; // 今週月曜 0:00

        $items = $this->fetchAggregatedItems();

        // review_queue（F-52 と同一定義: ReviewQueueService）
        $queue = ReviewQueueService::build($items, $today);
        $queueItems = array_map(function ($i) use ($todayStart) {
            $deadline = QuantityService::getEffectiveDeadlineFromItem($i);
            return [
                'id' => $i['id'],
                'title' => $i['title'],
                'project_title' => $i['real_project_title'] ?? null,
                'status' => $i['status'],
                'due_date' => $i['due_date'] ?? null,
                'prep_date' => isset($i['prep_date']) ? (int)$i['prep_date'] : null,
                'review_date' => $i['review_date'] ?? null,
                'estimated_minutes' => (int)($i['estimated_minutes'] ?? 0),
                'overdue_days' => $deadline === null ? null : max(0, (int)round(($todayStart - $deadline) / 86400)),
            ];
        }, array_slice($queue, 0, $limit));

        // uncontacted_overdue（F-55 の超過分のうち meta.contacted_at 無し。案件別、案件なしは最後）
        $groups = [];
        foreach ($items as $i) {
            if (!empty($i['is_project']) || in_array($i['status'], ['done', 'cancelled', 'someday'], true)) continue;
            $deadline = QuantityService::getEffectiveDeadlineFromItem($i);
            if ($deadline === null || $deadline >= $todayStart) continue;
            $meta = !empty($i['meta']) ? json_decode($i['meta'], true) : null;
            if (!empty($meta['contacted_at'])) continue;

            $key = $i['project_id'] ?: '__none__';
            if (!isset($groups[$key])) {
                $groups[$key] = [
                    'project_id' => $i['project_id'] ?: null,
                    'project_title' => $i['project_id'] ? ($i['real_project_title'] ?? null) : null,
                    'client_name' => null,
                    'count' => 0,
                    'total_minutes' => 0,
                    'oldest_due_date' => null,
                ];
            }
            $g = &$groups[$key];
            $g['count']++;
            $g['total_minutes'] += (int)($i['estimated_minutes'] ?? 0);
            if ($g['client_name'] === null && !empty($i['client_name'])) $g['client_name'] = $i['client_name'];
            $d = date('Y-m-d', $deadline);
            if ($g['oldest_due_date'] === null || $d < $g['oldest_due_date']) $g['oldest_due_date'] = $d;
            unset($g);
        }
        $uncontacted = array_values($groups);
        usort($uncontacted, function ($a, $b) {
            if (($a['project_id'] === null) !== ($b['project_id'] === null)) return $a['project_id'] === null ? 1 : -1;
            return strcmp($a['oldest_due_date'], $b['oldest_due_date']);
        });

        // declined_this_week（F-52 の断ったKPIと同一）
        $declined = count(array_filter($items, fn($i) => $i['status'] === 'cancelled' && (int)($i['status_updated_at'] ?? 0) >= $weekStart));

        // focus（既存 focus 並び順）
        $focus = array_values(array_filter($items, fn($i) => $i['status'] === 'focus'));
        usort($focus, ['TodayController', 'compareFocusOrder']);
        $focus = array_map(fn($i) => [
            'id' => $i['id'],
            'title' => $i['title'],
            'project_title' => $i['real_project_title'] ?? null,
            'estimated_minutes' => (int)($i['estimated_minutes'] ?? 0),
            'due_date' => $i['due_date'] ?? null,
        ], $focus);

        $this->sendJSON([
            'review_queue' => ['total' => count($queue), 'items' => $queueItems],
            'week_load' => (new QuantityService($this->pdo))->calcWeekLoadForUser($this->currentUserId, $this->joinedTenants, $today),
            'uncontacted_overdue' => $uncontacted,
            'declined_this_week' => $declined,
            'focus' => $focus,
        ]);
    }
}
