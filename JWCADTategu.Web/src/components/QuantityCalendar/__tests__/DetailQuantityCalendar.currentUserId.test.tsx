/**
 * R-137: DetailQuantityCalendar は currentUserId prop をそのまま RyokanCalendar に渡す。
 * localStorage['youkan_user']（Cookieセッション認証では常に空）へのフォールバックを廃止しても、
 * currentUserId prop の値がそのまま伝播することを確認する。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { DetailQuantityCalendar } from '../DetailQuantityCalendar';

vi.mock('../../../features/core/youkan/components/Calendar/RyokanCalendar', () => {
    const React = require('react');
    return {
        RyokanCalendar: ({ currentUserId }: { currentUserId?: string | null }) => {
            return React.createElement('div', {
                'data-testid': 'mock-ryokan-calendar',
                'data-current-user-id': currentUserId ?? '',
            });
        },
    };
});

vi.mock('../../../contexts/ToastContext', () => ({
    useToast: () => ({ showToast: vi.fn() }),
}));

describe('R-137: DetailQuantityCalendar の currentUserId 伝播', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    it('localStorageにyoukan_userが無くても、currentUserId propの値がそのままRyokanCalendarへ渡る', () => {
        render(
            <DetailQuantityCalendar
                item={null}
                globalFilter="all"
                currentUserId="test-user"
            />
        );

        expect(screen.getByTestId('mock-ryokan-calendar').getAttribute('data-current-user-id')).toBe('test-user');
    });

    it('currentUserId propが未指定なら、localStorageにフォールバックせずnull相当のまま渡る', () => {
        render(
            <DetailQuantityCalendar
                item={null}
                globalFilter="all"
            />
        );

        expect(screen.getByTestId('mock-ryokan-calendar').getAttribute('data-current-user-id')).toBe('');
    });
});
