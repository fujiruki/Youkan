import { describe, it, expect } from 'vitest';
import { Item, JudgmentStatus } from '../../types';
import { buildReviewQueue } from '../reviewQueue';
import fixture from '../../../../../../../backend/tests/fixtures/review_queue_cases.json';

/**
 * R-140: 要判断キュー（F-52）の TS/PHP 同一性担保。
 * backend/tests/fixtures/review_queue_cases.json を PHP 側 test_review_queue_service.php と共有し、
 * 同じ入力で同じID順になることを確認する。定義を変えるときはフィクスチャを先に変える。
 */
interface FixtureRow {
    id: string;
    title: string;
    status: string;
    is_project: number;
    is_archived: number;
    deleted_at: number | null;
    due_date: string | null;
    prep_date: number | null;
    review_date: string | null;
    estimated_minutes: number | null;
}

// BaseController::mapItemRow 相当の最小変換（DB行 → フロント Item）
const toItem = (row: FixtureRow): Item => ({
    id: row.id,
    title: row.title,
    status: row.status as JudgmentStatus,
    focusOrder: 0,
    isEngaged: false,
    statusUpdatedAt: 0,
    interrupt: false,
    weight: 1,
    createdAt: 0,
    updatedAt: 0,
    isProject: !!row.is_project,
    isArchived: !!row.is_archived,
    deletedAt: row.deleted_at,
    due_date: row.due_date,
    prep_date: row.prep_date,
    reviewDate: row.review_date,
    estimatedMinutes: row.estimated_minutes ?? undefined,
});

describe('buildReviewQueue 共有フィクスチャ (R-140)', () => {
    for (const c of fixture.cases) {
        it(c.name, () => {
            const result = buildReviewQueue((c.items as FixtureRow[]).map(toItem), c.today);
            expect(result.map(i => i.id)).toEqual(c.expected_ids);
        });
    }
});
