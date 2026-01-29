import React from 'react';
import { Item, FilterMode } from '../../types';
import { cn } from '../../../../../lib/utils';
import { RyokanCalendar } from '../Calendar/RyokanCalendar';
import { addDays, nextDay, Day } from 'date-fns';

interface SideCalendarPanelProps {
    items?: Item[];
    selectedDate: Date | null;
    onSelectDate: (date: Date) => void;
    onItemClick: (item: Item) => void;
    prepDate?: Date | null;
    targetMode?: 'due' | 'my' | null;
    filterMode?: FilterMode;
    className?: string;
}

export const SideCalendarPanel: React.FC<SideCalendarPanelProps> = ({
    items = [],
    selectedDate,
    onSelectDate,
    onItemClick,
    prepDate,
    targetMode = 'due',
    filterMode = 'all',
    className
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const headerColorClass = targetMode === 'my'
        ? "text-indigo-600 dark:text-indigo-400"
        : "text-slate-700 dark:text-slate-300";

    const borderColorClass = targetMode === 'my'
        ? "border-indigo-200 dark:border-indigo-800"
        : "border-slate-100 dark:border-slate-800";

    const labelColor = targetMode === 'my' ? "text-indigo-500" : "text-slate-400";

    return (
        <div className={cn("flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/20 transition-colors duration-300 border-l-4", borderColorClass.replace('border-', 'border-l-'), className)}>
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2 bg-slate-100/50 dark:bg-slate-800/50 border-b border-slate-200">
                <div className="flex items-baseline gap-2">
                    <span className={cn("font-bold text-sm", headerColorClass)}>
                        量感カレンダー
                    </span>
                    <span className={cn("text-[10px] font-bold tracking-tight opacity-80", labelColor)}>
                        {targetMode === 'my' ? '【My期限を設定中】' : '【納期を設定中】'}
                    </span>
                </div>
            </div>

            {/* RyokanCalendar (Mini Mode) */}
            <div className="flex-1 overflow-hidden">
                <RyokanCalendar
                    items={items}
                    onItemClick={onItemClick}
                    layoutMode="mini"
                    filterMode={filterMode}
                    selectedDate={selectedDate}
                    prepDate={prepDate}
                    onSelectDate={onSelectDate}
                />
            </div>

            {/* Quick Select Buttons */}
            <div className={cn("p-1.5 flex justify-center gap-1 bg-white dark:bg-slate-900 border-t z-20", borderColorClass)}>
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
