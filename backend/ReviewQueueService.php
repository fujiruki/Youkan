<?php
// backend/ReviewQueueService.php
require_once 'QuantityService.php';

/**
 * R-140: 要判断キュー（02_機能仕様.md F-52）のサーバー側実装。
 * フロント logic/reviewQueue.ts の buildReviewQueue と同一定義。片方だけを直さない
 * （共有フィクスチャ tests/fixtures/review_queue_cases.json で両者の一致をテストする）。
 *
 * 対象: deleted_at なし・is_archived=0・status ∉ {done,cancelled,someday}・is_project=0、かつ
 *       「有効締切（due_date/prep_date の早い方）が今日より前」または「status=pending かつ review_date <= 今日」
 * 並び: ①再確認到来 → ②目安時間の短い順（未入力=null は最後）→ ③有効締切の古い順
 */
class ReviewQueueService {
    private const EXCLUDED_STATUSES = ['done', 'cancelled', 'someday'];

    public static function isReviewDue(array $item, string $today): bool {
        return ($item['status'] ?? null) === 'pending'
            && !empty($item['review_date'])
            && $item['review_date'] <= $today;
    }

    /**
     * @param array $items DB行（snake_case）の配列
     * @param string $today 'YYYY-MM-DD'
     * @return array 対象のみを F-52 の順に並べた配列（要素は入力の行そのまま）
     */
    public static function build(array $items, string $today): array {
        $todayStart = strtotime($today . ' 00:00:00');
        $rows = [];
        foreach ($items as $item) {
            if (!empty($item['deleted_at'])) continue;
            if (!empty($item['is_archived'])) continue;
            if (!empty($item['is_project'])) continue;
            if (in_array($item['status'] ?? null, self::EXCLUDED_STATUSES, true)) continue;

            $deadline = QuantityService::getEffectiveDeadlineFromItem($item);
            $isOverdue = $deadline !== null && $deadline < $todayStart;
            $reviewDue = self::isReviewDue($item, $today);
            if (!$isOverdue && !$reviewDue) continue;

            $minutes = $item['estimated_minutes'] ?? null;
            $rows[] = [
                'item' => $item,
                'review' => $reviewDue,
                'minutes' => ($minutes === null || $minutes === '') ? null : (int)$minutes,
                'deadline' => $deadline,
            ];
        }

        usort($rows, function ($a, $b) {
            if ($a['review'] !== $b['review']) return $a['review'] ? -1 : 1;
            if ($a['minutes'] === null && $b['minutes'] !== null) return 1;
            if ($a['minutes'] !== null && $b['minutes'] === null) return -1;
            if ($a['minutes'] !== null && $b['minutes'] !== null && $a['minutes'] !== $b['minutes']) {
                return $a['minutes'] <=> $b['minutes'];
            }
            if ($a['deadline'] === null && $b['deadline'] !== null) return 1;
            if ($a['deadline'] !== null && $b['deadline'] === null) return -1;
            if ($a['deadline'] !== null && $b['deadline'] !== null) return $a['deadline'] <=> $b['deadline'];
            return 0;
        });

        return array_map(fn($r) => $r['item'], $rows);
    }
}
