import React from 'react';
import { Item, FilterMode } from '../../types';
import { cn } from '../../../../../lib/utils';
import { RyokanCalendar } from '../Calendar/RyokanCalendar';
import { addDays, nextDay, Day } from 'date-fns';

interface SideCalendarPanelProps {
    items?: Item[];
    workloadItems?: Item[]; // [v3.2]
    selectedDate: Date | null;
    onSelectDate: (date: Date) => void;
    onItemClick: (item: Item) => void;
    prepDate?: Date | null;
    workDays?: number;
    targetMode?: 'due' | 'my' | null;
    filterMode?: FilterMode;
    className?: string;
}

export const SideCalendarPanel: React.FC<SideCalendarPanelProps> = ({
    items = [],
    workloadItems = [], // [v3.2]
    selectedDate,
    onSelectDate,
    onItemClick,
    prepDate,
    workDays = 1,
    targetMode = 'due',
    filterMode: initialFilterMode = 'all', // [v3.2] renamed to avoid collision
    className
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // [v3.2] Local filter mode for the modal's calendar
    const [localFilterMode, setLocalFilterMode] = React.useState<FilterMode>(initialFilterMode);

    const borderColorClass = targetMode === 'my'
        ? "border-indigo-200 dark:border-indigo-800"
        : "border-youkan-muted/20";

    // [FIX] Memoize focus date to maintain stable identity for RyokanCalendar effects
    const focusDate = React.useMemo(() => {
        const d = targetMode === 'my' ? (prepDate || null) : (selectedDate || null);
        return d ? new Date(d) : null;
    }, [targetMode, prepDate?.getTime() || null, selectedDate?.getTime() || null]);

    return (
        <div className={cn("flex flex-col h-full bg-youkan-base transition-colors duration-300 border-l-4", borderColorClass.replace('border-', 'border-l-'), className)}>

            {/* [v3.2] Local Filter Selector */}
            <div className="flex-none p-2 flex justify-end">
                <div className="flex bg-youkan-muted/10 rounded-lg p-0.5 border border-youkan-muted/10">
                    {(['all', 'personal', 'company'] as FilterMode[]).map(f => (
                        <button
                            key={f}
                            onClick={() => setLocalFilterMode(f)}
                            className={cn(
                                "px-2 py-0.5 text-[9px] font-bold rounded transition-all",
                                localFilterMode === f
                                    ? "bg-youkan-surface text-youkan-primary shadow-sm ring-1 ring-youkan-muted/20"
                                    : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                            )}
                        >
                            {f === 'all' ? '全部' : f === 'personal' ? '個人' : '会社'}
                        </button>
                    ))}
                </div>
            </div>

            {/* RyokanCalendar (Mini Mode) */}
            <div className="flex-1 overflow-hidden">
                <RyokanCalendar
                    items={items}
                    externalWorkloadItems={workloadItems} // [v3.2]
                    onItemClick={onItemClick}
                    layoutMode="mini"
                    filterMode={localFilterMode} // [v3.2] Use local state
                    selectedDate={selectedDate}
                    prepDate={prepDate}
                    focusDate={focusDate}
                    workDays={workDays}
                    onSelectDate={onSelectDate}
                    displayMode="grid"
                />
            </div>

            {/* Quick Select Buttons */}
            <div className={cn("p-1.5 flex justify-center gap-1 bg-youkan-surface border-t z-20", borderColorClass)}>
                {['today:今日', 'tomorrow:明日', 'next_mon:来週月'].map(opt => {
                    const [key, label] = opt.split(':');
                    return (
                        <button
                            key={key}
                            onClick={() => {
                                const d = (key === 'today' ? today : key === 'tomorrow' ? addDays(today, 1) : nextDay(today, 1 as Day));
                                onSelectDate(d);
                            }}
                            className="px-2 py-1 text-[10px] border border-youkan-muted/20 rounded bg-youkan-base text-youkan-muted hover:text-youkan-primary hover:border-indigo-300 transition-all font-bold"
                        >
                            {label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
