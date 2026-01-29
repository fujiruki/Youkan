import React, { useMemo } from 'react';
import {
    format,
    startOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameDay,
    isToday,
    addDays,
    nextDay,
    Day
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '../../../../../lib/utils';

interface SideCalendarPanelProps {
    selectedDate: Date | null;
    onSelectDate: (date: Date) => void;
    prepDate?: Date | null; // For the "My Deadline" marker
    targetMode?: 'due' | 'my' | null; // [NEW] Controls visual feedback
    dailyVolumes?: Map<string, number>; // [MODIFIED] Use Map to match shared logic
    className?: string;
}

export const SideCalendarPanel: React.FC<SideCalendarPanelProps> = ({
    selectedDate,
    onSelectDate,
    prepDate,
    targetMode = 'due',
    dailyVolumes = new Map(),
    className
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Continuous Range: -1 Month to +6 Months
    const startDate = useMemo(() => {
        const d = startOfMonth(addDays(today, -30));
        return startOfWeek(d, { weekStartsOn: 1 });
    }, [today]);

    const endDate = useMemo(() => {
        const d = startOfMonth(addDays(today, 180));
        return endOfWeek(d, { weekStartsOn: 1 });
    }, [today]);

    const calendarDays = useMemo(() => {
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [startDate, endDate]);

    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    // Auto-scroll to current view or today
    const scrollRef = React.useRef<HTMLDivElement>(null);
    const todayRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (todayRef.current && scrollRef.current) {
            todayRef.current.scrollIntoView({ block: 'start', behavior: 'auto' });
        }
    }, []);

    // Theme based on Target Mode
    const headerColorClass = targetMode === 'my'
        ? "text-indigo-600 dark:text-indigo-400"
        : "text-slate-700 dark:text-slate-300";

    const borderColorClass = targetMode === 'my'
        ? "border-indigo-200 dark:border-indigo-800"
        : "border-slate-100 dark:border-slate-800";

    const labelColor = targetMode === 'my' ? "text-indigo-500" : "text-slate-400";

    return (
        <div className={cn("flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/20 transition-colors duration-300 border-l-4", borderColorClass.replace('border-', 'border-l-'), className)}>
            {/* Header (Selection Modes) */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200">
                <div className="flex items-baseline gap-2">
                    <span className={cn("font-bold text-sm", headerColorClass)}>
                        数量カレンダー
                    </span>
                    <span className={cn("text-[10px] font-bold tracking-tight opacity-80", labelColor)}>
                        {targetMode === 'my' ? '【My期限を設定中】' : '【納期を設定中】'}
                    </span>
                </div>
            </div>

            {/* Week Days (Sticky) */}
            <div className={cn("grid grid-cols-7 text-center text-[10px] font-bold border-b bg-white dark:bg-slate-900 z-20 shadow-sm", borderColorClass, "text-slate-400")}>
                {weekDays.map((d, i) => (
                    <div key={i} className={cn("py-1", i >= 5 && "text-red-400")}>{d}</div>
                ))}
            </div>

            {/* Scrollable Calendar Grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-100 dark:bg-slate-800 scrollbar-thin">
                <div className="grid grid-cols-7 gap-px p-px">
                    {calendarDays.map((day, idx) => {
                        const isSelected = selectedDate && isSameDay(day, selectedDate);
                        const isPrep = prepDate && isSameDay(day, prepDate);
                        const _isToday = isToday(day);
                        const isFirstOfMonth = day.getDate() === 1;

                        const dateKey = day.toDateString();
                        const volume = dailyVolumes.get(dateKey) || 0;
                        const bgIntensity = Math.min(volume * 15, 60);

                        return (
                            <React.Fragment key={idx}>
                                {/* Month Divider Trigger */}
                                {isFirstOfMonth && (
                                    <div className="col-span-7 py-1 px-2 mt-2 bg-slate-200/50 dark:bg-slate-800/80 text-[10px] font-bold text-slate-500">
                                        {format(day, 'yyyy年 M月', { locale: ja })}
                                    </div>
                                )}
                                <button
                                    ref={_isToday ? (todayRef as any) : null}
                                    onClick={() => onSelectDate(day)}
                                    className={cn(
                                        "relative h-12 flex flex-col items-center justify-center bg-white dark:bg-slate-900 text-xs transition-colors outline-none hover:z-10",
                                        isSelected && "bg-red-500 text-white z-20 font-bold !ring-2 !ring-red-400",
                                        isPrep && !isSelected && "ring-2 ring-inset ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-indigo-700 dark:text-indigo-300 z-10",
                                        !isSelected && "hover:bg-slate-100 dark:hover:bg-slate-800",
                                        _isToday && !isSelected && "border-2 border-amber-300 dark:border-amber-700 font-bold"
                                    )}
                                >
                                    {/* Heatmap Overlay */}
                                    {!isSelected && (
                                        <div
                                            className="absolute inset-0 bg-amber-400/80 pointer-events-none transition-opacity"
                                            style={{ opacity: bgIntensity / 100 }}
                                        />
                                    )}

                                    <span className="relative z-10">{format(day, 'd')}</span>
                                    {volume > 0 && !isSelected && (
                                        <span className="relative z-10 text-[8px] text-slate-400 mt-0.5 transform scale-75">
                                            {volume.toFixed(1)}
                                        </span>
                                    )}
                                </button>
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Quick Select Buttons (Sticky Bottom) */}
            <div className={cn("p-1 flex justify-center gap-1 bg-white dark:bg-slate-900 border-t z-20", borderColorClass)}>
                {['today:今日', 'tomorrow:明日', 'next_mon:来週月'].map(opt => {
                    const [key, label] = opt.split(':');
                    return (
                        <button
                            key={key}
                            onClick={() => {
                                const d = (key === 'today' ? today : key === 'tomorrow' ? addDays(today, 1) : nextDay(today, 1 as Day));
                                onSelectDate(d);
                            }}
                            className="px-2 py-1 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-all font-bold"
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
