import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { ExternalEvent } from '../../../types/externalEvent';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-040: ガントビューで Google カレンダー予定が表示されないバグの回帰防止テスト。
 *
 * `useExternalEvents` の `buildEventsByDate` が `YYYY-MM-DD` 形式の key で Map を返すので、
 * ガント側もこの key 形式で取得する必要がある（normalizeDateKey の `toDateString` 形式ではダメ）。
 *
 * 期待: `externalEventsByDate` に `YYYY-MM-DD` 形式の key で予定が登録されている日について、
 * `data-testid="gantt-external-events-<normalizeDateKey>"` 要素が描画される。
 */

const makeAllDays = (): Date[] => {
    const days: Date[] = [];
    for (let d = 1; d <= 7; d++) {
        days.push(new Date(2026, 4, d)); // 2026-05-01 〜 2026-05-07
    }
    return days;
};

const makeEvent = (id: string, title: string): ExternalEvent => ({
    id,
    calendarId: 'primary',
    eventId: id,
    startAt: Math.floor(new Date(2026, 4, 2, 10, 0, 0).getTime() / 1000),
    endAt: Math.floor(new Date(2026, 4, 2, 11, 0, 0).getTime() / 1000),
    allDay: false,
    title,
    location: null,
    htmlLink: null,
});

const defaultProps = {
    allDays: makeAllDays(),
    items: [],
    heatMap: new Map(),
    today: new Date(2026, 4, 1),
    safeConfig: {},
    rowHeight: 40,
    projects: [],
    renderItemTitle: () => '',
    showGroups: false,
};

describe('R-040: RyokanGanttView の Google カレンダー予定表示 (YYYY-MM-DD key)', () => {
    it('externalEventsByDate に YYYY-MM-DD 形式 key で予定がある日にチップが描画される', () => {
        // useExternalEvents が返すのと同じ key 形式（YYYY-MM-DD）で Map を構築
        const eventsByDate = new Map<string, ExternalEvent[]>();
        eventsByDate.set('2026-05-02', [makeEvent('ev-1', 'テスト予定')]);

        render(
            <ToastProvider>
                <RyokanGanttView
                    {...defaultProps}
                    externalEventsByDate={eventsByDate}
                />
            </ToastProvider>
        );

        // 2026-05-02 の日付ヘッダーセル内に外部予定コンテナが描画されているはず。
        // data-testid のサフィックスは normalizeDateKey（toDateString）形式なので、
        // 5/2 (土) の normalizeDateKey は "Sat May 02 2026"。
        const testId = `gantt-external-events-${new Date(2026, 4, 2).toDateString()}`;
        const chipContainer = screen.queryByTestId(testId);
        expect(chipContainer).not.toBeNull();
    });

    it('externalEventsByDate が空のときは外部予定チップが描画されない', () => {
        render(
            <ToastProvider>
                <RyokanGanttView
                    {...defaultProps}
                    externalEventsByDate={new Map()}
                />
            </ToastProvider>
        );

        // どの日にもチップは出ない
        const testId = `gantt-external-events-${new Date(2026, 4, 2).toDateString()}`;
        expect(screen.queryByTestId(testId)).toBeNull();
    });
});
