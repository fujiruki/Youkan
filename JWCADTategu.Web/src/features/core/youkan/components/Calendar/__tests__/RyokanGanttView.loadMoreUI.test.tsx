import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { RyokanGanttView } from '../RyokanGanttView';
import { ToastProvider } from '../../../../../../contexts/ToastContext';

/**
 * R-050: ガントビューの無限スクロール体験に関する UI 検証。
 *
 * - 「読み込み済み範囲」のステータス表示があること
 * - 「もっと読み込む（後ろへ）」「もっと読み込む（前へ）」ボタンが配置されており、
 *   押下時に onLoadMore('after' | 'before', 3) が発火すること
 * - sentinel がスクロール末端（コンテンツ内）に配置されていること
 *   （R-042-Y2 の data-testid を継続使用）
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

describe('R-050: RyokanGanttView の無限スクロール UI', () => {
    it('「もっと読み込む（後ろへ）」ボタン押下で onLoadMore("after", 3) が呼ばれる', () => {
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

        const btn = screen.getByTestId('gantt-load-more-after');
        fireEvent.click(btn);

        expect(onLoadMore).toHaveBeenCalledWith('after', 3);
    });

    it('「もっと読み込む（前へ）」ボタン押下で onLoadMore("before", 3) が呼ばれる', () => {
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

        const btn = screen.getByTestId('gantt-load-more-before');
        fireEvent.click(btn);

        expect(onLoadMore).toHaveBeenCalledWith('before', 3);
    });

    it('isLoadingMore=true のとき「読み込み中」ステータスが表示される', () => {
        render(
            <ToastProvider>
                <RyokanGanttView
                    {...defaultProps}
                    onLoadMore={vi.fn()}
                    isLoadingMore={true}
                    loadDirection="after"
                />
            </ToastProvider>
        );

        const status = screen.getByTestId('gantt-load-status');
        expect(status.textContent || '').toMatch(/読み込み中/);
    });

    it('読み込み済み範囲が loadedRange から表示される', () => {
        render(
            <ToastProvider>
                <RyokanGanttView
                    {...defaultProps}
                    onLoadMore={vi.fn()}
                    isLoadingMore={false}
                    loadedRange={{ from: '2025-12-01', to: '2026-12-31' }}
                />
            </ToastProvider>
        );

        const status = screen.getByTestId('gantt-load-status');
        // 「2025-12 〜 2026-12」のように年月が表示されている想定
        expect(status.textContent || '').toMatch(/2025-12/);
        expect(status.textContent || '').toMatch(/2026-12/);
    });

    it('読み込み済み範囲が 24 ヶ月を超えると警告が表示され、後ろへボタンが disabled になる', () => {
        const onLoadMore = vi.fn();
        render(
            <ToastProvider>
                <RyokanGanttView
                    {...defaultProps}
                    onLoadMore={onLoadMore}
                    isLoadingMore={false}
                    loadedRange={{ from: '2024-01-01', to: '2026-12-31' }}
                />
            </ToastProvider>
        );

        const after = screen.getByTestId('gantt-load-more-after') as HTMLButtonElement;
        expect(after.disabled).toBe(true);

        const warn = screen.queryByTestId('gantt-load-limit-warning');
        expect(warn).not.toBeNull();
    });

    it('sentinel がスクロールコンテンツ本体（min-w-max ラッパー）の内側に配置されている', () => {
        const { container } = render(
            <ToastProvider>
                <RyokanGanttView
                    {...defaultProps}
                    onLoadMore={vi.fn()}
                    isLoadingMore={false}
                />
            </ToastProvider>
        );

        const before = container.querySelector('[data-testid="lazy-sentinel-before"]');
        const after = container.querySelector('[data-testid="lazy-sentinel-after"]');
        expect(before).not.toBeNull();
        expect(after).not.toBeNull();

        // R-050 真因対応: sentinel は absolute（コンテナ box 基準）ではなく、
        // スクロールするコンテンツの先頭/末尾にインラインで配置されていなければならない。
        // before の親に「min-w-max」を含むクラスがあれば、本体ラッパー直下にいると判定する。
        const findAncestorWithClass = (el: Element | null, cls: string): Element | null => {
            let cur = el?.parentElement || null;
            while (cur) {
                if (cur.className && typeof cur.className === 'string' && cur.className.includes(cls)) return cur;
                cur = cur.parentElement;
            }
            return null;
        };
        expect(findAncestorWithClass(before, 'min-w-max')).not.toBeNull();
        expect(findAncestorWithClass(after, 'min-w-max')).not.toBeNull();
    });
});
