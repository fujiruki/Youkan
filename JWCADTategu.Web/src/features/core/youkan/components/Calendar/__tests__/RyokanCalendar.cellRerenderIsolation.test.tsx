import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { RyokanCalendar } from '../RyokanCalendar';
import { GoogleCalendar } from '../../../../../api/googleCalendar';

/**
 * R-070: RyokanCalendar のセル再レンダリング隔離テスト
 *
 * 根本原因: RyokanCalendar.handleDayAction が useCallback でラップされていないため、
 * RyokanCalendar 自体が再レンダリングされるたびに新しい関数参照が生成される。
 * これが RyokanGridView.handleCellAction（useCallback だが依存配列に onAction を持つ）を
 * 連鎖的に再生成し、React.memo 済みの全 CalendarCell の props を毎回変化させて
 * メモ化を崩壊させ、フル再レンダリングを引き起こす。
 *
 * このテストは、RyokanCalendar の props 参照が一切変わらないまま親コンポーネントの
 * 都合で再レンダリングされた場合でも、CalendarCell 側が再レンダリングされないことを検証する。
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

const minimalCapacityConfig = {
    defaultDailyMinutes: 480,
    holidays: [] as string[],
    exceptions: {} as Record<string, number>,
};

// [重要] すべて安定した参照（モジュールスコープ）で定義する。
// テスト中に再生成すると、それ自体が新規 props 参照になり検証の妨げになる。
const STABLE_ITEMS: any[] = [];
const STABLE_PROJECTS: any[] = [];
const STABLE_TENANTS: any[] = [];
const STABLE_GOOGLE_CALENDARS: GoogleCalendar[] = [];
const FOCUS_DATE = new Date(2026, 5, 15);

const Harness: React.FC = () => {
    const [, setTick] = React.useState(0);
    return (
        <div>
            <button
                data-testid="force-rerender-btn"
                onClick={() => setTick((t) => t + 1)}
            >
                force rerender
            </button>
            <RyokanCalendar
                items={STABLE_ITEMS}
                completedItems={STABLE_ITEMS}
                members={STABLE_PROJECTS}
                projects={STABLE_PROJECTS}
                capacityConfig={minimalCapacityConfig}
                joinedTenants={STABLE_TENANTS}
                googleCalendars={STABLE_GOOGLE_CALENDARS}
                currentUserId="test-user"
                displayMode="grid"
                focusDate={FOCUS_DATE}
                initialRangeMonths={0}
                hideHeader={true}
            />
        </div>
    );
};

describe('R-070: RyokanCalendar セル再レンダリング隔離', () => {
    beforeEach(() => {
        cellRenderCount = 0;
        if (!HTMLElement.prototype.scrollIntoView) {
            (HTMLElement.prototype as any).scrollIntoView = vi.fn();
        } else {
            vi.spyOn(HTMLElement.prototype, 'scrollIntoView').mockImplementation(() => { });
        }
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('props参照が変わらないまま親由来の再レンダリングが起きても、CalendarCellは再レンダリングされない', () => {
        const { container, getByTestId } = render(<Harness />);

        const cells = container.querySelectorAll('[data-date]');
        expect(cells.length).toBeGreaterThan(1);
        const totalCells = cells.length;

        const countAfterMount = cellRenderCount;
        expect(countAfterMount).toBeGreaterThanOrEqual(totalCells);

        // 親（Harness）の state 更新により RyokanCalendar 自体は再レンダリングされるが、
        // 渡している props はすべて同一参照のまま。
        act(() => {
            fireEvent.click(getByTestId('force-rerender-btn'));
        });

        const countAfterForceRerender = cellRenderCount - countAfterMount;

        // handleDayAction が useCallback 化されておらず、かつ externalEvents が
        // 毎回新規配列で生成されていると、全セル分（totalCells 分）再レンダリングが発生する。
        // 修正後は 0 件（メモ化が正しく機能し再レンダリングされない）になるはず。
        expect(countAfterForceRerender).toBe(0);
    });
});
