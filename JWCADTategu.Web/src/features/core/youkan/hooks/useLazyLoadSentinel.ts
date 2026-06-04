import { useCallback, useEffect, useRef } from 'react';

/**
 * R-042-Y2: IntersectionObserver を用いた lazy load 発火用 sentinel フック。
 *
 * - スクロールコンテナの端（先頭・末尾など）に置いた目印要素が viewport（または指定 root）に
 *   交差したら `onIntersect()` を発火する
 * - `rootMargin` デフォルトは `'200px'`（議事録 2026-06-04 §4 採用案: 端から 200px 手前で +3 ヶ月）
 * - `enabled: false` のときは observer を作らず、`isLoadingMore` 中の二重発火を防ぐ用途で利用する
 * - 戻り値の ref callback を sentinel 要素の `ref` に渡すと observe／unobserve が自動で行われる
 *
 * 設計メモ:
 * - `onIntersect` のレファレンスは ref に逃がして observer 生成回数を抑える
 * - 古い要素・古い observer はクリーンアップする
 */

export interface UseLazyLoadSentinelOptions {
    /** 発火を有効化するか。false のとき observer は作らない */
    enabled: boolean;
    /** IntersectionObserver の rootMargin（既定: '200px'） */
    rootMargin?: string;
    /** root（既定: null = viewport） */
    root?: Element | Document | null;
    /** 交差時に呼ばれるコールバック */
    onIntersect: () => void;
}

export type LazyLoadSentinelRef = (node: HTMLElement | null) => void;

export const useLazyLoadSentinel = (
    options: UseLazyLoadSentinelOptions
): LazyLoadSentinelRef => {
    const { enabled, rootMargin = '200px', root = null, onIntersect } = options;

    const callbackRef = useRef(onIntersect);
    useEffect(() => {
        callbackRef.current = onIntersect;
    }, [onIntersect]);

    const observerRef = useRef<IntersectionObserver | null>(null);
    const elementRef = useRef<HTMLElement | null>(null);
    const mountedRef = useRef<boolean>(false);

    const disconnect = useCallback(() => {
        if (observerRef.current) {
            observerRef.current.disconnect();
            observerRef.current = null;
        }
    }, []);

    const attach = useCallback((node: HTMLElement | null) => {
        disconnect();
        if (!enabled || !node) return;
        if (typeof IntersectionObserver === 'undefined') return;
        const observer = new IntersectionObserver((entries) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    callbackRef.current();
                    break;
                }
            }
        }, { root: root ?? null, rootMargin });
        observer.observe(node);
        observerRef.current = observer;
    }, [enabled, rootMargin, root, disconnect]);

    const setRef = useCallback<LazyLoadSentinelRef>((node) => {
        elementRef.current = node;
        attach(node);
    }, [attach]);

    // 依存値が変わったときに既存要素を再 attach。初回マウントは ref callback 側で
    // すでに attach 済なのでスキップする。アンマウント時に observer を disconnect する。
    useEffect(() => {
        if (mountedRef.current) {
            attach(elementRef.current);
        } else {
            mountedRef.current = true;
        }
        return () => {
            disconnect();
        };
    }, [attach, disconnect]);

    return setRef;
};
