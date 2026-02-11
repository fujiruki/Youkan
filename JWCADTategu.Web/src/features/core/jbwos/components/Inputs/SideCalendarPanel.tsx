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
    workDays?: number;
    targetMode?: 'due' | 'my' | null;
    filterMode?: FilterMode;
    volumeOnly?: boolean;
    targetItemId?: string;
    className?: string;
}

export const SideCalendarPanel: React.FC<SideCalendarPanelProps> = ({
    items = [],
    selectedDate,
    onSelectDate,
    onItemClick,
    prepDate,
    workDays = 1,
    targetMode = 'due',
    filterMode = 'all',
    volumeOnly = false,
    targetItemId,
    className
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const borderColorClass = targetMode === 'my'
        ? "border-indigo-200 dark:border-indigo-800"
        : "border-slate-100 dark:border-slate-800";

    // [FIX] Memoize focus date to maintain stable identity for RyokanCalendar effects
    const focusDate = React.useMemo(() => {
        const d = targetMode === 'my' ? (prepDate || null) : (selectedDate || null);
        return d ? new Date(d) : null;
    }, [targetMode, prepDate?.getTime() || null, selectedDate?.getTime() || null]);

    return (
        <div className={cn(
            "flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/20 transition-colors duration-300 border-l-4",
            borderColorClass.replace('border-', 'border-l-'),
            volumeOnly && "bg-white dark:bg-slate-900 border-l-0", // Remove border-l in volumeOnly
            className
        )}>
            {/* Header Removed */}

            {/* RyokanCalendar (Mini Mode) */}
            <div className="flex-1 overflow-hidden">
                <RyokanCalendar
                    items={items}
                    onItemClick={onItemClick}
                    layoutMode="mini"
                    filterMode={filterMode}
                    selectedDate={selectedDate}
                    prepDate={prepDate}
                    focusDate={focusDate} // [NEW]
                    workDays={workDays}
                    onSelectDate={onSelectDate}
                    displayMode="grid"
                    volumeOnly={volumeOnly}
                    targetItemId={targetItemId}
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
