import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CalendarCell } from '../CalendarCell';
import { ExternalEvent } from '../../../types/externalEvent';

const baseDate = new Date('2026-06-03T00:00:00');

const makeEvent = (offset: number, opts: Partial<ExternalEvent> = {}): ExternalEvent => {
    const start = new Date('2026-06-03T09:00:00');
    start.setMinutes(start.getMinutes() + offset);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return {
        id: `google:e${offset}`,
        calendarId: 'primary',
        eventId: `e${offset}`,
        startAt: Math.floor(start.getTime() / 1000),
        endAt: Math.floor(end.getTime() / 1000),
        allDay: false,
        title: `予定${offset}`,
        location: null,
        htmlLink: null,
        ...opts,
    };
};

const baseProps = {
    date: baseDate,
    metric: undefined,
    isToday: false,
    isFirst: false,
    intensity: 0,
    isMini: false,
    isSelected: false,
    isPrep: false,
    isCommitPeriod: false,
    flashingIds: new Set<string>(),
    onAction: () => { },
    renderItemTitle: (i: any) => i.title,
};

describe('CalendarCell — Google カレンダー外部イベント表示', () => {
    it('externalEvents が空のとき、Google イベント関連の要素は描画されない', () => {
        render(<CalendarCell {...baseProps} externalEvents={[]} />);
        expect(screen.queryByText(/他.*件/)).toBeNull();
        expect(screen.queryByText(/📅/)).toBeNull();
    });

    it('3 件以下なら全て表示する（先頭にイベントチップ）', () => {
        const events = [makeEvent(0), makeEvent(60), makeEvent(120)];
        render(<CalendarCell {...baseProps} externalEvents={events} />);
        expect(screen.getByText(/予定0/)).toBeInTheDocument();
        expect(screen.getByText(/予定60/)).toBeInTheDocument();
        expect(screen.getByText(/予定120/)).toBeInTheDocument();
        expect(screen.queryByText(/他.*件/)).toBeNull();
    });

    it('4 件以上あるとき、先頭 3 件 + 「他 X 件」リンクが表示される', () => {
        const events = [
            makeEvent(0),
            makeEvent(60),
            makeEvent(120),
            makeEvent(180),
            makeEvent(240),
        ];
        render(<CalendarCell {...baseProps} externalEvents={events} />);
        // 先頭3件のタイトルがある
        expect(screen.getByText(/予定0/)).toBeInTheDocument();
        expect(screen.getByText(/予定60/)).toBeInTheDocument();
        expect(screen.getByText(/予定120/)).toBeInTheDocument();
        // 4 件目以降は通常チップとしては出さない
        expect(screen.queryByText(/予定180/)).toBeNull();
        expect(screen.queryByText(/予定240/)).toBeNull();
        // 代わりに「他 2 件」
        expect(screen.getByText(/他\s*2\s*件/)).toBeInTheDocument();
    });

    it('イベントチップをクリックすると onExternalEventClick が呼ばれる', () => {
        const onExternalEventClick = vi.fn();
        const events = [makeEvent(0)];
        render(
            <CalendarCell
                {...baseProps}
                externalEvents={events}
                onExternalEventClick={onExternalEventClick}
            />
        );
        fireEvent.click(screen.getByText(/予定0/));
        expect(onExternalEventClick).toHaveBeenCalledTimes(1);
        expect(onExternalEventClick.mock.calls[0][0].eventId).toBe('e0');
    });

    it('「他 X 件」をクリックすると onExternalEventsMoreClick が呼ばれる', () => {
        const onExternalEventsMoreClick = vi.fn();
        const events = [makeEvent(0), makeEvent(60), makeEvent(120), makeEvent(180)];
        render(
            <CalendarCell
                {...baseProps}
                externalEvents={events}
                onExternalEventsMoreClick={onExternalEventsMoreClick}
            />
        );
        fireEvent.click(screen.getByText(/他\s*1\s*件/));
        expect(onExternalEventsMoreClick).toHaveBeenCalledTimes(1);
        // 引数として日付と全イベントが渡る
        const [date, allEvents] = onExternalEventsMoreClick.mock.calls[0];
        expect(allEvents.length).toBe(4);
        expect(date.getDate()).toBe(baseDate.getDate());
    });

    it('isMini モードでは外部イベントを描画しない（ガント側で消費しない安全策）', () => {
        const events = [makeEvent(0)];
        render(<CalendarCell {...baseProps} isMini={true} externalEvents={events} />);
        expect(screen.queryByText(/予定0/)).toBeNull();
    });
});
