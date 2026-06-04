import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RyokanTimelineView } from '../RyokanTimelineView';

/**
 * R-042-Y2: タイムラインビューの上端／下端（または左端／右端）に sentinel が配置されているかを検証する。
 */

const makeAllDays = (): Date[] => {
    const days: Date[] = [];
    for (let d = 1; d <= 14; d++) {
        days.push(new Date(2026, 5, d));
    }
    return days;
};

describe('R-042-Y2: RyokanTimelineView の lazy load sentinel 配置', () => {
    it('上端と下端に sentinel 要素が配置されている', () => {
        const onLoadMore = vi.fn();
        render(
            <RyokanTimelineView
                allDays={makeAllDays()}
                metrics={new Map()}
                heatMap={new Map()}
                today={new Date(2026, 5, 1)}
                isMini={false}
                flashingItemIds={new Set()}
                pressureConnections={[]}
                onAction={() => { }}
                renderItemTitle={() => ''}
                onLoadMore={onLoadMore}
                isLoadingMore={false}
            />
        );

        const before = screen.queryByTestId('lazy-sentinel-before');
        const after = screen.queryByTestId('lazy-sentinel-after');
        expect(before).not.toBeNull();
        expect(after).not.toBeNull();
    });
});
