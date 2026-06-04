import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-042-Y3: ガントビューで lazy load 中（isLoadingMore=true）の場合、
 * `aria-label="読み込み中"` を持つスケルトン要素が描画されることを検証する。
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

describe('R-042-Y3: RyokanGanttView のスケルトン表示', () => {
    it('isLoadingMore=true かつ loadDirection="after" のときスケルトン要素が描画される', () => {
        const { container } = render(
            <ToastProvider>
                <RyokanGanttView
                    {...defaultProps}
                    isLoadingMore={true}
                    loadDirection="after"
                />
            </ToastProvider>
        );
        const skeletons = container.querySelectorAll('[aria-label="読み込み中"]');
        expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });
});
