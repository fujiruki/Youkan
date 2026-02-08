import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { VolumeDayCell } from './VolumeDayCell';
import { useVolumeCalendarViewModel } from '../../viewmodels/useVolumeCalendarViewModel';
import { TaskVolume, VolumeSettings } from '../../services/VolumeService';
import { Wind, Layers, User, Briefcase, Loader2 } from 'lucide-react';
import { VolumeConnectionLayer } from './VolumeConnectionLayer';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface FilterBtnProps {
    active: boolean;
    onClick: () => void;
    icon: React.ReactNode;
    label: string;
    color: 'indigo' | 'emerald' | 'blue';
}

const FilterBtn: React.FC<FilterBtnProps> = ({ active, onClick, icon, label, color }) => {
    const colorClasses = {
        indigo: active ? 'bg-indigo-600 text-white' : 'text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/40',
        emerald: active ? 'bg-emerald-600 text-white' : 'text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/40',
        blue: active ? 'bg-blue-600 text-white' : 'text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/40',
    };

    return (
        <button
            onClick={(e) => { e.stopPropagation(); onClick(); }}
            className={cn(
                "flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold transition-all active:scale-90",
                colorClasses[color]
            )}
        >
            {icon}
            {label}
        </button>
    );
};

interface VolumeCalendarGridProps {
    tasks: TaskVolume[];
    settings: VolumeSettings;
    onOpenItem?: (id: string) => void;
}

export const VolumeCalendarGrid: React.FC<VolumeCalendarGridProps> = ({ tasks, settings, onOpenItem }) => {
    const { state, actions } = useVolumeCalendarViewModel(tasks, settings);
    const [contextMenu, setContextMenu] = useState<{ date: string; x: number; y: number } | null>(null);
    const [breakdownDate, setBreakdownDate] = useState<string | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const weekDays = ['日', '月', '火', '水', '木', '金', '土'];

    // [NEW] Initial scroll to today
    useEffect(() => {
        if (scrollRef.current && state.days.length > 0) {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const todayCell = scrollRef.current.querySelector(`[data-date="${todayStr}"]`);
            if (todayCell) {
                todayCell.scrollIntoView({ block: 'center', behavior: 'auto' });
            }
        }
    }, [state.days.length]); // Run once when days load

    const handleContextMenu = (dateStr: string, e: React.MouseEvent) => {
        setContextMenu({
            date: dateStr,
            x: e.clientX,
            y: e.clientY
        });
    };

    const closeMenu = () => setContextMenu(null);

    // [NEW] Infinite Scroll Observer
    const observerTarget = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    actions.loadNextMonth();
                }
            },
            { threshold: 0.1, rootMargin: '200px' } // Load when 200px from bottom
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [actions.loadNextMonth]);

    return (
        <div
            className="flex flex-col h-full bg-youkan-surface border border-youkan-muted/20 rounded-xl overflow-hidden shadow-xl relative"
            onClick={() => {
                closeMenu();
                actions.highlightTask(null);
                setBreakdownDate(null);
            }}
        >
            {/* Header / Filter Ribbon */}
            <div className="flex flex-col border-b border-youkan-muted/20 shrink-0">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 text-youkan-text">
                            <Wind size={20} className="text-youkan-primary" />
                            <h2 className="text-xl font-black tracking-tight">
                                量感カレンダー
                            </h2>
                        </div>

                        {/* Context Filters */}
                        <div className="flex items-center bg-youkan-base p-1 rounded-full gap-1 ml-4 shadow-inner">
                            <FilterBtn
                                active={state.activeContextId === 'all'}
                                onClick={() => actions.setFilterContext('all')}
                                icon={<Layers size={14} />}
                                label="全"
                                color="indigo"
                            />
                            <FilterBtn
                                active={state.activeContextId === 'personal'}
                                onClick={() => actions.setFilterContext('personal')}
                                icon={<User size={14} />}
                                label="個"
                                color="emerald"
                            />
                            <FilterBtn
                                active={state.activeContextId === 'company'}
                                onClick={() => actions.setFilterContext('company')}
                                icon={<Briefcase size={14} />}
                                label="会"
                                color="blue"
                            />
                        </div>
                    </div>
                </div>

                {/* Weekdays Header */}
                <div className="grid grid-cols-7 border-b border-youkan-muted/10 bg-youkan-base/50">
                    {weekDays.map((day, i) => (
                        <div
                            key={day}
                            className={cn(
                                "text-center py-1 text-[10px] font-bold",
                                i === 0 ? "text-rose-400" :
                                    i === 6 ? "text-blue-400" :
                                        "text-slate-400 dark:text-slate-500"
                            )}
                        >
                            {day}
                        </div>
                    ))}
                </div>
            </div>

            {/* Scrollable Grid */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
                <div className="grid grid-cols-7 relative">
                    {/* Connection lines layer */}
                    <VolumeConnectionLayer
                        selectedDate={state.selectedDate}
                        dailyVolumes={state.dailyVolumes}
                    />

                    {state.days.map(day => {
                        const dateKey = format(day, 'yyyy-MM-dd');

                        return (
                            <VolumeDayCell
                                key={dateKey}
                                date={day}
                                // currentMonth={state.currentMonth} // Removed prop
                                volume={state.dailyVolumes[dateKey]}
                                isSelected={state.selectedDate === dateKey}
                                activeContextId={state.activeContextId}
                                onClick={() => actions.selectDate(dateKey)}
                                onDoubleClick={breakdownDate === dateKey ? () => setBreakdownDate(null) : () => setBreakdownDate(dateKey)}
                                onContextMenu={(e) => handleContextMenu(dateKey, e)}
                                onOpenItem={onOpenItem}
                                onHighlightTask={actions.highlightTask}
                                highlightedTaskId={state.highlightedTaskId}
                            />
                        );
                    })}

                    {/* Sentinel for Infinite Scroll */}
                    <div ref={observerTarget} className="col-span-7 h-24 w-full flex items-center justify-center text-slate-400">
                        <div className="flex items-center gap-2 text-xs opacity-50">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Loading future...</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Context Menu (Existing) */}
            {contextMenu && (
                <div
                    className="fixed z-50 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1 min-w-[160px] animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <button
                        className="w-full text-left px-4 py-2 text-xs hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                        onClick={() => {
                            actions.toggleNothingDay(contextMenu.date);
                            closeMenu();
                        }}
                    >
                        <span className="w-4 text-center">
                            {state.nothingDays.includes(contextMenu.date) ? "✓" : ""}
                        </span>
                        Nothing Day (休息日)
                    </button>
                    {settings.managementMode === 'Integration' && (
                        <div className="border-t border-slate-100 dark:border-slate-700 my-1">
                            <div className="px-4 py-1 text-[10px] text-slate-400">統合管理モード</div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
