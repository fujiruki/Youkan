import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { useLazyLoadSentinel } from '../useLazyLoadSentinel';

/**
 * R-042-Y2: IntersectionObserver による lazy load sentinel フックの単体テスト。
 *
 * - 要素が viewport（root）に交差したら `onIntersect()` が発火する
 * - `enabled: false` のときは observe しない（発火しない）
 * - 既に発火中（外側から `enabled: false` を渡される想定）のとき再発火しない
 * - `rootMargin` のデフォルトは `'200px'`（議事録 §4 採用案: 端から 200px 手前）
 * - ref callback で要素を切り替えると、古い observer はクリーンアップされる
 */

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

interface MockObserverInstance {
    callback: ObserverCallback;
    options: IntersectionObserverInit | undefined;
    observed: Element[];
    trigger: (isIntersecting: boolean) => void;
    disconnected: boolean;
}

let observers: MockObserverInstance[] = [];

class MockIntersectionObserver implements IntersectionObserver {
    readonly root: Element | Document | null = null;
    readonly rootMargin: string = '';
    readonly thresholds: ReadonlyArray<number> = [];
    private instance: MockObserverInstance;

    constructor(callback: ObserverCallback, options?: IntersectionObserverInit) {
        this.instance = {
            callback,
            options,
            observed: [],
            trigger: (isIntersecting: boolean) => {
                if (this.instance.disconnected) return;
                const entries = this.instance.observed.map(target => ({
                    isIntersecting,
                    target,
                    boundingClientRect: target.getBoundingClientRect(),
                    intersectionRatio: isIntersecting ? 1 : 0,
                    intersectionRect: target.getBoundingClientRect(),
                    rootBounds: null,
                    time: Date.now(),
                } as IntersectionObserverEntry));
                callback(entries, this as unknown as IntersectionObserver);
            },
            disconnected: false,
        };
        this.rootMargin = options?.rootMargin ?? '';
        observers.push(this.instance);
    }

    observe(target: Element): void {
        this.instance.observed.push(target);
    }
    unobserve(target: Element): void {
        this.instance.observed = this.instance.observed.filter(el => el !== target);
    }
    disconnect(): void {
        this.instance.observed = [];
        this.instance.disconnected = true;
    }
    takeRecords(): IntersectionObserverEntry[] { return []; }
}

const TestHarness: React.FC<{
    enabled: boolean;
    onIntersect: () => void;
    rootMargin?: string;
    mountElement?: boolean;
}> = ({ enabled, onIntersect, rootMargin, mountElement = true }) => {
    const setRef = useLazyLoadSentinel({ enabled, onIntersect, rootMargin });
    return mountElement ? <div data-testid="sentinel" ref={setRef} /> : null;
};

describe('useLazyLoadSentinel', () => {
    beforeEach(() => {
        observers = [];
        (global as any).IntersectionObserver = MockIntersectionObserver;
    });

    afterEach(() => {
        observers = [];
    });

    it('要素が viewport に交差すると onIntersect が呼ばれる', () => {
        const onIntersect = vi.fn();
        render(<TestHarness enabled={true} onIntersect={onIntersect} />);

        expect(observers.length).toBe(1);
        act(() => {
            observers[0].trigger(true);
        });
        expect(onIntersect).toHaveBeenCalledTimes(1);
    });

    it('rootMargin のデフォルトは "200px"', () => {
        render(<TestHarness enabled={true} onIntersect={() => { }} />);
        expect(observers[0].options?.rootMargin).toBe('200px');
    });

    it('rootMargin を明示指定すればその値が IntersectionObserver に渡される', () => {
        render(<TestHarness enabled={true} onIntersect={() => { }} rootMargin="400px 0px" />);
        expect(observers[0].options?.rootMargin).toBe('400px 0px');
    });

    it('enabled が false のときは observer を作らず onIntersect も発火しない', () => {
        const onIntersect = vi.fn();
        render(<TestHarness enabled={false} onIntersect={onIntersect} />);

        expect(observers.length).toBe(0);
        expect(onIntersect).not.toHaveBeenCalled();
    });

    it('isIntersecting=false の通知では onIntersect は発火しない', () => {
        const onIntersect = vi.fn();
        render(<TestHarness enabled={true} onIntersect={onIntersect} />);

        act(() => {
            observers[0].trigger(false);
        });
        expect(onIntersect).not.toHaveBeenCalled();
    });

    it('enabled が true→false に変わると既存 observer は disconnect される', () => {
        const onIntersect = vi.fn();
        const { rerender } = render(<TestHarness enabled={true} onIntersect={onIntersect} />);
        expect(observers.length).toBe(1);
        const first = observers[0];
        expect(first.disconnected).toBe(false);

        rerender(<TestHarness enabled={false} onIntersect={onIntersect} />);
        expect(first.disconnected).toBe(true);

        // disconnected な observer から発火されても onIntersect は呼ばれない
        act(() => first.trigger(true));
        expect(onIntersect).not.toHaveBeenCalled();
    });

    it('enabled が false のあいだに来た intersect 通知では発火しない（二重発火防止用）', () => {
        const onIntersect = vi.fn();
        // 1 回目: enabled=true で observe
        const { rerender } = render(<TestHarness enabled={true} onIntersect={onIntersect} />);
        const first = observers[0];

        // enabled を false に切り替え → disconnect 済になる
        rerender(<TestHarness enabled={false} onIntersect={onIntersect} />);
        act(() => first.trigger(true));
        expect(onIntersect).not.toHaveBeenCalled();
    });

    it('アンマウント時に observer は disconnect される', () => {
        const onIntersect = vi.fn();
        const { unmount } = render(<TestHarness enabled={true} onIntersect={onIntersect} />);
        const first = observers[0];
        expect(first.disconnected).toBe(false);

        unmount();
        expect(first.disconnected).toBe(true);
    });
});
