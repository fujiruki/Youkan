import React, { useState, useEffect, useRef } from 'react';
import { format } from 'date-fns';
import { VolumeDayCell } from './VolumeDayCell';
import { useVolumeCalendarViewModel } from '../../viewmodels/useVolumeCalendarViewModel';
import { TaskVolume, VolumeSettings } from '../../services/VolumeService';
import { Wind, Layers, User, Briefcase, Loader2, X, Clock } from 'lucide-react';
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

    const hasScrolledRef = useRef(false);

    // [NEW] Initial scroll to today (Only once)
    useEffect(() => {
        if (!hasScrolledRef.current && scrollRef.current && state.days.length > 0) {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            const todayCell = scrollRef.current.querySelector(`[data-date="${todayStr}"]`);
            if (todayCell) {
                todayCell.scrollIntoView({ block: 'center', behavior: 'auto' });
                hasScrolledRef.current = true;
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
            className="flex flex-col h-full bg-youkan-surface border border-youkan-muted/20 rounded-xl overflow-hidden shadow-xl relative connection-layer-root"
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
                                onDoubleClick={() => {
                                    // e.stopPropagation(); // Handled in VolumeDayCell
                                    const nextState = breakdownDate === dateKey ? null : dateKey;
                                    setBreakdownDate(nextState);
                                }}
                                onContextMenu={(e) => handleContextMenu(dateKey, e)}
                                onOpenItem={onOpenItem}
                                onHighlightTask={actions.highlightTask}
                                highlightedTaskId={state.highlightedTaskId}
                            />
                        );
                    })}

                    {/* Connection lines layer (Moved to top of stack) */}
                    <VolumeConnectionLayer
                        selectedDate={state.selectedDate}
                        dailyVolumes={state.dailyVolumes}
                    />

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

            {/* [NEW] Breakdown Overlay for Double Click */}
            {breakdownDate && (
                <div
                    className="absolute right-4 top-20 w-80 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 z-30 flex flex-col overflow-hidden animate-in slide-in-from-right-10 duration-200"
                    style={{ maxHeight: 'calc(100% - 6rem)' }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50">
                        <div className="font-bold flex items-center gap-2">
                            <span className="text-lg">{format(new Date(breakdownDate), 'M/d')}</span>
                            <span className="text-xs text-slate-400 font-normal">({format(new Date(breakdownDate), 'EEEE', { locale: undefined })})</span>
                        </div>
                        <button
                            onClick={() => setBreakdownDate(null)}
                            className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors"
                        >
                            <X size={16} />
                        </button>
                    </div>
                    <div className="overflow-y-auto p-2 custom-scrollbar flex-1">
                        {actions.getItemsForDate(breakdownDate).length === 0 ? (
                            <div className="text-center py-8 text-slate-400 text-sm">
                                タスクはありません
                            </div>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {actions.getItemsForDate(breakdownDate).map(task => {
                                    const isDue = task.dueDate === breakdownDate;
                                    return (
                                        <div
                                            key={task.id}
                                            className="p-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer group"
                                            onClick={() => onOpenItem?.(task.id)}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="text-sm font-bold text-slate-800 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                                                    {task.title}
                                                </div>
                                                {isDue && (
                                                    <span className="text-[10px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap ml-2">
                                                        締切
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center justify-between text-xs text-slate-500">
                                                <div className="flex items-center gap-1">
                                                    <Briefcase size={12} />
                                                    <span className="truncate max-w-[100px]">{task.projectTitle}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Clock size={12} />
                                                    <span>Total {task.estimatedTime}h</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
