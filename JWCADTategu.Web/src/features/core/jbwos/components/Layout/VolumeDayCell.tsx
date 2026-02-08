import React from 'react';
import { format, isToday, isLastDayOfMonth } from 'date-fns';
import { DailyVolume } from '../../services/VolumeService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface VolumeDayCellProps {
    date: Date;
    // currentMonth: Date; // [v4.5] Unused
    volume?: DailyVolume & { isHighlighted?: boolean };
    isSelected?: boolean;
    activeContextId?: string | 'all';
    onClick?: () => void;
    onDoubleClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    onOpenItem?: (id: string) => void;
    onHighlightTask?: (id: string | null) => void;
    highlightedTaskId?: string | null;
}

export const VolumeDayCell: React.FC<VolumeDayCellProps> = ({
    date,
    // currentMonth, // [v4.5] Unused
    volume,
    isSelected,
    activeContextId = 'all',
    onClick,
    onDoubleClick,
    onContextMenu,
    onOpenItem,
    onHighlightTask,
    highlightedTaskId
}) => {
    // const isDiffMonth = !isSameMonth(date, currentMonth); // [v4.5] Removed
    const dayOfMonth = format(date, 'd');
    const dateKey = format(date, 'yyyy-MM-dd');

    // [v4.6] Date Display Logic
    const isFirst = date.getDate() === 1;
    const isLast = isLastDayOfMonth(date);
    const displayDate = (isFirst || isLast) ? format(date, 'M/d') : dayOfMonth;

    // Determine color theme based on active context
    const getThemeColors = () => {
        if (!volume || volume.loadRatio === 0) return 'bg-transparent';
        if (volume.isNothingDay) return 'bg-slate-100 dark:bg-slate-900/40 text-slate-400';

        const ratio = volume.loadRatio;

        // Intensity Engine (Haruki-centric)
        if (ratio > 100) return 'bg-gradient-to-br from-orange-400 to-rose-500 text-white shadow-inner animate-pulse';

        // Normal ranges based on context
        switch (activeContextId) {
            case 'personal':
                if (ratio <= 60) return 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700';
                return 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800';
            case 'all':
                if (ratio <= 50) return 'bg-indigo-50 dark:bg-indigo-900/10 text-indigo-700';
                if (ratio <= 80) return 'bg-indigo-100 dark:bg-indigo-900/20 text-indigo-800';
                return 'bg-violet-100 dark:bg-violet-900/30 text-violet-900';
            default: // Company specific
                if (ratio <= 60) return 'bg-blue-50 dark:bg-blue-900/20 text-blue-700';
                return 'bg-blue-100 dark:bg-blue-900/40 text-blue-800';
        }
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        e.preventDefault();
        onContextMenu?.(e);
    };

    return (
        <div
            data-date={dateKey}
            className={cn(
                "relative h-28 border-r border-b border-slate-200 dark:border-slate-700 p-1 transition-all cursor-pointer group flex flex-col hover:bg-slate-50 dark:hover:bg-slate-800/20 overflow-hidden",
                // isDiffMonth && "opacity-30", // [v4.5] User request: Seamless view
                isSelected && "ring-2 ring-blue-500 z-10 bg-blue-50/10 dark:bg-blue-900/10",
                volume?.isHighlighted && "ring-2 ring-yellow-400 shadow-[0_0_15px_rgba(250,204,21,0.4)] z-10",
                volume?.isNothingDay && "bg-slate-50 dark:bg-slate-900/30",
                getThemeColors()
            )}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
            onContextMenu={handleContextMenu}
        >
            <div className="flex justify-between items-start pointer-events-none">
                <span className={cn(
                    "text-[10px] font-bold p-1 rounded-full min-w-[1.25rem] flex items-center justify-center transition-all",
                    isToday(date) ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400",
                    volume && volume.loadRatio > 100 && "bg-white text-orange-600",
                    (isFirst || isLast) && !isToday(date) && "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-1.5"
                )}>
                    {displayDate}
                </span>

                {volume && volume.loadRatio > 0 && !volume.isNothingDay && (
                    <span className="text-[9px] font-black px-1 opacity-80">
                        {Math.round(volume.loadRatio)}%
                    </span>
                )}

                {volume?.isNothingDay && (
                    <span className="text-[9px] font-medium px-1 text-slate-400 italic">Silence</span>
                )}
            </div>

            {/* Task Card Container (Deadlines/Absolute Points) */}
            <div className="mt-1 flex-grow overflow-y-auto custom-scrollbar space-y-0.5">
                {volume?.tasksEndingOnThisDay.map(task => {
                    const isTaskHighlighted = highlightedTaskId === task.id;
                    return (
                        <div
                            key={task.id}
                            id={`dead-line-card-${task.id}`}
                            className={cn(
                                "text-[8px] leading-tight border rounded px-1 py-0.5 truncate shadow-sm font-medium transition-all active:scale-95",
                                isTaskHighlighted
                                    ? "bg-yellow-400 border-yellow-500 text-yellow-900 scale-105 z-20"
                                    : "bg-white/95 dark:bg-slate-800/95 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                            )}
                            title={`${task.title} (${task.projectTitle})`}
                            onClick={(e) => {
                                e.stopPropagation();
                                console.log('[VolumeDayCell] card clicked! ID:', task.id, 'Type:', typeof task.id);
                                onHighlightTask?.(isTaskHighlighted ? null : task.id);
                            }}
                            onDoubleClick={(e) => {
                                e.stopPropagation();
                                console.log('[VolumeDayCell] card DOUBLE-CLICKED! ID:', task.id, 'Type:', typeof task.id);
                                if (onOpenItem) {
                                    console.log('[VolumeDayCell] calling onOpenItem with:', task.id);
                                    onOpenItem(task.id);
                                } else {
                                    console.warn('[VolumeDayCell] onOpenItem is NOT defined in props');
                                }
                            }}
                        >
                            <span className="opacity-60">[{task.projectTitle.substring(0, 4)}]:</span> {task.title}
                        </div>
                    );
                })}
            </div>

            {/* Bottom: Buffers/Indicators if needed */}
            {volume && volume.loadRatio > 0 && !volume.isNothingDay && (
                <div className="h-1 w-full bg-black/10 rounded-full mt-auto overflow-hidden pointer-events-none">
                    <div
                        className="h-full bg-current opacity-40 transition-all duration-500"
                        style={{ width: `${Math.min(100, volume.loadRatio)}%` }}
                    />
                </div>
            )}

            {/* Connection Point */}
            <div id={`conn-point-${dateKey}`} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0" />
        </div>
    );
};
