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

interface SideCalendarPanelProps {
    currentDate: Date; // The visible month
    onMonthChange: (date: Date) => void;
    selectedDate: Date | null;
    onSelectDate: (date: Date) => void;
    prepDate?: Date | null; // For the "My Deadline" marker
    className?: string;
}

export const SideCalendarPanel: React.FC<SideCalendarPanelProps> = ({
    currentDate,
    onMonthChange,
    selectedDate,
    onSelectDate,
    prepDate,
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

    return (
        <div className={cn("flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/20", className)}>
            {/* Header */}
            <div className="flex items-center justify-between p-2">
                <button
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500"
                    onClick={handlePrevMonth}
                    tabIndex={-1}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="font-bold text-sm text-slate-700 dark:text-slate-300">
                    {format(currentDate, 'yyyy年 M月', { locale: ja })}
                </div>
                <button
                    className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-md transition-colors text-slate-500"
                    onClick={handleNextMonth}
                    tabIndex={-1}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {/* Week Days */}
            <div className="grid grid-cols-7 text-center text-xs text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800 pb-2">
                {weekDays.map((d, i) => (
                    <div key={i} className={cn("py-1", i >= 5 && "text-red-400")}>{d}</div>
                ))}
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 flex-1 auto-rows-fr gap-1 p-2 overflow-y-auto">
                {calendarDays.map((day, idx) => {
                    const isCurrentMonth = isSameMonth(day, monthStart);
                    const isSelected = selectedDate && isSameDay(day, selectedDate);
                    const isPrep = prepDate && isSameDay(day, prepDate);
                    const _isToday = isToday(day);

                    return (
                        <button
                            key={idx}
                            onClick={() => onSelectDate(day)}
                            className={cn(
                                "relative flex flex-col items-center justify-center rounded-md text-sm p-1 transition-colors outline-none focus:ring-2 focus:ring-indigo-400 focus:z-10",
                                !isCurrentMonth ? "text-slate-300 dark:text-slate-600 opacity-50" : "text-slate-700 dark:text-slate-200",
                                isSelected && "bg-indigo-500 text-white hover:bg-indigo-600 shadow-md",
                                !isSelected && "hover:bg-slate-100 dark:hover:bg-slate-800",
                                _isToday && !isSelected && "bg-amber-50 dark:bg-amber-900/20 font-bold border border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400",
                                isPrep && !isSelected && "ring-1 ring-blue-400 bg-blue-50 dark:bg-blue-900/20"
                            )}
                            tabIndex={0}
                        >
                            <span>{format(day, 'd')}</span>
                            {/* Optional Markers */}
                            <div className="flex gap-0.5 mt-1 h-1">
                                {isPrep && <div className="w-1 h-1 rounded-full bg-blue-500" title="マイ期限" />}
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* Quick Actions Footer */}
            <div className="p-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                <div className="flex flex-wrap gap-2 justify-center">
                    <button className="h-7 px-3 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-500 transition-colors" onClick={() => quickSelect('today')}>今日</button>
                    <button className="h-7 px-3 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-500 transition-colors" onClick={() => quickSelect('tomorrow')}>明日</button>
                    <button className="h-7 px-3 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-500 transition-colors" onClick={() => quickSelect('next_mon')}>来週月</button>
                    <button className="h-7 px-3 text-xs font-medium border border-slate-200 dark:border-slate-700 rounded bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:border-indigo-300 hover:text-indigo-500 transition-colors" onClick={() => quickSelect('next_fri')}>次の金</button>
                </div>
            </div>
        </div>
    );
};
