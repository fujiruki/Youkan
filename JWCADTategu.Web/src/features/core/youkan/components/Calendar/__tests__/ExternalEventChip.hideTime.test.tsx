import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExternalEventChip } from '../ExternalEventChip';
import { CalendarCell } from '../CalendarCell';
import { ExternalEvent } from '../../../types/externalEvent';

const baseEvent: ExternalEvent = {
    id: 'google:evt1',
    calendarId: 'primary',
    eventId: 'evt1',
    startAt: new Date('2026-06-03T10:00:00').getTime() / 1000,
    endAt: new Date('2026-06-03T11:00:00').getTime() / 1000,
    allDay: false,
    title: '会議',
    location: null,
    htmlLink: null,
};

const allDayEvent: ExternalEvent = {
    ...baseEvent,
    id: 'google:evt2',
    eventId: 'evt2',
    allDay: true,
    title: '出張',
};

describe('ExternalEventChip — hideTime prop（R-063）', () => {
    it('hideTime 未指定（デフォルト false）では時刻を表示する', () => {
        render(<ExternalEventChip event={baseEvent} />);
        expect(screen.getByRole('button').textContent).toContain('10:00');
    });

    it('hideTime=false でも時刻を表示する', () => {
        render(<ExternalEventChip event={baseEvent} hideTime={false} />);
        expect(screen.getByRole('button').textContent).toContain('10:00');
    });

    it('hideTime=true のとき時刻ラベルを描画しない', () => {
        render(<ExternalEventChip event={baseEvent} hideTime={true} />);
        const el = screen.getByRole('button');
        expect(el.textContent).not.toContain('10:00');
        expect(el.textContent).not.toContain('09:');
        expect(el.textContent).not.toContain(':');
    });

    it('hideTime=true でも 📅 とタイトルは表示する', () => {
        render(<ExternalEventChip event={baseEvent} hideTime={true} />);
        const el = screen.getByRole('button');
        expect(el.textContent).toContain('📅');
        expect(el.textContent).toContain('会議');
    });

    it('hideTime=true のとき終日イベントの [終日] ラベルも非表示にする', () => {
        render(<ExternalEventChip event={allDayEvent} hideTime={true} />);
        const el = screen.getByRole('button');
        expect(el.textContent).not.toContain('[終日]');
        expect(el.textContent).toContain('📅');
        expect(el.textContent).toContain('出張');
    });
});

const baseCalendarCellProps = {
    date: new Date('2026-06-03T00:00:00'),
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

describe('CalendarCell — hideTime が ExternalEventChip に伝わる（R-063）', () => {
    it('hideExternalEventTime prop なし（デフォルト）では時刻を表示する', () => {
        const event: ExternalEvent = { ...baseEvent };
        render(
            <CalendarCell
                {...baseCalendarCellProps}
                externalEvents={[event]}
            />
        );
        const chips = screen.getAllByRole('button');
        const chip = chips.find(b => b.textContent?.includes('会議') && b.textContent?.includes('📅'));
        expect(chip).toBeTruthy();
        expect(chip!.textContent).toContain('10:00');
    });

    it('hideExternalEventTime=true のとき CalendarCell 内の ExternalEventChip でも時刻が消える', () => {
        const event: ExternalEvent = { ...baseEvent };
        render(
            <CalendarCell
                {...baseCalendarCellProps}
                externalEvents={[event]}
                hideExternalEventTime={true}
            />
        );
        const chips = screen.getAllByRole('button');
        const chip = chips.find(b => b.textContent?.includes('会議') && b.textContent?.includes('📅'));
        expect(chip).toBeTruthy();
        expect(chip!.textContent).not.toContain('10:00');
        expect(chip!.textContent).toContain('📅');
        expect(chip!.textContent).toContain('会議');
    });
});
