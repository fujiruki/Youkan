import React, { useMemo } from 'react';
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    addDays,
    nextDay,
    Day
} from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { getVolumeColorClass } from '../../logic/volumeCalculator';

interface SideCalendarPanelProps {
    currentDate: Date; // The visible month
    onMonthChange: (date: Date) => void;
    selectedDate: Date | null;
    onSelectDate: (date: Date) => void;
    prepDate?: Date | null; // For the "My Deadline" marker
    targetMode?: 'due' | 'my' | null; // [NEW] Controls visual feedback
    dailyVolumes?: Map<string, number>; // [MODIFIED] Use Map to match shared logic
    className?: string;
}

export const SideCalendarPanel: React.FC<SideCalendarPanelProps> = ({
    currentDate,
    onMonthChange,
    selectedDate,
    onSelectDate,
    prepDate,
    targetMode = 'due',
    dailyVolumes = new Map(),
    className
}) => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 1 }); // Monday start
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

    const calendarDays = useMemo(() => {
        return eachDayOfInterval({ start: startDate, end: endDate });
    }, [startDate, endDate]);

    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    const handlePrevMonth = () => onMonthChange(addDays(monthStart, -1));
    const handleNextMonth = () => onMonthChange(addDays(monthEnd, 1));

    const quickSelect = (type: 'today' | 'tomorrow' | 'next_mon' | 'next_fri') => {
        const today = new Date();
        switch (type) {
            case 'today':
                onSelectDate(today);
                onMonthChange(today);
                break;
            case 'tomorrow':
                const tmr = addDays(today, 1);
                onSelectDate(tmr);
                onMonthChange(tmr);
                break;
            case 'next_mon':
                const mon = nextDay(today, 1 as Day);
                onSelectDate(mon);
                onMonthChange(mon);
                break;
            case 'next_fri':
                const fri = nextDay(today, 5 as Day);
                onSelectDate(fri);
                onMonthChange(fri);
                break;
        }
    };

    // [NEW] Visual Theme based on Target Mode
    const headerColorClass = targetMode === 'my'
        ? "text-indigo-600 dark:text-indigo-400"
        : "text-slate-700 dark:text-slate-300";

    const borderColorClass = targetMode === 'my'
        ? "border-indigo-200 dark:border-indigo-800"
        : "border-slate-100 dark:border-slate-800";

    const labelColor = targetMode === 'my' ? "text-indigo-500" : "text-slate-400";

    return (
        <div className={cn("flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/20 transition-colors duration-300 border-l-4", borderColorClass.replace('border-', 'border-l-'), className)}>
            {/* Header (Compact) */}
            <div className="flex items-center justify-between px-1 py-1 bg-slate-100/50 dark:bg-slate-800/50">
                <button
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500"
                    onClick={handlePrevMonth}
                    tabIndex={-1}
                >
                    <ChevronLeft className="h-3 w-3" />
                </button>
                <div className="flex items-baseline gap-2">
                    <span className={cn("font-bold text-sm leading-none", headerColorClass)}>
                        {format(currentDate, 'yyyy年 M月', { locale: ja })}
                    </span>
                    {/* Minimal Label incorporated in header line */}
                    <span className={cn("text-[10px] font-bold tracking-tight opacity-80", labelColor)}>
                        {targetMode === 'my' ? '(My期限)' : '(納期)'}
                    </span>
                </div>
                <button
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded transition-colors text-slate-500"
                    onClick={handleNextMonth}
                    tabIndex={-1}
                >
                    <ChevronRight className="h-3 w-3" />
                </button>
            </div>

            {/* Week Days (Super Compact) */}
            <div className={cn("grid grid-cols-7 text-center text-[10px] font-bold border-b bg-white dark:bg-slate-900", borderColorClass, "text-slate-400")}>
                {weekDays.map((d, i) => (
                    <div key={i} className={cn("py-0.5", i >= 5 && "text-red-400")}>{d}</div>
                ))}
            </div>

            {/* Calendar Grid (Compact) */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-px bg-slate-200 dark:bg-slate-800 p-px overflow-y-auto">
                {calendarDays.map((day, idx) => {
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isPrep = prepDate && isSameDay(day, prepDate);
                    const _isToday = isToday(day);

                    // [MODIFIED] Use Shared Logic & Key
                    // calculateDailyVolume uses toDateString() as key ("Wed Jan 21 2026")
                    const dateKey = day.toDateString();
                    const volume = dailyVolumes.get(dateKey) || 0;

                    // QuantityCalendar logic (shared): returns Tailwind class string
                    const volumeClass = (isCurrentMonth && !isSelected) ? getVolumeColorClass(volume) : "";

                    return (
                        <button
                            key={idx}
                            onClick={() => onSelectDate(day)}
                            className={cn(
                                "relative flex flex-col items-center justify-center bg-white dark:bg-slate-900 text-xs transition-colors outline-none focus:ring-1 focus:ring-indigo-400 focus:z-10",
                                !isCurrentMonth ? "text-slate-300 dark:text-slate-700 bg-slate-50 dark:bg-slate-950" : "text-slate-700 dark:text-slate-200",

                                // Heatmap Base
                                volumeClass,

                                // Selection Styles
                                isSelected && "bg-red-500 text-white hover:bg-red-600 font-bold",
                                isPrep && !isSelected && "ring-1 ring-inset ring-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-indigo-700 dark:text-indigo-300",

                                !isSelected && "hover:bg-slate-100 dark:hover:bg-slate-800",
                                _isToday && !isSelected && "bg-amber-50 dark:bg-amber-900/10 text-amber-700 dark:text-amber-400 font-bold",
                            )}
                            tabIndex={0}
                        >
                            <span>{format(day, 'd')}</span>
                        </button>
                    );
                })}
            </div>

            {/* Quick Actions (Compact) */}
            <div className={cn("p-1 flex justify-center gap-1 bg-white dark:bg-slate-900 border-t", borderColorClass)}>
                {['today:今日', 'tomorrow:明日', 'next_mon:来週月', 'next_fri:次の金'].map(opt => {
                    const [key, label] = opt.split(':');
                    return (
                        <button
                            key={key}
                            onClick={() => quickSelect(key as any)}
                            className="px-2 py-0.5 text-[10px] border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800 text-slate-500 hover:text-indigo-500 hover:border-indigo-300 transition-colors"
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
