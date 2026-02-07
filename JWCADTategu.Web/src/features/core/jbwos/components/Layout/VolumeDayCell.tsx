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
    onClick?: () => void;
    onDoubleClick?: () => void;
}

export const VolumeDayCell: React.FC<VolumeDayCellProps> = ({
    date,
    currentMonth,
    volume,
    isSelected,
    onClick,
    onDoubleClick
}) => {
    const isDiffMonth = !isSameMonth(date, currentMonth);
    const dayOfMonth = format(date, 'd');

    // Determine background color based on load ratio
    const getBgColor = () => {
        if (!volume || volume.loadRatio === 0) return 'bg-transparent';
        const ratio = volume.loadRatio;

        if (ratio <= 60) return 'bg-emerald-50 dark:bg-emerald-900/20';
        if (ratio <= 90) return 'bg-amber-50 dark:bg-amber-900/20';
        if (ratio <= 110) return 'bg-orange-100 dark:bg-orange-900/40';
        return 'bg-rose-200 dark:bg-rose-900/60';
    };

    const getTextColor = () => {
        if (!volume || volume.loadRatio === 0) return '';
        const ratio = volume.loadRatio;
        if (ratio <= 60) return 'text-emerald-700 dark:text-emerald-400';
        if (ratio <= 90) return 'text-amber-700 dark:text-amber-400';
        if (ratio <= 110) return 'text-orange-700 dark:text-orange-400';
        return 'text-rose-700 dark:text-rose-400';
    };

    return (
        <div
            className={cn(
                "relative h-24 border-r border-b border-slate-200 dark:border-slate-700 p-1 transition-all cursor-pointer group",
                isDiffMonth && "opacity-30 bg-slate-50/50 dark:bg-slate-900/50",
                isSelected && "ring-2 ring-blue-500 z-10",
                getBgColor()
            )}
            onClick={onClick}
            onDoubleClick={onDoubleClick}
        >
            <div className="flex justify-between items-start">
                <span className={cn(
                    "text-[10px] font-medium p-1 rounded-full w-5 h-5 flex items-center justify-center",
                    isToday(date) ? "bg-blue-600 text-white" : "text-slate-500 dark:text-slate-400"
                )}>
                    {dayOfMonth}
                </span>

                {volume && volume.loadRatio > 0 && (
                    <span className={cn("text-[9px] font-bold px-1", getTextColor())}>
                        {Math.round(volume.loadRatio)}%
                    </span>
                )}
            </div>

            {/* Task Card Container (Deadlines) */}
            <div className="mt-1 space-y-0.5 overflow-hidden">
                {volume?.tasks.map(task => {
                    // Only show if this is the DEADLINE day (simplified for now)
                    if (format(new Date(task.dueDate), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) {
                        return (
                            <div
                                key={task.id}
                                className="text-[9px] bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 truncate shadow-sm"
                                title={`${task.title} (${task.projectTitle})`}
                            >
                                <span className="font-bold">{task.projectTitle.substring(0, 4)}:</span> {task.title}
                            </div>
                        );
                    }
                    return null;
                })}
            </div>

            {/* Connection Point (Center of the cell) */}
            <div id={`conn-point-${format(date, 'yyyy-MM-dd')}`} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-0 h-0" />
        </div>
    );
};
