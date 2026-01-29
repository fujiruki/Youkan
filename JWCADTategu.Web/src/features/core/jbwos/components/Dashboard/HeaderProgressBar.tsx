import React from 'react';
import { cn } from '../../../../../lib/utils';

interface HeaderProgressBarProps {
    usedMinutes: number;
    limitMinutes: number;
    className?: string;
}

/**
 * 0:00 - 24:00 のタイムバーを表示するヘッダープログレスバー
 * 超高密度表示に対応し、1日の負荷状況を視覚化する。
 */
export const HeaderProgressBar: React.FC<HeaderProgressBarProps> = ({
    usedMinutes,
    limitMinutes,
    className
}) => {
    const progress = Math.min((usedMinutes / limitMinutes) * 100, 100);
    const isOver = usedMinutes > limitMinutes;

    return (
        <div className={cn("sticky top-0 z-50 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 py-2 shadow-sm", className)}>
            <div className="max-w-3xl mx-auto">
                <div className="flex justify-between items-center mb-1">
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">今日のリソース</span>
                        <span className={cn(
                            "text-xs font-mono font-bold",
                            isOver ? "text-red-500" : "text-indigo-600"
                        )}>
                            {usedMinutes} / {limitMinutes} min
                        </span>
                    </div>
                    <div className="text-[10px] font-mono text-slate-400">
                        {Math.round(progress)}%
                    </div>
                </div>

                {/* 24h Time Bar */}
                <div className="relative h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                    {/* Capacity Progress (Bg layer) */}
                    <div
                        className={cn(
                            "absolute top-0 left-0 h-full transition-all duration-500",
                            isOver ? "bg-red-400" : "bg-indigo-400"
                        )}
                        style={{ width: `${progress}%`, opacity: 0.3 }}
                    />

                    {/* Time Scale Blocks (Visual Only) */}
                    <div className="absolute inset-0 flex gap-[1px] px-[2px]">
                        {Array.from({ length: 24 }).map((_, i) => {
                            const isWorkingHour = i >= 8 && i <= 18; // 8:00 - 18:00

                            return (
                                <div
                                    key={i}
                                    className={cn(
                                        "h-full flex-1 transition-colors",
                                        isWorkingHour ? "bg-slate-200/50 dark:bg-slate-700/30" : "bg-transparent"
                                    )}
                                    title={`${i}:00`}
                                />
                            );
                        })}
                    </div>
                </div>

                {/* 24h labels (Simplified) */}
                <div className="flex justify-between mt-1 px-1">
                    {['0', '6', '12', '18', '24'].map(h => (
                        <span key={h} className="text-[8px] font-mono text-slate-300 dark:text-slate-600">{h}h</span>
                    ))}
                </div>
            </div>
        </div>
    );
};
