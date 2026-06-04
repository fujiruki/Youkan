import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RyokanGridView } from '../RyokanGridView';

/**
 * R-042-Y2: グリッドビューのスクロールコンテナ先頭・末尾に sentinel が配置されているかを検証する。
 *
 * - data-testid="lazy-sentinel-before" と data-testid="lazy-sentinel-after" の 2 要素が存在する
 * - onLoadMore が props として渡されていない場合でも DOM 構造は壊さない（任意 props）
 */

const makeAllDays = (): Date[] => {
    const days: Date[] = [];
    for (let d = 1; d <= 14; d++) {
        days.push(new Date(2026, 5, d));
    }
    return days;
};

describe('R-042-Y2: RyokanGridView の lazy load sentinel 配置', () => {
    it('スクロールコンテナの先頭と末尾に sentinel 要素が配置されている', () => {
        const onLoadMore = vi.fn();
        render(
            <RyokanGridView
                allDays={makeAllDays()}
                metrics={new Map()}
                heatMap={new Map()}
                today={new Date(2026, 5, 1)}
                onAction={() => { }}
                renderItemTitle={() => ''}
                flashingIds={new Set()}
                onLoadMore={onLoadMore}
                isLoadingMore={false}
            />
        );

        const before = screen.queryByTestId('lazy-sentinel-before');
        const after = screen.queryByTestId('lazy-sentinel-after');
        expect(before).not.toBeNull();
        expect(after).not.toBeNull();
    });

    it('onLoadMore 未指定でも render が壊れない', () => {
        render(
            <RyokanGridView
                allDays={makeAllDays()}
                metrics={new Map()}
                heatMap={new Map()}
                today={new Date(2026, 5, 1)}
                onAction={() => { }}
                renderItemTitle={() => ''}
                flashingIds={new Set()}
            />
        );
        expect(screen.queryByTestId('lazy-sentinel-before')).not.toBeNull();
    });
});
