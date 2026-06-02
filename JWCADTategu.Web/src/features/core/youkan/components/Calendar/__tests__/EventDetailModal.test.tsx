import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventDetailModal } from '../EventDetailModal';
import { ExternalEvent } from '../../../types/externalEvent';

const timedEvent: ExternalEvent = {
    id: 'google:m1',
    calendarId: 'primary',
    eventId: 'm1',
    startAt: Math.floor(new Date('2026-06-03T10:00:00').getTime() / 1000),
    endAt: Math.floor(new Date('2026-06-03T11:30:00').getTime() / 1000),
    allDay: false,
    title: '会議',
    location: 'Zoom',
    htmlLink: 'https://calendar.google.com/event?eid=m1',
};

const allDayEvent: ExternalEvent = {
    ...timedEvent,
    id: 'google:m2',
    eventId: 'm2',
    allDay: true,
    title: '出張',
    location: null,
    htmlLink: null,
};

describe('EventDetailModal', () => {
    it('isOpen=false の場合は何も描画しない', () => {
        const { container } = render(
            <EventDetailModal isOpen={false} event={timedEvent} onClose={() => { }} />
        );
        expect(container.textContent).toBe('');
    });

    it('event=null の場合は描画しない', () => {
        const { container } = render(
            <EventDetailModal isOpen={true} event={null} onClose={() => { }} />
        );
        expect(container.textContent).toBe('');
    });

    it('時間指定イベントのタイトル / 時刻 / 場所を表示する', () => {
        render(<EventDetailModal isOpen={true} event={timedEvent} onClose={() => { }} />);
        expect(screen.getByText('会議')).toBeInTheDocument();
        expect(screen.getByText(/10:00/)).toBeInTheDocument();
        expect(screen.getByText(/11:30/)).toBeInTheDocument();
        expect(screen.getByText(/Zoom/)).toBeInTheDocument();
    });

    it('終日イベントは「終日」表示にする', () => {
        render(<EventDetailModal isOpen={true} event={allDayEvent} onClose={() => { }} />);
        expect(screen.getByText('出張')).toBeInTheDocument();
        expect(screen.getByText(/終日/)).toBeInTheDocument();
    });

    it('htmlLink がある場合は「Google で開く」リンクが htmlLink を指す', () => {
        render(<EventDetailModal isOpen={true} event={timedEvent} onClose={() => { }} />);
        const link = screen.getByRole('link', { name: /Google.*開く/ }) as HTMLAnchorElement;
        expect(link.href).toBe('https://calendar.google.com/event?eid=m1');
        expect(link.target).toBe('_blank');
    });

    it('htmlLink が無い場合は Google カレンダーホームを指す', () => {
        render(<EventDetailModal isOpen={true} event={allDayEvent} onClose={() => { }} />);
        const link = screen.getByRole('link', { name: /Google.*開く/ }) as HTMLAnchorElement;
        expect(link.href).toContain('calendar.google.com');
    });

    it('閉じるボタンクリックで onClose が呼ばれる', () => {
        const onClose = vi.fn();
        render(<EventDetailModal isOpen={true} event={timedEvent} onClose={onClose} />);
        fireEvent.click(screen.getByLabelText('閉じる'));
        expect(onClose).toHaveBeenCalled();
    });

    it('オーバーレイクリックで onClose が呼ばれる', () => {
        const onClose = vi.fn();
        render(<EventDetailModal isOpen={true} event={timedEvent} onClose={onClose} />);
        fireEvent.click(screen.getByTestId('event-detail-overlay'));
        expect(onClose).toHaveBeenCalled();
    });

    it('Esc キーで onClose が呼ばれる', () => {
        const onClose = vi.fn();
        render(<EventDetailModal isOpen={true} event={timedEvent} onClose={onClose} />);
        fireEvent.keyDown(window, { key: 'Escape' });
        expect(onClose).toHaveBeenCalled();
    });

    it('編集 / 削除などタスク操作系のボタンは表示しない（DecisionDetailModal とは別物）', () => {
        render(<EventDetailModal isOpen={true} event={timedEvent} onClose={() => { }} />);
        expect(screen.queryByText('完了')).toBeNull();
        expect(screen.queryByText('アーカイブ')).toBeNull();
        expect(screen.queryByText('削除')).toBeNull();
        expect(screen.queryByText('保存')).toBeNull();
    });
});
