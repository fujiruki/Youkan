import { ChevronLeft, ChevronRight, CalendarDays, Settings, LayoutGrid, List } from 'lucide-react';
import { format, isValid } from 'date-fns';
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
    /** グループ表示の切替 */
    showGroups: boolean;
    onShowGroupsChange: (value: boolean) => void;
}

export const GanttHeader: React.FC<GanttHeaderProps> = ({
    visibleDate: _visibleDate,
    onPrevMonth,
    onNextMonth,
    onGoToCurrentMonth,
    onOpenDailySettings,
    rowHeight,
    onRowHeightChange,
    showGroups,
    onShowGroupsChange
}) => {
    const today = new Date();
    // Safety check for invalid dates to prevent "Invalid time value" crash
    const visibleDate = isValid(_visibleDate) ? _visibleDate : today;

    const isCurrentMonth =
        visibleDate.getFullYear() === today.getFullYear() &&
        visibleDate.getMonth() === today.getMonth();

    return (
        <div className="shrink-0 bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center justify-between z-30 shadow-sm relative">
            {/* Left Section: Context & Navigation */}
            <div className="flex items-center gap-4">
                {/* View Title & Navigation */}
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                        onClick={onPrevMonth}
                        className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-all active:scale-95 shadow-none hover:shadow-sm"
                        title="前月"
                    >
                        <ChevronLeft size={18} strokeWidth={2.5} />
                    </button>

                    <div className="px-3 min-w-[120px] text-center">
                        <div className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] leading-none mb-0.5">
                            {format(visibleDate, 'yyyy')}
                        </div>
                        <div className="text-sm font-black text-slate-800 dark:text-white tracking-tight">
                            {format(visibleDate, 'M月', { locale: ja })}
                        </div>
                    </div>

                    <button
                        onClick={onNextMonth}
                        className="p-1.5 rounded-lg hover:bg-white dark:hover:bg-slate-800 text-slate-500 hover:text-indigo-600 dark:text-slate-400 dark:hover:text-indigo-400 transition-all active:scale-95 shadow-none hover:shadow-sm"
                        title="次月"
                    >
                        <ChevronRight size={18} strokeWidth={2.5} />
                    </button>
                </div>

                {/* Quick Shortcuts */}
                <div className="flex items-center gap-1">
                    <button
                        onClick={onGoToCurrentMonth}
                        className={cn(
                            "group flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-black rounded-xl border transition-all duration-300",
                            isCurrentMonth
                                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-500 border-indigo-100 dark:border-indigo-800/50 cursor-default"
                                : "bg-white dark:bg-slate-900 text-slate-500 border-slate-200 dark:border-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 hover:text-indigo-600 dark:hover:text-indigo-400 shadow-sm"
                        )}
                        disabled={isCurrentMonth}
                    >
                        <CalendarDays size={12} className={cn("transition-transform group-hover:scale-110", isCurrentMonth ? "text-indigo-400" : "text-slate-400 group-hover:text-indigo-500")} />
                        今月を表示
                    </button>
                </div>
            </div>

            {/* Middle: Optional Branding or Center Content could go here */}

            {/* Right Section: Display Controls */}
            <div className="flex items-center gap-6">
                {/* View Mode Switcher */}
                <div className="flex items-center p-1 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800">
                    <button
                        onClick={() => onShowGroupsChange(true)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 text-[11px] font-black",
                            showGroups
                                ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-700"
                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        )}
                    >
                        <LayoutGrid size={14} strokeWidth={2.5} />
                        プロジェクト別
                    </button>
                    <button
                        onClick={() => onShowGroupsChange(false)}
                        className={cn(
                            "px-3 py-1.5 rounded-lg transition-all flex items-center gap-2 text-[11px] font-black",
                            !showGroups
                                ? "bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-700"
                                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        )}
                    >
                        <List size={14} strokeWidth={2.5} />
                        一覧
                    </button>
                </div>

                <div className="flex items-center gap-4">
                    {/* Density Slider */}
                    <div className="flex items-center gap-2.5 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dotted border-slate-200 dark:border-slate-800">
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">密度</span>
                        <input
                            type="range"
                            min="12"
                            max="32"
                            value={rowHeight}
                            onChange={(e) => onRowHeightChange(parseInt(e.target.value))}
                            className="w-16 accent-indigo-600 h-1 cursor-pointer bg-slate-200 dark:bg-slate-800 rounded-full appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-indigo-600 [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                        />
                        <span className="text-[10px] font-bold font-mono text-slate-500 w-4">{rowHeight}</span>
                    </div>

                    {/* Daily Settings Button */}
                    <button
                        onClick={onOpenDailySettings}
                        className="group flex items-center gap-2 px-4 py-1.5 text-[11px] font-black rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-100 transition-all active:scale-95 shadow-lg shadow-slate-200 dark:shadow-none"
                    >
                        <Settings className="w-3.5 h-3.5 group-hover:rotate-90 transition-transform duration-500" />
                        <span>日次設定</span>
                    </button>
                </div>
            </div>
        </div>
    );
};
