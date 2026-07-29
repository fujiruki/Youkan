import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { RyokanGridView } from '../RyokanGridView';

/**
 * R-070: RyokanGridView の externalEvents 安定参照テスト
 *
 * 根本原因: `externalEvents={externalEventsByDate?.get(toYmdKey(date)) || []}` が
 * イベントの無い日について毎レンダリング新しい空配列を生成しており、
 * React.memo 済みの CalendarCell の props が毎回変化してメモ化が崩壊する。
 *
 * このテストは、externalEventsByDate が未指定（またはイベント無し）のとき、
 * RyokanGridView が再レンダリングされても CalendarCell が再レンダリングされないことを検証する。
 */

let cellRenderCount = 0;

vi.mock('../CalendarCell', async (importOriginal) => {
    const actual = await importOriginal<typeof import('../CalendarCell')>();
    const OriginalCalendarCell = actual.CalendarCell;
    const Wrapped = React.memo((props: any) => {
        cellRenderCount++;
        return React.createElement(OriginalCalendarCell, props);
    });
    Wrapped.displayName = 'CalendarCell';
    return { CalendarCell: Wrapped };
});

const makeAllDays = (): Date[] => {
    const days: Date[] = [];
    for (let d = 1; d <= 7; d++) {
        days.push(new Date(2026, 5, d));
    }
    return days;
};

// 安定した参照（テスト全体で使い回す）
const stableAllDays = makeAllDays();
const stableMetrics = new Map();
const stableHeatMap = new Map();
const stableFlashingIds = new Set<string>();
const stableOnAction = vi.fn();
const stableRenderItemTitle = () => '';
const stableToday = new Date(2026, 5, 1);
// RyokanGridView 自身の projects/googleCalendars にはデフォルト値 `[]` があり、
// 呼び出し側が省略すると毎回新規配列が生成される。実際の呼び出し元（RyokanCalendar）は
// 常に明示的な安定参照を渡すため、テストでも同様に安定参照を明示的に渡す。
const stableProjects: any[] = [];
const stableGoogleCalendars: any[] = [];

describe('R-070: RyokanGridView externalEvents 安定参照', () => {
    beforeEach(() => {
        cellRenderCount = 0;
    });

    it('externalEventsByDate 未指定のまま再レンダリングしても CalendarCell は再レンダリングされない', () => {
        const props = {
            allDays: stableAllDays,
            metrics: stableMetrics,
            heatMap: stableHeatMap,
            today: stableToday,
            onAction: stableOnAction,
            renderItemTitle: stableRenderItemTitle,
            flashingIds: stableFlashingIds,
            projects: stableProjects,
            googleCalendars: stableGoogleCalendars,
        };

        const { rerender } = render(<RyokanGridView {...props} />);

        const countAfterMount = cellRenderCount;
        expect(countAfterMount).toBeGreaterThan(0);

        // props はすべて同一参照のまま再レンダリングを強制する
        rerender(<RyokanGridView {...props} />);

        expect(cellRenderCount).toBe(countAfterMount);
    });
});
