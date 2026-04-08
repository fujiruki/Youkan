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
    // [NEW] Data for RyokanCalendar
    items?: Item[];
    members?: any[];
    capacityConfig?: any;
    projects?: any[];
    joinedTenants?: any[];
    currentUserId?: string | null;
    commitPeriod?: Date[];
}

export const SideCalendarPanel: React.FC<SideCalendarPanelProps> = ({
    currentItem,
    selectedDate,
    onSelectDate,
    prepDate,
    targetMode = 'due',
    filterMode = 'all',
    className,
    items, members, capacityConfig, projects, joinedTenants, currentUserId, commitPeriod
}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // [NEW] Manual focus control for "Show This Month" without changing data
    const [manualFocusDate, setManualFocusDate] = React.useState<Date | null>(null);

    // Reset manual focus when real dates change (so we jump to the new selection)
    React.useEffect(() => {
        setManualFocusDate(null);
    }, [selectedDate, prepDate]);

    // スクロール実行後にforceScrollをリセット（次のセルクリックでジャンプしないようにする）
    React.useEffect(() => {
        if (manualFocusDate) {
            const timer = setTimeout(() => setManualFocusDate(null), 300);
            return () => clearTimeout(timer);
        }
    }, [manualFocusDate]);

    return (
        <div className={cn(
            "flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/20 transition-colors duration-300 border-l-4 border-slate-100 dark:border-slate-800",
            targetMode === 'my' && "border-indigo-200 dark:border-indigo-800",
            className
        )}>
            <div className="flex-1 overflow-hidden p-1">
                <DetailQuantityCalendar
                    item={currentItem || null}
                    globalFilter={filterMode as any}
                    selectedDate={selectedDate}
                    prepDate={prepDate}
                    onSelectDate={onSelectDate}
                    items={items}
                    members={members}
                    capacityConfig={capacityConfig}
                    projects={projects}
                    joinedTenants={joinedTenants}
                    currentUserId={currentUserId}
                    targetItemId={currentItem?.id}
                    commitPeriod={commitPeriod}
                    focusDate={manualFocusDate} // [NEW] Pass manual focus
                    forceScroll={!!manualFocusDate}
                />
            </div>

            {/* Quick Select Buttons */}
            <div className={cn(
                "p-1.5 flex justify-center gap-1 bg-white dark:bg-slate-900 border-t z-20",
                targetMode === 'my' ? "border-indigo-200 dark:border-indigo-800" : "border-slate-100 dark:border-slate-800"
            )}>
                {['today:今日', 'tomorrow:明日', 'next_mon:来週月', 'this_month:今月を表示'].map(opt => {
                    const [key, label] = opt.split(':');
                    return (
                        <button
                            key={key}
                            onClick={() => {
                                if (key === 'tomorrow') {
                                    onSelectDate(addDays(today, 1));
                                } else if (key === 'next_mon') {
                                    onSelectDate(nextDay(today, 1 as Day));
                                } else if (key === 'this_month') {
                                    // [FIX] Just jump view to today/this month, DO NOT SELECT
                                    setManualFocusDate(new Date());
                                } else {
                                    // Today
                                    onSelectDate(today);
                                }
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
