/**
 * R-042-Y3: lazy load 中の読み込みプレースホルダ。
 * `aria-label="読み込み中"` を持ち、テストからの検出と SR への通知を両立する。
 */
export const Skeleton = ({ className = '' }: { className?: string }) => (
    <div className={`animate-pulse bg-slate-200 dark:bg-slate-700 rounded ${className}`} aria-label="読み込み中" />
);
