import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import { RyokanTimelineView } from '../RyokanTimelineView';

/**
 * R-042-Y3: タイムラインビューで lazy load 中（isLoadingMore=true）の場合、
 * `aria-label="読み込み中"` を持つスケルトン要素が描画されることを検証する。
 */

const makeAllDays = (): Date[] => {
    const days: Date[] = [];
    for (let d = 1; d <= 14; d++) {
        days.push(new Date(2026, 5, d));
    }
    return days;
};

describe('R-042-Y3: RyokanTimelineView のスケルトン表示', () => {
    it('isLoadingMore=true かつ loadDirection="after" のときスケルトン要素が描画される', () => {
        const { container } = render(
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
                isLoadingMore={true}
                loadDirection="after"
            />
        );
        const skeletons = container.querySelectorAll('[aria-label="読み込み中"]');
        expect(skeletons.length).toBeGreaterThanOrEqual(1);
    });
});
