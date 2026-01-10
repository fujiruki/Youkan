import React, { useMemo } from 'react';
import clsx from 'clsx';
import { ScheduleItem } from './ScheduleBoard';

interface GanttChartProps {
    items: ScheduleItem[];
    onItemClick?: (item: ScheduleItem) => void;
}

export const GanttChart: React.FC<GanttChartProps> = ({ items, onItemClick }) => {
    // 1. Calculate Timeline Range
    const { startDate, endDate, totalDays, dates } = useMemo(() => {
        if (items.length === 0) {
            const today = new Date();
            return { startDate: today, endDate: today, totalDays: 1, dates: [today] };
        }

        let minTime = Infinity;
        let maxTime = -Infinity;

        items.forEach(item => {
            if (item.startDate) minTime = Math.min(minTime, item.startDate.getTime());
            if (item.dueDate) maxTime = Math.max(maxTime, item.dueDate.getTime());
        });

        // Default if no dates
        if (minTime === Infinity) {
            const today = new Date();
            minTime = today.getTime();
            maxTime = today.getTime() + 7 * 24 * 60 * 60 * 1000;
        }

        // Add padding (7 days before/after)
        const start = new Date(minTime);
        start.setDate(start.getDate() - 7);
        const end = new Date(maxTime);
        end.setDate(end.getDate() + 7);

        const days = [];
        let curr = new Date(start);
        while (curr <= end) {
            days.push(new Date(curr));
            curr.setDate(curr.getDate() + 1);
        }

        return { startDate: start, endDate: end, totalDays: days.length, dates: days };
    }, [items]);

    // 2. Group items by Project
    const groupedItems = useMemo(() => {
        const groups: Record<string, ScheduleItem[]> = {};
        items.forEach(item => {
            const key = item.projectName || 'Unassigned';
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });
        return groups;
    }, [items]);

    // Helper: Position calculation
    const getBarStyles = (item: ScheduleItem) => {
        if (!item.startDate || !item.dueDate) return null;

        const startDiff = item.startDate.getTime() - startDate.getTime();
        const duration = item.dueDate.getTime() - item.startDate.getTime();

        // Convert to days
        const startDayIndex = Math.floor(startDiff / (24 * 60 * 60 * 1000));
        let spanDays = Math.ceil(duration / (24 * 60 * 60 * 1000));
        if (spanDays < 1) spanDays = 1; // Minimum width

        // Handle out of bounds (though range covers all)
        return {
            gridColumnStart: startDayIndex + 2, // +1 for name col, +1 for 1-based index
            gridColumnEnd: `span ${spanDays}`,
        };
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'design': return 'bg-sky-500 border-sky-600';
            case 'production': return 'bg-amber-500 border-amber-600';
            case 'completed': return 'bg-emerald-500 border-emerald-600';
            default: return 'bg-slate-500 border-slate-600';
        }
    };

    const colWidth = 40; // px per day

    return (
        <div className="flex flex-col h-full bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
            {/* Header: Timeline */}
            <div className="flex border-b border-slate-800 bg-slate-950 sticky top-0 z-20">
                <div className="w-64 shrink-0 p-2 border-r border-slate-800 font-bold text-slate-400">
                    Project / Task
                </div>
                <div className="flex-1 overflow-x-auto custom-scrollbar flex" style={{ width: totalDays * colWidth }}>
                    {/* Render Days Header */}
                    {dates.map((date, i) => (
                        <div
                            key={i}
                            className={clsx(
                                "shrink-0 border-r border-slate-800 p-1 text-center text-xs flex flex-col justify-center",
                                date.getDay() === 0 ? "bg-red-900/20 text-red-300" : date.getDay() === 6 ? "bg-sky-900/20 text-sky-300" : "text-slate-400"
                            )}
                            style={{ width: colWidth }}
                        >
                            <span className="text-[10px]">{date.getMonth() + 1}/</span>
                            <span className="font-bold">{date.getDate()}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Body: Rows */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                <div className="flex flex-col min-w-full">
                    {Object.entries(groupedItems).map(([project, projectItems]) => (
                        <div key={project} className="contents bg-slate-900/50">
                            {/* Project Header Row */}
                            <div className="flex bg-slate-800/50 border-b border-slate-700/50 sticky left-0 z-10 w-full">
                                <div className="w-64 shrink-0 p-2 font-bold text-slate-300 truncate sticky left-0 bg-slate-900 z-20 border-r border-slate-700">
                                    {project}
                                </div>
                                <div className="flex-1 bg-slate-900/10 pointer-events-none" />
                            </div>

                            {/* Item Rows */}
                            {projectItems.map(item => {
                                const barStyle = getBarStyles(item);
                                return (
                                    <div key={item.id} className="flex hover:bg-slate-800/30 transition-colors border-b border-slate-800/50 group h-10 items-center">
                                        {/* Name Column */}
                                        <div
                                            className="w-64 shrink-0 p-2 pl-6 text-sm text-slate-400 truncate border-r border-slate-800 cursor-pointer hover:text-white"
                                            onClick={() => onItemClick?.(item)}
                                        >
                                            {item.title}
                                        </div>

                                        {/* Timeline Column (Grid Container for alignment) */}
                                        <div className="flex-1 relative h-full">
                                            {/* Grid Lines Overlay */}
                                            <div
                                                className="absolute inset-0 flex pointer-events-none"
                                            >
                                                {dates.map((d, i) => (
                                                    <div key={i} className="border-r border-slate-800/30 grow shrink-0 h-full" style={{ width: colWidth }} />
                                                ))}
                                            </div>

                                            {/* Bar */}
                                            {item.startDate && item.dueDate ? (
                                                <div
                                                    className={clsx(
                                                        "absolute top-2 bottom-2 rounded text-[10px] items-center justify-center flex text-white font-bold cursor-pointer border shadow-sm truncate px-1",
                                                        getStatusColor(item.status)
                                                    )}
                                                    style={{
                                                        left: (item.startDate.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000) * colWidth,
                                                        width: Math.max(1, (item.dueDate.getTime() - item.startDate.getTime()) / (24 * 60 * 60 * 1000)) * colWidth
                                                    }}
                                                    title={`${item.title} (${item.manHours}h)`}
                                                    onClick={() => onItemClick?.(item)}
                                                >
                                                    {item.manHours ? `${item.manHours}h` : ''}
                                                </div>
                                            ) : (
                                                <div className="text-xs text-slate-600 italic px-2 flex items-center h-full">
                                                    No dates set
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
