import React, { useState, useEffect, useRef } from 'react';
import { format, startOfMonth, addMonths } from 'date-fns';
import { VolumeDayCell } from './VolumeDayCell';
import { useVolumeCalendarViewModel } from '../../viewmodels/useVolumeCalendarViewModel';
import { TaskVolume, VolumeSettings } from '../../services/VolumeService';
import { ChevronLeft, ChevronRight, Wind, Layers, User, Briefcase } from 'lucide-react';
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

    // [NEW] Seamless Jump Logic
    const handleMonthJump = (offset: number) => {
        actions.changeMonth(offset);
        // Scroll to the first day of the target month
        setTimeout(() => {
            if (scrollRef.current) {
                const targetDate = addMonths(state.currentMonth, offset);
                const targetStr = format(startOfMonth(targetDate), 'yyyy-MM-dd');
                const targetCell = scrollRef.current.querySelector(`[data-date="${targetStr}"]`);
                if (targetCell) {
                    targetCell.scrollIntoView({ block: 'start', behavior: 'smooth' });
                }
            }
        }, 50);
    };

    return (
        <div
            className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-xl relative"
            onClick={() => {
                closeMenu();
                actions.highlightTask(null);
                setBreakdownDate(null);
            }}
        >
            {/* Header / Filter Ribbon */}
            <div className="flex flex-col border-b border-slate-100 dark:border-slate-800 shrink-0">
                <div className="flex items-center justify-between px-6 py-4">
                    <div className="flex items-center gap-4">
                        <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                            {format(state.currentMonth, 'yyyy年 M月')}
                        </h2>

                        {/* Context Filters */}
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-full gap-1 ml-4 shadow-inner">
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
                            {settings.contexts.filter(c => c.contextId !== 'personal').map(c => (
                                <FilterBtn
                                    key={c.contextId}
                                    active={state.activeContextId === c.contextId}
                                    onClick={() => actions.setFilterContext(c.contextId)}
                                    icon={<Briefcase size={14} />}
                                    label="会"
                                    color="blue"
                                />
                            ))}
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => handleMonthJump(-1)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <button
                            onClick={() => handleMonthJump(1)}
                            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all active:scale-95"
                        >
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>

                {/* Weekdays Header */}
                <div className="grid grid-cols-7 border-t border-slate-50 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-800/20">
                    {weekDays.map(day => (
                        <div key={day} className="py-2 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>
            </div>

            {/* Grid Body (Seamless Scroll) */}
            <div className="relative flex-grow overflow-hidden">
                <div
                    ref={scrollRef}
                    className="h-full overflow-y-auto custom-scrollbar select-none"
                >
                    <div className="relative connection-layer-root">
                        <div className="grid grid-cols-7 auto-rows-fr">
                            {state.days.map(day => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                return (
                                    <VolumeDayCell
                                        key={dateStr}
                                        date={day}
                                        currentMonth={state.currentMonth}
                                        volume={state.dailyVolumes[dateStr]}
                                        isSelected={state.selectedDate === dateStr}
                                        highlightedTaskId={state.highlightedTaskId}
                                        activeContextId={state.activeContextId}
                                        onClick={() => actions.selectDate(dateStr)}
                                        onDoubleClick={() => setBreakdownDate(dateStr)}
                                        onContextMenu={(e) => handleContextMenu(dateStr, e)}
                                        onHighlightTask={actions.highlightTask}
                                        onOpenItem={onOpenItem}
                                    />
                                );
                            })}
                        </div>
                        {/* [MODIFIED] Moved inside relative wrapper of the scrollable container */}
                        <VolumeConnectionLayer
                            selectedDate={state.selectedDate}
                            dailyVolumes={state.dailyVolumes}
                        />
                    </div>
                </div>
            </div>

            {/* Context Menu (Nothing Day Toggle) */}
            {contextMenu && (
                <div
                    className="fixed z-[100] bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden py-1 min-w-[160px] animate-in fade-in zoom-in duration-100"
                    style={{ top: contextMenu.y, left: contextMenu.x }}
                >
                    <button
                        className="w-full px-4 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2 transition-colors"
                        onClick={(e) => {
                            e.stopPropagation();
                            actions.toggleNothingDay(contextMenu.date);
                            closeMenu();
                        }}
                    >
                        <Wind size={16} className="text-slate-400" />
                        <span>{state.nothingDays.includes(contextMenu.date) ? '静寂を解除' : '静寂を予約（壁）'}</span>
                    </button>
                </div>
            )}

            {/* Breakdown Popover */}
            {breakdownDate && (
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[110] bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 rounded-2xl w-[320px] max-h-[400px] flex flex-col p-4 animate-in fade-in zoom-in duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="flex justify-between items-center mb-4 shrink-0">
                        <h3 className="text-sm font-black text-slate-800 dark:text-slate-100 italic">
                            {format(new Date(breakdownDate), 'yyyy.MM.dd')} の内訳
                        </h3>
                        <button
                            onClick={() => setBreakdownDate(null)}
                            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                            <ChevronLeft size={16} />
                        </button>
                    </div>

                    <div className="overflow-y-auto custom-scrollbar flex-grow space-y-2 pr-1">
                        {actions.getItemsForDate(breakdownDate).map(task => (
                            <div
                                key={task.id}
                                className="p-2 border border-slate-100 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer group active:scale-95 transition-all"
                                onClick={() => onOpenItem?.(task.id)}
                            >
                                <div className="text-[10px] text-slate-400 font-bold mb-0.5">[{task.projectTitle.substring(0, 4)}]</div>
                                <div className="text-xs font-medium text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                    {task.title}
                                </div>
                            </div>
                        ))}
                        {actions.getItemsForDate(breakdownDate).length === 0 && (
                            <div className="text-center py-8 text-slate-300 text-xs italic">
                                この日の負荷に影響するタスクはありません
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
