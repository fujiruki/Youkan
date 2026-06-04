import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-042-Y2: ガントビュー（横スクロール）の日付列左端・右端付近に sentinel が配置されているかを検証する。
 *
 * - data-testid="lazy-sentinel-before" と data-testid="lazy-sentinel-after" の 2 要素が存在する
 */

const makeAllDays = (): Date[] => {
    const days: Date[] = [];
    for (let d = 1; d <= 14; d++) {
        days.push(new Date(2026, 5, d));
    }
    return days;
};

const defaultProps = {
    allDays: makeAllDays(),
    items: [],
    heatMap: new Map(),
    today: new Date(2026, 5, 1),
    safeConfig: {},
    rowHeight: 40,
    projects: [],
    renderItemTitle: () => '',
    showGroups: false,
};

describe('R-042-Y2: RyokanGanttView の lazy load sentinel 配置', () => {
    it('日付列の左端・右端に sentinel 要素が配置されている', () => {
        const onLoadMore = vi.fn();
        render(
            <ToastProvider>
                <RyokanGanttView
                    {...defaultProps}
                    onLoadMore={onLoadMore}
                    isLoadingMore={false}
                />
            </ToastProvider>
        );

        const before = screen.queryByTestId('lazy-sentinel-before');
        const after = screen.queryByTestId('lazy-sentinel-after');
        expect(before).not.toBeNull();
        expect(after).not.toBeNull();
    });
});
