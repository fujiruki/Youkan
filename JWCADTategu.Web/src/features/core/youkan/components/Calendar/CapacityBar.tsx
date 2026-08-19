import React from 'react';
import { cn } from '../../../../../lib/utils';

interface CapacityBarProps {
    /** その日のタスク合計時間（分）。done を含む */
    totalMinutes: number;
    /** うち完了済（status=done）の合計時間（分） */
    completedMinutes: number;
    /** その日のキャパシティ（分） */
    capacityMinutes: number;
    /** 追加クラス（任意） */
    className?: string;
    /** R-148: 母集団ラベル（例「タスクのみ／完了込／全体枠」）。指定時は title に出し、ホバーできるようにする */
    label?: string;
}

/**
 * 量感カレンダーのセル下端に表示する進捗棒グラフ（R-034 Phase 1, R-035）。
 *
 * - 100% 以下: 完了部分 `emerald-200`（淡）+ 未完了部分 `emerald-500`（濃）の 2 層
 * - 100% 超: 全体 `red-500` 一色
 * - 数値なし（即時性優先）。ツールチップは R-148 の母集団ラベル `label` 指定時のみ
 * - `absolute bottom-0 h-1` でセル下端 4px に被さる
 *
 * 既存背景ヒートマップとは独立に重ねて描画する。
 */
const CapacityBarComponent: React.FC<CapacityBarProps> = ({
    totalMinutes,
    completedMinutes,
    capacityMinutes,
    className,
    label
}) => {
    const root = (children: React.ReactNode) => (
        <div
            data-testid="capacity-bar"
            title={label}
            className={cn(
                'absolute bottom-0 left-0 right-0 h-1 flex overflow-hidden z-10',
                label ? 'pointer-events-auto' : 'pointer-events-none',
                className
            )}
        >
            {children}
        </div>
    );

    // ゼロ除算回避: キャパシティ 0（休日等）のときは描画しない
    if (capacityMinutes <= 0) {
        return root(null);
    }

    const safeTotal = Math.max(0, totalMinutes);
    const safeCompleted = Math.max(0, Math.min(completedMinutes, safeTotal));
    const ratio = safeTotal / capacityMinutes;

    // 100% 超: 全体を赤一色で 100% 描画（事実重視・即時性優先）
    if (ratio > 1) {
        return root(
            <div
                data-testid="capacity-bar-fill-over"
                className="bg-red-500 h-full"
                style={{ width: '100%' }}
            />
        );
    }

    // 100% 以下: 完了 + 未完了の 2 層
    const completedPct = (safeCompleted / capacityMinutes) * 100;
    const remainingPct = ((safeTotal - safeCompleted) / capacityMinutes) * 100;

    return root(
        <>
            {completedPct > 0 && (
                <div
                    data-testid="capacity-bar-fill-completed"
                    className="bg-emerald-200 h-full"
                    style={{ width: `${completedPct}%` }}
                />
            )}
            {remainingPct > 0 && (
                <div
                    data-testid="capacity-bar-fill-remaining"
                    className="bg-emerald-500 h-full"
                    style={{ width: `${remainingPct}%` }}
                />
            )}
        </>
    );
};

export const CapacityBar = React.memo(CapacityBarComponent);
