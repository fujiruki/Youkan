import React from 'react';
import { Item, FilterMode } from '../../types';
import { cn } from '../../../../../lib/utils';
// import { RyokanCalendar } from '../Calendar/RyokanCalendar'; // Removed
import { DetailQuantityCalendar } from '../../../../../components/QuantityCalendar/DetailQuantityCalendar';
import { addDays, nextDay, Day } from 'date-fns';

interface SideCalendarPanelProps {
    // items, onItemClick, workDays, targetItemId, commitPeriod, capacityConfig are no longer used by DetailQuantityCalendar
    currentItem?: Item | null; // [NEW] For Smart Context
    selectedDate: Date | null;       // 納期 (赤枠)
    onSelectDate: (date: Date) => void;
    prepDate?: Date | null;          // マイ期限 (青枠)
    targetMode?: 'due' | 'my' | null;
    filterMode?: FilterMode;
    className?: string;
}

export const SideCalendarPanel: React.FC<SideCalendarPanelProps> = ({
    currentItem,
    selectedDate,
    onSelectDate,
    prepDate,
    targetMode = 'due',
    filterMode = 'all',
    className
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return (
        <div className={cn(
            "flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/20 transition-colors duration-300 border-l-4 border-slate-100 dark:border-slate-800",
            targetMode === 'my' && "border-indigo-200 dark:border-indigo-800",
            className
        )}>
            <div className="flex-1 overflow-hidden p-1">
                <DetailQuantityCalendar
                    item={currentItem || null}
                    globalFilter={filterMode}
                    selectedDate={targetMode === 'my' ? prepDate : selectedDate}
                    prepDate={prepDate}
                    onSelectDate={onSelectDate}
                />
            </div>

            {/* Quick Select Buttons */}
            <div className={cn(
                "p-1.5 flex justify-center gap-1 bg-white dark:bg-slate-900 border-t z-20",
                targetMode === 'my' ? "border-indigo-200 dark:border-indigo-800" : "border-slate-100 dark:border-slate-800"
            )}>
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
