import React from 'react';
import { format, isSameMonth, isToday } from 'date-fns';
import { DailyVolume } from '../../services/VolumeService';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}

interface VolumeDayCellProps {
    date: Date;
    currentMonth: Date;
    volume?: DailyVolume;
    isSelected?: boolean;
    activeContextId?: string | 'all';
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
}

export const VolumeDayCell: React.FC<VolumeDayCellProps> = ({
    date,
    currentMonth,
    volume,
    isSelected,
    activeContextId = 'all',
    onClick,
    onContextMenu
}) => {
    const isDiffMonth = !isSameMonth(date, currentMonth);
    const dayOfMonth = format(date, 'd');
    const dateKey = format(date, 'yyyy-MM-dd');

    // Determine color theme based on active context
    const getThemeColors = () => {
        if (!volume || volume.loadRatio === 0) return 'bg-transparent';
        if (volume.isNothingDay) return 'bg-slate-100 dark:bg-slate-900/40 text-slate-400';

        const ratio = volume.loadRatio;

        // Intensity Engine (Haruki-centric)
        // 100%+ is "Intensity" (Brave Orange/Violet), not error red
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
                "relative h-28 border-r border-b border-slate-200 dark:border-slate-700 p-1 transition-all cursor-pointer group flex flex-col",
                isDiffMonth && "opacity-30",
                isSelected && "ring-2 ring-blue-500 z-10",
                volume?.isNothingDay && "bg-slate-50 dark:bg-slate-900/30",
                getThemeColors()
            )}
            onClick={onClick}
            onContextMenu={handleContextMenu}
        >
            <div className="flex justify-between items-start">
                <span className={cn(
                    "text-[10px] font-bold p-1 rounded-full w-5 h-5 flex items-center justify-center",
                    isToday(date) ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400",
                    volume && volume.loadRatio > 100 && "bg-white text-orange-600"
                )}>
                    {dayOfMonth}
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
                {volume?.tasksEndingOnThisDay.map(task => (
                    <div
                        key={task.id}
                        id={`dead-line-card-${task.id}`}
                        className={cn(
                            "text-[8px] leading-tight border rounded px-1 py-0.5 truncate shadow-sm font-medium",
                            "bg-white/90 dark:bg-slate-800/90 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
                        )}
                        title={`${task.title} (${task.projectTitle})`}
                    >
                        <span className="opacity-60">{task.projectTitle}:</span> {task.title}
                    </div>
                ))}
            </div>

            {/* Bottom: Buffers/Indicators if needed */}
            {volume && volume.loadRatio > 0 && !volume.isNothingDay && (
                <div className="h-1 w-full bg-black/10 rounded-full mt-auto overflow-hidden">
                    <div
                        className="h-full bg-current opacity-40 transition-all duration-500"
                        style={{ width: `${Math.min(100, volume.loadRatio)}%` }}
                    />
                </div>
            )}

            {/* Connection Point */}
            <div id={`conn-point-${dateKey}`} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0" />

            {/* Legend Dot (if this day has contributing work for another context not currently filtered) */}
            {/* TODO: Add logic to show dots for hidden context load */}
        </div>
    );
};
