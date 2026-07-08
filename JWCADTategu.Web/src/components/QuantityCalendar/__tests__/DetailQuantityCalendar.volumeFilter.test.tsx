/**
 * R-062: DetailQuantityCalendar 量感母集団フィルタテスト
 *
 * アイテム詳細画面のカレンダーで量感の母集団を
 * 左上フィルタ（全て/個人/会社）にのみ連動させ、
 * アイテムの所属プロジェクト/テナントで量感を絞り込まないことを検証する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { DetailQuantityCalendar } from '../DetailQuantityCalendar';
import { Item } from '../../../features/core/youkan/types';
import { ExternalEvent } from '../../../features/core/youkan/types/externalEvent';

type MockRyokanCalendarProps = {
    focusedTenantId?: string;
    focusedProjectId?: string;
    filterMode?: string;
    items?: Item[];
    volumeOnly?: boolean;
    externalEventsByDate?: Map<string, ExternalEvent[]>;
};

const capturedProps: MockRyokanCalendarProps[] = [];

vi.mock('../../../features/core/youkan/components/Calendar/RyokanCalendar', () => {
    const React = require('react');
    return {
        RyokanCalendar: (props: MockRyokanCalendarProps) => {
            capturedProps.push(props);
            const externalCount = props.externalEventsByDate
                ? Array.from(props.externalEventsByDate.values()).reduce((s, arr) => s + arr.length, 0)
                : 0;
            return React.createElement('div', {
                'data-testid': 'mock-ryokan-calendar',
                'data-focused-tenant-id': props.focusedTenantId ?? '__undefined__',
                'data-focused-project-id': props.focusedProjectId ?? '__undefined__',
                'data-filter-mode': props.filterMode ?? '',
                'data-items-count': String(props.items?.length ?? 0),
                'data-volume-only': String(props.volumeOnly ?? false),
                'data-external-count': String(externalCount),
            });
        },
    };
});

vi.mock('../../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

const makeItem = (override: Partial<Item> = {}): Item => ({
    id: 'item-1',
    title: 'テストアイテム',
    type: 'task',
    status: 'todo',
    domain: 'private',
    tenantId: undefined,
    projectId: undefined,
    ...override,
} as unknown as Item);

const TODAY_KEY = (() => {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
})();

describe('DetailQuantityCalendar — 量感母集団フィルタ (R-062)', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        capturedProps.length = 0;
    });

    describe('focusedTenantId/focusedProjectId は常に undefined', () => {
        it('詳細カレンダーはデフォルトで量感のみ表示になる', () => {
            render(
                <DetailQuantityCalendar
                    item={null}
                    globalFilter="all"
                />
            );

            const cal = screen.getByTestId('mock-ryokan-calendar');
            expect(cal.getAttribute('data-volume-only')).toBe('true');
        });

        it('アイテムが projectId を持っていても focusedProjectId は undefined で渡る', () => {
            const item = makeItem({ projectId: 'proj-123', tenantId: undefined });

            render(
                <DetailQuantityCalendar
                    item={item}
                    globalFilter="all"
                />
            );

            const cal = screen.getByTestId('mock-ryokan-calendar');
            expect(cal.getAttribute('data-focused-project-id')).toBe('__undefined__');
        });

        it('アイテムが tenantId を持っていても focusedTenantId は undefined で渡る', () => {
            const item = makeItem({ tenantId: 'tenant-abc', projectId: undefined });

            render(
                <DetailQuantityCalendar
                    item={item}
                    globalFilter="all"
                />
            );

            const cal = screen.getByTestId('mock-ryokan-calendar');
            expect(cal.getAttribute('data-focused-tenant-id')).toBe('__undefined__');
        });

        it('アイテムが projectId も tenantId も持っていても両方 undefined で渡る', () => {
            const item = makeItem({ projectId: 'proj-999', tenantId: 'tenant-999' });

            render(
                <DetailQuantityCalendar
                    item={item}
                    globalFilter="all"
                />
            );

            const cal = screen.getByTestId('mock-ryokan-calendar');
            expect(cal.getAttribute('data-focused-project-id')).toBe('__undefined__');
            expect(cal.getAttribute('data-focused-tenant-id')).toBe('__undefined__');
        });

        it('item が null でも focusedProjectId/focusedTenantId は undefined', () => {
            render(
                <DetailQuantityCalendar
                    item={null}
                    globalFilter="all"
                />
            );

            const cal = screen.getByTestId('mock-ryokan-calendar');
            expect(cal.getAttribute('data-focused-project-id')).toBe('__undefined__');
            expect(cal.getAttribute('data-focused-tenant-id')).toBe('__undefined__');
        });
    });

    describe('左上フィルタ切替で filteredItems が変わる', () => {
        const personalItem = makeItem({ id: 'p1', domain: 'private', tenantId: undefined });
        const companyItem = makeItem({ id: 'c1', domain: 'business', tenantId: 'tenant-1' });
        const allItems = [personalItem, companyItem];

        it('フィルタ「全て」で全アイテムが渡る', () => {
            render(
                <DetailQuantityCalendar
                    item={null}
                    globalFilter="all"
                    items={allItems}
                />
            );

            const cal = screen.getByTestId('mock-ryokan-calendar');
            expect(cal.getAttribute('data-items-count')).toBe('2');
        });

        it('フィルタ「個人」切替で個人アイテムのみ渡る', () => {
            render(
                <DetailQuantityCalendar
                    item={null}
                    globalFilter="all"
                    items={allItems}
                />
            );

            fireEvent.click(screen.getByText('個人'));
            const cal = screen.getByTestId('mock-ryokan-calendar');
            expect(cal.getAttribute('data-items-count')).toBe('1');
            expect(cal.getAttribute('data-filter-mode')).toBe('personal');
        });

        it('フィルタ「会社」切替で会社アイテムのみ渡る', () => {
            render(
                <DetailQuantityCalendar
                    item={null}
                    globalFilter="all"
                    items={allItems}
                />
            );

            fireEvent.click(screen.getByText('会社'));
            const cal = screen.getByTestId('mock-ryokan-calendar');
            expect(cal.getAttribute('data-items-count')).toBe('1');
            expect(cal.getAttribute('data-filter-mode')).toBe('company');
        });
    });

    describe('externalEventsByDate はフィルタ切替の影響を受けない', () => {
        it('フィルタ「個人」に切り替えても externalEventsByDate は変わらない', () => {
            const eventsMap = new Map<string, ExternalEvent[]>();
            eventsMap.set(TODAY_KEY, [
                {
                    id: 'ev1',
                    calendarId: 'primary',
                    eventId: 'ev1',
                    startAt: Math.floor(Date.now() / 1000),
                    endAt: Math.floor(Date.now() / 1000) + 3600,
                    allDay: false,
                    title: 'テスト予定',
                    location: null,
                    htmlLink: null,
                },
            ]);

            const personalItem = makeItem({ id: 'p1', domain: 'private', tenantId: undefined });
            const companyItem = makeItem({ id: 'c1', domain: 'business', tenantId: 'tenant-1' });

            render(
                <DetailQuantityCalendar
                    item={null}
                    globalFilter="all"
                    items={[personalItem, companyItem]}
                    externalEventsByDate={eventsMap}
                />
            );

            // フィルタ切替前
            expect(screen.getByTestId('mock-ryokan-calendar').getAttribute('data-external-count')).toBe('1');

            // 個人フィルタに切替
            fireEvent.click(screen.getByText('個人'));
            // items は絞られるが externalEventsByDate は変わらない
            expect(screen.getByTestId('mock-ryokan-calendar').getAttribute('data-external-count')).toBe('1');
            expect(screen.getByTestId('mock-ryokan-calendar').getAttribute('data-items-count')).toBe('1');
        });

        it('フィルタ「会社」に切り替えても externalEventsByDate は変わらない', () => {
            const eventsMap = new Map<string, ExternalEvent[]>();
            eventsMap.set(TODAY_KEY, [
                {
                    id: 'ev2',
                    calendarId: 'primary',
                    eventId: 'ev2',
                    startAt: Math.floor(Date.now() / 1000),
                    endAt: Math.floor(Date.now() / 1000) + 3600,
                    allDay: false,
                    title: 'テスト予定2',
                    location: null,
                    htmlLink: null,
                },
            ]);

            const personalItem = makeItem({ id: 'p1', domain: 'private', tenantId: undefined });
            const companyItem = makeItem({ id: 'c1', domain: 'business', tenantId: 'tenant-1' });

            render(
                <DetailQuantityCalendar
                    item={null}
                    globalFilter="all"
                    items={[personalItem, companyItem]}
                    externalEventsByDate={eventsMap}
                />
            );

            fireEvent.click(screen.getByText('会社'));
            expect(screen.getByTestId('mock-ryokan-calendar').getAttribute('data-external-count')).toBe('1');
            expect(screen.getByTestId('mock-ryokan-calendar').getAttribute('data-items-count')).toBe('1');
        });
    });
});
