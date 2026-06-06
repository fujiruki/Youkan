import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { RyokanTimelineView } from '../RyokanTimelineView';

/**
 * R-054: タイムラインビューの sentinel 配置と lazy load 発火検証。
 *
 * 真因: R-042-Y2 で配置した sentinel が scrollRef 直下に absolute 配置されており、
 * 親コンテナの box 基準で固定されたまま横スクロールに追従しないため
 * IntersectionObserver が初回 fire 以降は永久に発火しなくなる不具合があった。
 * R-050 のガントビュー修正と同じパターンで `min-w-max` 内側に移設したことを確認する。
 */

const makeAllDays = (): Date[] => {
    const days: Date[] = [];
    for (let d = 1; d <= 14; d++) {
        days.push(new Date(2026, 5, d));
    }
    return days;
};

const baseProps = {
    allDays: makeAllDays(),
    metrics: new Map(),
    heatMap: new Map(),
    today: new Date(2026, 5, 1),
    flashingItemIds: new Set<string>(),
    pressureConnections: [],
    onAction: () => { },
    renderItemTitle: () => '',
};

describe('R-054: RyokanTimelineView の sentinel 配置と lazy load 発火', () => {
    it('横表示時、sentinel がスクロールコンテンツ本体（min-w-max ラッパー）の内側に配置されている', () => {
        const { container } = render(
            <RyokanTimelineView
                {...baseProps}
                isMini={false}
                onLoadMore={vi.fn()}
                isLoadingMore={false}
            />
        );

        const before = container.querySelector('[data-testid="lazy-sentinel-before"]');
        const after = container.querySelector('[data-testid="lazy-sentinel-after"]');
        expect(before).not.toBeNull();
        expect(after).not.toBeNull();

        // R-054 真因対応: sentinel は absolute（スクロールコンテナ box 基準）ではなく、
        // スクロールするコンテンツの先頭/末尾にインライン配置されていなければならない。
        // before の祖先に「min-w-max」を含むクラスがあれば、本体ラッパー直下にいると判定する。
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

    it('縦表示（isMini=true）時も sentinel がスクロールコンテンツ本体の内側に配置されている', () => {
        const { container } = render(
            <RyokanTimelineView
                {...baseProps}
                isMini={true}
                onLoadMore={vi.fn()}
                isLoadingMore={false}
            />
        );

        const before = container.querySelector('[data-testid="lazy-sentinel-before"]');
        const after = container.querySelector('[data-testid="lazy-sentinel-after"]');
        expect(before).not.toBeNull();
        expect(after).not.toBeNull();

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

    it('sentinel が交差したとき onLoadMore が "before" 方向に LAZY_LOAD_MONTHS=3 で呼ばれる', () => {
        // jsdom の IntersectionObserver をモックして手動で発火させる
        const observers: Array<{ cb: IntersectionObserverCallback; target: Element | null }> = [];
        class MockIO {
            cb: IntersectionObserverCallback;
            target: Element | null = null;
            constructor(cb: IntersectionObserverCallback) {
                this.cb = cb;
                observers.push(this);
            }
            observe(el: Element) { this.target = el; }
            unobserve() { }
            disconnect() { }
            takeRecords() { return []; }
        }
        const origIO = (globalThis as any).IntersectionObserver;
        (globalThis as any).IntersectionObserver = MockIO as any;

        try {
            const onLoadMore = vi.fn();
            render(
                <RyokanTimelineView
                    {...baseProps}
                    isMini={false}
                    onLoadMore={onLoadMore}
                    isLoadingMore={false}
                />
            );

            const beforeEl = screen.getByTestId('lazy-sentinel-before');
            const beforeObserver = observers.find(o => o.target === beforeEl);
            expect(beforeObserver).toBeDefined();

            // 交差イベントを発火させる
            const fakeEntry = {
                isIntersecting: true,
                target: beforeEl,
                intersectionRatio: 1,
                boundingClientRect: beforeEl.getBoundingClientRect(),
                intersectionRect: beforeEl.getBoundingClientRect(),
                rootBounds: null,
                time: 0,
            } as unknown as IntersectionObserverEntry;
            beforeObserver!.cb([fakeEntry], {} as IntersectionObserver);

            expect(onLoadMore).toHaveBeenCalledWith('before', 3);
        } finally {
            (globalThis as any).IntersectionObserver = origIO;
        }
    });

    it('sentinel が交差したとき onLoadMore が "after" 方向に LAZY_LOAD_MONTHS=3 で呼ばれる', () => {
        const observers: Array<{ cb: IntersectionObserverCallback; target: Element | null }> = [];
        class MockIO {
            cb: IntersectionObserverCallback;
            target: Element | null = null;
            constructor(cb: IntersectionObserverCallback) {
                this.cb = cb;
                observers.push(this);
            }
            observe(el: Element) { this.target = el; }
            unobserve() { }
            disconnect() { }
            takeRecords() { return []; }
        }
        const origIO = (globalThis as any).IntersectionObserver;
        (globalThis as any).IntersectionObserver = MockIO as any;

        try {
            const onLoadMore = vi.fn();
            render(
                <RyokanTimelineView
                    {...baseProps}
                    isMini={false}
                    onLoadMore={onLoadMore}
                    isLoadingMore={false}
                />
            );

            const afterEl = screen.getByTestId('lazy-sentinel-after');
            const afterObserver = observers.find(o => o.target === afterEl);
            expect(afterObserver).toBeDefined();

            const fakeEntry = {
                isIntersecting: true,
                target: afterEl,
                intersectionRatio: 1,
                boundingClientRect: afterEl.getBoundingClientRect(),
                intersectionRect: afterEl.getBoundingClientRect(),
                rootBounds: null,
                time: 0,
            } as unknown as IntersectionObserverEntry;
            afterObserver!.cb([fakeEntry], {} as IntersectionObserver);

            expect(onLoadMore).toHaveBeenCalledWith('after', 3);
        } finally {
            (globalThis as any).IntersectionObserver = origIO;
        }
    });
});
