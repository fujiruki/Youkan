import React from 'react';
import { ChevronLeft, ChevronRight, CalendarDays, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '../../../../../lib/utils';

interface GanttHeaderProps {
    /** 現在表示中の年月 (スクロール連動) */
    visibleDate: Date;
    /** 前月へスクロール */
    onPrevMonth: () => void;
    /** 次月へスクロール */
    onNextMonth: () => void;
    /** 今月を中央に表示 */
    onGoToCurrentMonth: () => void;
    /** 日次キャパシティ設定を開く */
    onOpenDailySettings: () => void;
    /** 密度スライダー */
    rowHeight: number;
    onRowHeightChange: (value: number) => void;
}

export const GanttHeader: React.FC<GanttHeaderProps> = ({
    visibleDate,
    onPrevMonth,
    onNextMonth,
    onGoToCurrentMonth,
    onOpenDailySettings,
    rowHeight,
    onRowHeightChange
}) => {
    const today = new Date();
    const isCurrentMonth =
        visibleDate.getFullYear() === today.getFullYear() &&
        visibleDate.getMonth() === today.getMonth();

    return (
        <div className="shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-b border-slate-200 dark:border-slate-800 px-4 py-1.5 flex items-center justify-between z-10">
            {/* Left: Month Navigation */}
            <div className="flex items-center gap-1">
                <button
                    onClick={onPrevMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="前月"
                >
                    <ChevronLeft size={16} />
                </button>

                <div className="min-w-[100px] text-center">
                    <span className="text-sm font-black tracking-tight text-slate-700 dark:text-slate-200">
                        {format(visibleDate, 'yyyy年 M月', { locale: ja })}
                    </span>
                </div>

                <button
                    onClick={onNextMonth}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
                    title="次月"
                >
                    <ChevronRight size={16} />
                </button>

                <button
                    onClick={onGoToCurrentMonth}
                    className={cn(
                        "ml-1 px-2.5 py-1 text-[10px] font-bold rounded-full border transition-all",
                        isCurrentMonth
                            ? "bg-blue-50 dark:bg-blue-900/30 text-blue-400 border-blue-200 dark:border-blue-700 cursor-default opacity-50"
                            : "bg-white dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 hover:border-blue-300"
                    )}
                    disabled={isCurrentMonth}
                    title="今月を表示"
                >
                    <CalendarDays size={10} className="inline mr-1" />
                    今月
                </button>
            </div>

            {/* Right: Controls */}
            <div className="flex items-center gap-3">
                {/* Density Slider */}
                <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">密度</span>
                    <input
                        type="range"
                        min="12"
                        max="32"
                        value={rowHeight}
                        onChange={(e) => onRowHeightChange(parseInt(e.target.value))}
                        className="w-16 accent-indigo-600 h-1.5 cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-slate-500 w-4">{rowHeight}</span>
                </div>

                {/* Daily Settings Button */}
                <button
                    onClick={onOpenDailySettings}
                    className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors border border-slate-200 dark:border-slate-600"
                    title="日次稼働設定"
                >
                    <Settings className="w-3 h-3" />
                    <span>日次設定</span>
                </button>
            </div>
        </div>
    );
};
