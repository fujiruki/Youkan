import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExternalEventChip } from '../ExternalEventChip';
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

describe('ExternalEventChip', () => {
    it('時間指定イベントを 📅 HH:MM タイトル 形式で表示する', () => {
        render(<ExternalEventChip event={baseEvent} />);
        const el = screen.getByRole('button');
        expect(el.textContent).toContain('📅');
        expect(el.textContent).toContain('10:00');
        expect(el.textContent).toContain('会議');
    });

    it('終日イベントは [終日] プレフィックス付きで表示する', () => {
        render(
            <ExternalEventChip
                event={{ ...baseEvent, id: 'g:2', eventId: '2', allDay: true, title: '出張' }}
            />
        );
        const el = screen.getByRole('button');
        expect(el.textContent).toContain('📅');
        expect(el.textContent).toContain('[終日]');
        expect(el.textContent).toContain('出張');
    });

    it('タイトルが null のときは「(無題)」をフォールバック表示する', () => {
        render(<ExternalEventChip event={{ ...baseEvent, title: null }} />);
        expect(screen.getByRole('button').textContent).toContain('(無題)');
    });

    it('クリックで onClick が呼ばれる', () => {
        const onClick = vi.fn();
        render(<ExternalEventChip event={baseEvent} onClick={onClick} />);
        fireEvent.click(screen.getByRole('button'));
        expect(onClick).toHaveBeenCalledWith(baseEvent);
    });

    it('完了アイテム表示統一（R-035）スタイル（取り消し線）は適用しない', () => {
        render(<ExternalEventChip event={baseEvent} />);
        const el = screen.getByRole('button');
        expect(el.className).not.toMatch(/line-through/);
        expect(el.className).not.toMatch(/slate-400/);
    });
});
