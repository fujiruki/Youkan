import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom';
import { CalendarTogglePopover } from '../CalendarTogglePopover';
import type { GoogleCalendar } from '../../../../../../api/googleCalendar';

const mockCalendars: GoogleCalendar[] = [
    { id: 1, calendarId: 'primary', summary: 'メイン', colorHex: '#039be5', isEnabled: true, sortOrder: 0 },
    { id: 2, calendarId: 'work@example.com', summary: '仕事', colorHex: '#d50000', isEnabled: false, sortOrder: 1 },
    { id: 3, calendarId: 'family@example.com', summary: '家族', colorHex: '#33b679', isEnabled: true, sortOrder: 2 },
];

describe('CalendarTogglePopover', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it('カレンダー名・色チップ・チェックボックスを表示する', () => {
        render(
            <CalendarTogglePopover
                calendars={mockCalendars}
                onToggle={() => Promise.resolve()}
                onClose={() => {}}
            />
        );

        expect(screen.getByText('メイン')).toBeInTheDocument();
        expect(screen.getByText('仕事')).toBeInTheDocument();
        expect(screen.getByText('家族')).toBeInTheDocument();

        const checkboxes = screen.getAllByRole('checkbox');
        expect(checkboxes).toHaveLength(3);
        expect((checkboxes[0] as HTMLInputElement).checked).toBe(true);
        expect((checkboxes[1] as HTMLInputElement).checked).toBe(false);
        expect((checkboxes[2] as HTMLInputElement).checked).toBe(true);
    });

    it('チェックボックスのクリックで onToggle が呼ばれる', () => {
        const onToggle = vi.fn().mockResolvedValue(undefined);
        render(
            <CalendarTogglePopover
                calendars={mockCalendars}
                onToggle={onToggle}
                onClose={() => {}}
            />
        );

        const checkboxes = screen.getAllByRole('checkbox');
        fireEvent.click(checkboxes[1]); // 「仕事」を ON にする

        expect(onToggle).toHaveBeenCalledWith(2, true);
    });

    it('「全選択」リンクで現在 OFF のカレンダーすべてに true を発行する', () => {
        const onToggle = vi.fn().mockResolvedValue(undefined);
        render(
            <CalendarTogglePopover
                calendars={mockCalendars}
                onToggle={onToggle}
                onClose={() => {}}
            />
        );

        fireEvent.click(screen.getByText('全選択'));

        // 「仕事」だけ OFF だったので 1 回呼ばれる
        expect(onToggle).toHaveBeenCalledTimes(1);
        expect(onToggle).toHaveBeenCalledWith(2, true);
    });

    it('「全解除」リンクで現在 ON のカレンダーすべてに false を発行する', () => {
        const onToggle = vi.fn().mockResolvedValue(undefined);
        render(
            <CalendarTogglePopover
                calendars={mockCalendars}
                onToggle={onToggle}
                onClose={() => {}}
            />
        );

        fireEvent.click(screen.getByText('全解除'));

        // 「メイン」「家族」が ON なので 2 回呼ばれる
        expect(onToggle).toHaveBeenCalledTimes(2);
        expect(onToggle).toHaveBeenCalledWith(1, false);
        expect(onToggle).toHaveBeenCalledWith(3, false);
    });

    it('外側クリックで onClose が呼ばれる', () => {
        const onClose = vi.fn();
        render(
            <div>
                <div data-testid="outside">outside</div>
                <CalendarTogglePopover
                    calendars={mockCalendars}
                    onToggle={() => Promise.resolve()}
                    onClose={onClose}
                />
            </div>
        );

        fireEvent.mouseDown(screen.getByTestId('outside'));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('カレンダー 0 件のときはヒント文を表示する', () => {
        render(
            <CalendarTogglePopover
                calendars={[]}
                onToggle={() => Promise.resolve()}
                onClose={() => {}}
            />
        );
        expect(screen.getByText(/カレンダーが見つかりません/)).toBeInTheDocument();
    });
});
