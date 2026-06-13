/**
 * R-061: DetailQuantityCalendar 密度トグルテスト
 *
 * - デフォルト'フル'（panorama）／トグルで'コンパクト'（mini）
 * - localStorage 保存・復元
 * - 両密度で外部イベントが伝播する（本課題の核心）
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DetailQuantityCalendar } from '../DetailQuantityCalendar';
import { ExternalEvent } from '../../../features/core/youkan/types/externalEvent';

vi.mock('../../../features/core/youkan/components/Calendar/RyokanCalendar', () => {
    const React = require('react');
    return {
        RyokanCalendar: ({ layoutMode, externalEventsByDate }: {
            layoutMode?: string;
            externalEventsByDate?: Map<string, ExternalEvent[]>;
        }) => {
            const eventCount = externalEventsByDate
                ? Array.from(externalEventsByDate.values()).reduce((s, arr) => s + arr.length, 0)
                : 0;
            return React.createElement('div', {
                'data-testid': 'mock-ryokan-calendar',
                'data-layout-mode': layoutMode ?? '',
                'data-external-count': String(eventCount),
            });
        },
    };
});

vi.mock('../../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

const DENSITY_KEY = 'youkan_detail_calendar_density';

const TODAY_KEY = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
})();

const makeEventsMap = (count: number): Map<string, ExternalEvent[]> => {
    const map = new Map<string, ExternalEvent[]>();
    const events: ExternalEvent[] = Array.from({ length: count }, (_, i) => ({
        id: `ev${i}`,
        calendarId: 'primary',
        eventId: `ev${i}`,
        startAt: Math.floor(Date.now() / 1000) + i * 60,
        endAt: Math.floor(Date.now() / 1000) + i * 60 + 3600,
        allDay: false,
        title: `予定${i}`,
        location: null,
        htmlLink: null,
    }));
    map.set(TODAY_KEY, events);
    return map;
};

describe('DetailQuantityCalendar — 密度トグル (R-061)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorage.removeItem(DENSITY_KEY);
    });

    afterEach(() => {
        localStorage.removeItem(DENSITY_KEY);
    });

    it('デフォルトは "フル"（panorama）モード', () => {
        render(<DetailQuantityCalendar item={null} globalFilter="all" />);
        const cal = screen.getByTestId('mock-ryokan-calendar');
        expect(cal.getAttribute('data-layout-mode')).toBe('panorama');
    });

    it('密度トグルボタンが描画される', () => {
        render(<DetailQuantityCalendar item={null} globalFilter="all" />);
        const toggle = screen.getByTestId('density-toggle-btn');
        expect(toggle).toBeTruthy();
    });

    it('トグルクリックで "コンパクト"（mini）に切り替わる', () => {
        render(<DetailQuantityCalendar item={null} globalFilter="all" />);
        const toggle = screen.getByTestId('density-toggle-btn');
        fireEvent.click(toggle);
        const cal = screen.getByTestId('mock-ryokan-calendar');
        expect(cal.getAttribute('data-layout-mode')).toBe('mini');
    });

    it('コンパクト→フルに戻せる', () => {
        render(<DetailQuantityCalendar item={null} globalFilter="all" />);
        const toggle = screen.getByTestId('density-toggle-btn');
        fireEvent.click(toggle);
        fireEvent.click(toggle);
        const cal = screen.getByTestId('mock-ryokan-calendar');
        expect(cal.getAttribute('data-layout-mode')).toBe('panorama');
    });

    it('密度設定が localStorage に保存される', () => {
        render(<DetailQuantityCalendar item={null} globalFilter="all" />);
        const toggle = screen.getByTestId('density-toggle-btn');
        fireEvent.click(toggle);
        expect(localStorage.getItem(DENSITY_KEY)).toBe('compact');
    });

    it('localStorage に "compact" がある場合コンパクトで初期化される', () => {
        localStorage.setItem(DENSITY_KEY, 'compact');
        render(<DetailQuantityCalendar item={null} globalFilter="all" />);
        const cal = screen.getByTestId('mock-ryokan-calendar');
        expect(cal.getAttribute('data-layout-mode')).toBe('mini');
    });

    it('フルモードでも外部イベントが RyokanCalendar へ伝播する', () => {
        const eventsMap = makeEventsMap(3);
        render(
            <DetailQuantityCalendar
                item={null}
                globalFilter="all"
                externalEventsByDate={eventsMap}
            />
        );
        const cal = screen.getByTestId('mock-ryokan-calendar');
        expect(cal.getAttribute('data-layout-mode')).toBe('panorama');
        expect(cal.getAttribute('data-external-count')).toBe('3');
    });

    it('コンパクトモードでも外部イベントが RyokanCalendar へ伝播する（本課題の核心）', () => {
        const eventsMap = makeEventsMap(2);
        render(
            <DetailQuantityCalendar
                item={null}
                globalFilter="all"
                externalEventsByDate={eventsMap}
            />
        );
        const toggle = screen.getByTestId('density-toggle-btn');
        fireEvent.click(toggle);

        const cal = screen.getByTestId('mock-ryokan-calendar');
        expect(cal.getAttribute('data-layout-mode')).toBe('mini');
        expect(cal.getAttribute('data-external-count')).toBe('2');
    });
});
