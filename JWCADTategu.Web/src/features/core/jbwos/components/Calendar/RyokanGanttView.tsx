import React, { useState, useRef, useMemo } from 'react';
import { Item } from '../../types';
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { safeFormat } from '../../logic/dateUtils';
import { ja } from 'date-fns/locale';
import { ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { isHoliday } from '../../logic/capacity';

const isSameDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

interface GanttViewProps {
    allDays: Date[];
    items: Item[];
    heatMap: Map<string, number>;
    today: Date;
    onItemClick?: (item: Item) => void;
    safeConfig: any;
    rowHeight: number;
    projects: any[];
    onJumpToDate?: (date: Date) => void;
    renderItemTitle: (item: Item) => string;
}

export const RyokanGanttView: React.FC<GanttViewProps> = ({
    allDays, items, heatMap: _heatMap, today, onItemClick, safeConfig, rowHeight, projects, onJumpToDate
}) => {
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Grouping & Sorting Logic
    const groupedItems = useMemo(() => {
        // 1. Sort items globally first needed? No, sort within groups.
        // Group by Project
        const groups: Record<string, Item[]> = {};
        const noProjectKey = 'unassigned';

        items.forEach(item => {
            const key = item.projectId || noProjectKey;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        // Sort items within each group
        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                // Priority 1: No Due/Prep Date (Unscheduled) first
                const aDate = a.due_date || a.prep_date;
                const bDate = b.due_date || b.prep_date;

                if (!aDate && !bDate) return 0;
                if (!aDate) return -1;
                if (!bDate) return 1;

                // Priority 2: Chronological
                return (typeof aDate === 'number' ? aDate : new Date(aDate).getTime()) -
                    (typeof bDate === 'number' ? bDate : new Date(bDate).getTime());
            });
        });

        return groups;
    }, [items]);

    // Project Order (Pinned/Sorted?) -> For now, just alphabet or defined order
    const sortedProjectKeys = useMemo(() => {
        const keys = Object.keys(groupedItems).filter(k => k !== 'unassigned');
        // Sort projects by name? or defined order
        keys.sort((a, b) => {
            const pA = projects.find(p => p.id === a);
            const pB = projects.find(p => p.id === b);
            return (pA?.title || '').localeCompare(pB?.title || '');
        });
        // Unassigned at the bottom? or top? Let's put Unassigned on top (Inbox style)
        if (groupedItems['unassigned']) return ['unassigned', ...keys];
        return keys;
    }, [groupedItems, projects]);

    const toggleGroup = (key: string) => {
        const newSet = new Set(collapsedGroups);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setCollapsedGroups(newSet);
    };

    return (
        <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 font-sans">
            {/* Header: Dates */}
            <div className="flex-none flex bg-slate-100 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 z-20">
                <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center bg-slate-50 dark:bg-slate-900 font-bold text-slate-500 text-xs">
                    Project / Task
                </div>
                <div className="flex flex-1 overflow-x-auto scrollbar-hide">
                    {allDays.map(date => {
                        const isSun = date.getDay() === 0;
                        const isSat = date.getDay() === 6;
                        return (
                            <div key={date.toDateString()} className={cn(
                                "w-6 flex-shrink-0 text-center py-1 border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col items-center justify-center h-10",
                                isSameDate(date, today) ? "bg-blue-600/10" :
                                    isSun ? "bg-red-50 dark:bg-red-900/20" :
                                        isSat ? "bg-blue-50 dark:bg-blue-900/10" : ""
                            )}>
                                <span className={cn(
                                    "text-[8px] font-bold uppercase",
                                    isSun ? "text-red-400" : isSat ? "text-blue-400" : "text-slate-400"
                                )}>{format(date, 'eee', { locale: ja })}</span>
                                <span className={cn(
                                    "text-[10px] font-mono leading-none",
                                    isSameDate(date, today) ? "text-blue-600 font-bold" : "text-slate-600 dark:text-slate-400"
                                )}>{date.getDate()}</span>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto scrollbar-hide relative" ref={scrollContainerRef}>
                <div className="min-w-max pb-32"> {/* Padding Bottom for visibility */}
                    {sortedProjectKeys.map(groupKey => {
                        const groupItems = groupedItems[groupKey];
                        const project = projects.find(p => p.id === groupKey);
                        const isInbox = groupKey === 'unassigned';
                        const isCollapsed = collapsedGroups.has(groupKey);

                        return (
                            <div key={groupKey} className="contents">
                                {/* Project Header */}
                                <div
                                    className="sticky left-0 right-0 z-10 flex items-center bg-slate-200/80 dark:bg-slate-800/90 backdrop-blur-sm border-y border-slate-300 dark:border-slate-700 h-8 px-2 cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors"
                                    onClick={() => toggleGroup(groupKey)}
                                >
                                    <div className="w-64 flex-shrink-0 flex items-center gap-2 pr-2">
                                        <button className="p-0.5 rounded hover:bg-black/10 dark:hover:bg-white/10">
                                            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                        </button>
                                        <Folder size={14} className={isInbox ? "text-slate-400" : "text-indigo-500"} fill={isInbox ? "none" : "currentColor"} className="opacity-80" />
                                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">
                                            {isInbox ? "Inbox (未分類)" : project?.title || "Unknown Project"}
                                        </span>
                                        <span className="text-[10px] text-slate-500 font-mono ml-auto">
                                            {groupItems.length}
                                        </span>
                                    </div>
                                    {/* Timeline Ruler Background for Header (Optional) */}
                                    <div className="flex-1 h-full relative opacity-20">
                                        {/* Can add ruler ticks here if needed */}
                                    </div>
                                </div>

                                {/* Items */}
                                {!isCollapsed && groupItems.map(item => {
                                    // Calculation Logic (Same as before)
                                    const myDeadline = item.prep_date ? new Date(item.prep_date * 1000) : (item.due_date ? new Date(item.due_date) : null);
                                    // [FIX] workDays fallback logic: if 0, use estimatedMinutes / 480. 
                                    const estimatedWorkDays = item.work_days || Math.max(1, Math.ceil((item.estimatedMinutes || 0) / 480));

                                    let commitStart = myDeadline ? new Date(myDeadline) : null;
                                    let actualCommitDays = 0;

                                    if (commitStart) {
                                        let c = 0; // counted work days
                                        let s = 0; // safety breaker
                                        while (c < estimatedWorkDays && s < 60) {
                                            s++;
                                            // Ensure we check holiday on the current commitStart cursor
                                            if (!isHoliday(commitStart, safeConfig)) {
                                                c++;
                                                actualCommitDays++;
                                            }
                                            // Move back 1 day if we still need to allocate more work days
                                            // IMPORTANT: The last day (deadline) counts as 1.
                                            // So if c < estimated, we move back.
                                            if (c < estimatedWorkDays) {
                                                commitStart.setDate(commitStart.getDate() - 1);
                                            }
                                        }
                                    }

                                    const dueDateObj = item.due_date ? new Date(item.due_date) : null;
                                    const prepDateObj = item.prep_date ? new Date(item.prep_date * 1000) : null;

                                    return (
                                        <div key={item.id} className="flex border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors group h-8">
                                            {/* Left Column: Item Name */}
                                            <div
                                                className={cn(
                                                    "sticky left-0 z-[5] w-64 flex-shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 px-2 flex items-center justify-between transition-colors border-l-4",
                                                    hoveredItemId === item.id ? "bg-indigo-50/10" : "",
                                                    item.due_date ? "border-l-indigo-400" : "border-l-slate-200"
                                                )}
                                                onMouseEnter={() => setHoveredItemId(item.id)}
                                                onMouseLeave={() => setHoveredItemId(null)}
                                            >
                                                <div className="flex-1 min-w-0 pr-2 cursor-pointer pl-6" onClick={() => (dueDateObj || prepDateObj) && onJumpToDate?.(dueDateObj || prepDateObj || new Date())}>
                                                    <div className="flex items-center gap-2">
                                                        <span className={cn("truncate text-xs text-slate-600 dark:text-slate-300", hoveredItemId === item.id ? "text-indigo-600 font-medium" : "")}>
                                                            {item.title}
                                                        </span>
                                                        {item.estimatedMinutes > 0 && (
                                                            <span className="text-[9px] text-slate-400 font-mono flex-shrink-0">
                                                                {item.work_days ? `${item.work_days}d` : `${Math.round(item.estimatedMinutes / 60 * 10) / 10}h`}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                {hoveredItemId === item.id && (
                                                    <button onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500">
                                                        <ChevronRight size={12} />
                                                    </button>
                                                )}
                                            </div>

                                            {/* Timeline Column */}
                                            <div
                                                className={cn(
                                                    "flex relative transition-all cursor-pointer flex-1",
                                                    hoveredItemId === item.id ? "bg-indigo-50/10" : ""
                                                )}
                                                onClick={() => onItemClick?.(item)}
                                            >
                                                {allDays.map(date => {
                                                    const isDue = dueDateObj && isSameDate(date, dueDateObj);
                                                    const isBetween = commitStart && prepDateObj && date >= commitStart && date <= prepDateObj;
                                                    // Determine if this day is a holiday (for visual gap in bar)
                                                    const isHol = isHoliday(date, safeConfig);
                                                    const isSun = date.getDay() === 0;

                                                    // Determine Bar Style
                                                    // 1. Due Date: Red Vertical Line
                                                    // 2. Commit Period: Blue Horizontal Bar

                                                    return (
                                                        <div key={date.toDateString()} className={cn(
                                                            "w-6 flex-shrink-0 border-r border-slate-100 dark:border-slate-800/30 relative flex items-center justify-center h-full",
                                                            isSun && !isBetween ? "bg-red-50/30 dark:bg-red-900/10" : ""
                                                        )}>
                                                            {/* Commit Bar (Blue) */}
                                                            {isBetween && (
                                                                <div className={cn(
                                                                    "absolute h-3 w-full top-1/2 -translate-y-1/2",
                                                                    isHol ? "bg-indigo-200 dark:bg-indigo-900/50" : "bg-indigo-400 dark:bg-indigo-500", // Lighter capacity on holidays? Or transparent?
                                                                    // Connectors
                                                                    isSameDate(date, commitStart!) ? "rounded-l-sm" : "",
                                                                    isSameDate(date, prepDateObj!) ? "rounded-r-sm" : ""
                                                                )} />
                                                            )}

                                                            {/* Due Date Marker (Red) */}
                                                            {isDue && (
                                                                <div className="absolute top-1 bottom-1 w-0.5 bg-red-500 z-10" />
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
