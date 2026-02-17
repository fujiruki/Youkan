import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Item, CapacityConfig, JoinedTenant } from '../../types'; // [Modified]
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { safeFormat } from '../../logic/dateUtils';
import { ja } from 'date-fns/locale';
import { ChevronRight, ChevronDown, Folder } from 'lucide-react';
import { isHoliday } from '../../logic/capacity';
import { QuantityEngine, QuantityContext, AllocationStep } from '../../logic/QuantityEngine'; // [NEW]

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
    onUpdateItem?: (id: string, updates: Partial<Item>) => Promise<void> | void; // [NEW] For drag updates
    renderItemTitle: (item: Item) => string;
    // Context Props for QuantityEngine
    capacityConfig?: CapacityConfig;
    currentUserId?: string | null;
    joinedTenants?: JoinedTenant[];
    focusedTenantId?: string | null;
    focusedProjectId?: string | null;
}

export const RyokanGanttView: React.FC<GanttViewProps> = ({
    allDays, items, heatMap: _heatMap, today, onItemClick, safeConfig, rowHeight, projects, onJumpToDate, renderItemTitle,
    onUpdateItem,
    capacityConfig, currentUserId, joinedTenants, focusedTenantId, focusedProjectId
}) => {
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const headerContainerRef = useRef<HTMLDivElement>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
    const isSyncing = useRef(false);

    const colWidth = 24; // w-6 = 1.5rem = 24px
    const headerWidth = 256; // w-64 = 256px
    const startDate = allDays[0]; // First day in the timeline

    // Drag & Drop State
    const [dragState, setDragState] = useState<{
        itemId: string;
        startX: number;
        currentX: number;
        originalDate: Date;
    } | null>(null);

    // Update item handler
    const handleDragEnd = async (itemId: string, daysDiff: number) => {
        const item = items.find(i => i.id === itemId);
        if (!item || !item.prep_date || daysDiff === 0) return;

        const newDate = new Date(item.prep_date * 1000); // Convert Unix timestamp to Date object
        newDate.setDate(newDate.getDate() + daysDiff);

        // Call parent update handler
        onUpdateItem?.(itemId, { prep_date: newDate.getTime() / 1000 }); // Convert back to Unix timestamp
    };

    useEffect(() => {
        if (!dragState) return;

        const handleMouseMove = (e: MouseEvent) => {
            setDragState(prev => prev ? { ...prev, currentX: e.clientX } : null);
        };

        const handleMouseUp = (e: MouseEvent) => {
            if (dragState) {
                const diffX = e.clientX - dragState.startX;
                const daysDiff = Math.round(diffX / colWidth); // 1 day = colWidth
                handleDragEnd(dragState.itemId, daysDiff);
            }
            setDragState(null);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [dragState, items, colWidth, onUpdateItem]); // dependencies

    // Sync Scroll Logic: Use native event listeners for better control
    useEffect(() => {
        const header = headerContainerRef.current;
        const body = scrollContainerRef.current;

        if (!header || !body) return;

        const handleHeaderScroll = () => {
            if (isSyncing.current) return;
            isSyncing.current = true;
            body.scrollLeft = header.scrollLeft;
            requestAnimationFrame(() => {
                isSyncing.current = false;
            });
        };

        const handleBodyScroll = () => {
            if (isSyncing.current) return;
            isSyncing.current = true;
            header.scrollLeft = body.scrollLeft;
            requestAnimationFrame(() => {
                isSyncing.current = false;
            });
        };

        header.addEventListener('scroll', handleHeaderScroll, { passive: true });
        body.addEventListener('scroll', handleBodyScroll, { passive: true });

        return () => {
            header.removeEventListener('scroll', handleHeaderScroll);
            body.removeEventListener('scroll', handleBodyScroll);
        };
    }, []);

    const scrollToDate = (date: Date) => {
        if (!scrollContainerRef.current) return;

        // Find index of date in allDays
        const index = allDays.findIndex(d => isSameDate(d, date));

        if (index === -1) {
            // If date is out of range, try to jump via parent handler
            onJumpToDate?.(date);
            return;
        }

        // Calculate position to center the date
        const containerWidth = scrollContainerRef.current.clientWidth;

        // Center in the visible area (right of sticky col)
        const visibleTimelineWidth = containerWidth - headerWidth;
        const dateOffsetInTimeline = index * colWidth;

        // Target scrollLeft
        // We want dateOffsetInTimeline to be centered in visibleTimelineWidth
        // scrollLeft moves the timeline window.
        // center of visible timeline relative to timeline start = scrollLeft + (visibleTimelineWidth / 2)
        // we want that center to be dateOffsetInTimeline + (colWidth / 2)
        // scrollLeft = dateOffsetInTimeline + (colWidth / 2) - (visibleTimelineWidth / 2)

        let targetScrollLeft = dateOffsetInTimeline + (colWidth / 2) - (visibleTimelineWidth / 2);

        scrollContainerRef.current.scrollTo({
            left: Math.max(0, targetScrollLeft),
            behavior: 'smooth'
        });
    };

    // Grouping & Sorting Logic
    const groupedItems = useMemo(() => {
        const groups: Record<string, Item[]> = {};
        const noProjectKey = 'unassigned';

        items.forEach(item => {
            const key = item.projectId || noProjectKey;
            if (!groups[key]) groups[key] = [];
            groups[key].push(item);
        });

        Object.keys(groups).forEach(key => {
            groups[key].sort((a, b) => {
                const aDate = a.due_date || a.prep_date;
                const bDate = b.due_date || b.prep_date;

                if (!aDate && !bDate) return 0;
                if (!aDate) return -1;
                if (!bDate) return 1;

                return (typeof aDate === 'number' ? aDate : new Date(aDate).getTime()) -
                    (typeof bDate === 'number' ? bDate : new Date(bDate).getTime());
            });
        });

        return groups;
    }, [items]);

    const sortedProjectKeys = useMemo(() => {
        const keys = Object.keys(groupedItems).filter(k => k !== 'unassigned');
        keys.sort((a, b) => {
            const pA = projects.find(p => p.id === a);
            const pB = projects.find(p => p.id === b);
            return (pA?.title || '').localeCompare(pB?.title || '');
        });
        if (groupedItems['unassigned']) return ['unassigned', ...keys];
        return keys;
    }, [groupedItems, projects]);

    // Transform groupedItems for the new JSX structure
    const transformedGroupedItems = useMemo(() => {
        return sortedProjectKeys.map(groupKey => {
            const project = projects.find(p => p.id === groupKey);
            return {
                projectId: groupKey,
                projectName: groupKey === 'unassigned' ? "Inbox (未分類)" : project?.title || "Unknown Project",
                items: groupedItems[groupKey] || []
            };
        });
    }, [groupedItems, sortedProjectKeys, projects]);

    // [NEW] Calculate detailed allocations using QuantityEngine
    const allocationMap = useMemo(() => {
        if (!capacityConfig || !currentUserId) return new Map<string, AllocationStep[]>();

        const context: QuantityContext = {
            items,
            members: [], // Gantt view doesn't use members logic deeply yet
            capacityConfig,
            filterMode: 'all', // Default to showing everything for now
            focusedTenantId,
            focusedProjectId,
            currentUser: {
                id: currentUserId,
                isCompanyAccount: false, // Assuming person view mostly
                joinedTenants: joinedTenants?.map(t => ({ id: t.id, name: t.name })) || []
            }
        };

        const map = new Map<string, AllocationStep[]>();

        items.forEach(item => {
            const endDate = item.prep_date ? new Date(item.prep_date * 1000) : null;
            if (endDate) {
                const estMinutes = item.estimatedMinutes || (item.work_days ? item.work_days * 480 : 60);
                const steps = QuantityEngine.calculateAllocationDetails(endDate, estMinutes, context, item.tenantId);
                map.set(item.id, steps);
            }
        });

        return map;
    }, [items, capacityConfig, currentUserId, joinedTenants, focusedTenantId, focusedProjectId]);


    const toggleGroup = (key: string) => {
        const newSet = new Set(collapsedGroups);
        if (newSet.has(key)) newSet.delete(key);
        else newSet.add(key);
        setCollapsedGroups(newSet);
    };

    // Helper to calculate bar style with drag offset
    const getBarStyle = (item: Item, type: 'prep', baseStyle: React.CSSProperties) => {
        if (dragState && dragState.itemId === item.id && type === 'prep') {
            const diffX = dragState.currentX - dragState.startX;
            return {
                ...baseStyle,
                transform: `translateX(${diffX}px)`,
                zIndex: 50,
                cursor: 'grabbing',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
            };
        }
        return baseStyle;
    };


    return (
        <div className="flex flex-col h-full overflow-hidden select-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
            {/* Header */}
            <div
                ref={headerContainerRef}
                className="flex-none overflow-x-hidden border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 z-20"
            >
                <div className="flex">
                    {/* Sticky Corner */}
                    <div className="sticky left-0 z-30 w-64 shrink-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex items-end pb-2 pl-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                        <span className="text-xs font-bold text-slate-400">Project / Task</span>
                    </div>

                    {/* Date Headers */}
                    <div className="flex">
                        {allDays.map((day, i) => {
                            const isSun = day.getDay() === 0;
                            const isSat = day.getDay() === 6;
                            const isFirst = day.getDate() === 1;
                            return (
                                <div key={i} className={`flex-none w-6 flex flex-col items-center justify-end pb-2 border-r border-slate-100 dark:border-slate-800 ${isFirst ? 'border-l border-l-slate-300' : ''}`}>
                                    {isFirst && (
                                        <div className="absolute top-2 text-[10px] font-bold text-slate-500 whitespace-nowrap ml-1">
                                            {format(day, 'M月')}
                                        </div>
                                    )}
                                    <span className={`text-[9px] font-mono leading-none ${isSun ? 'text-red-400 font-bold' : isSat ? 'text-blue-400' : 'text-slate-400'}`}>
                                        {['日', '月', '火', '水', '木', '金', '土'][day.getDay()]}
                                    </span>
                                    <span className={`text-[10px] font-bold leading-none mt-1 ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-slate-600 dark:text-slate-400'}`}>
                                        {day.getDate()}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Body */}
            <div
                ref={scrollContainerRef}
                className="flex-1 overflow-auto overflow-x-auto relative"
            >
                <div className="min-w-max pb-32">
                    {transformedGroupedItems.map(group => (
                        <div key={group.projectId}>
                            {/* Project Header */}
                            {group.projectName !== "Inbox (未分類)" && (
                                <div className="sticky left-0 z-10 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 text-xs font-bold text-slate-500 border-y border-white dark:border-slate-700 shadow-sm">
                                    {group.projectName}
                                </div>
                            )}

                            {group.items.map(item => {
                                const prepDateObj = item.prep_date ? new Date(item.prep_date * 1000) : null;
                                const dueDateObj = item.due_date ? new Date(item.due_date * 1000) : null;
                                const commitStart = prepDateObj && item.work_days ?
                                    (d => { const n = new Date(d); n.setDate(n.getDate() - item.work_days); return n; })(prepDateObj)
                                    : null;

                                return (
                                    <div
                                        key={item.id}
                                        className="flex h-10 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
                                        onMouseEnter={() => setHoveredItemId(item.id)}
                                        onMouseLeave={() => setHoveredItemId(null)}
                                    >
                                        {/* Sticky Title Column */}
                                        <div className="sticky left-0 z-10 w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex items-center px-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
                                            <div className="truncate text-sm font-medium flex-1 text-slate-700 dark:text-slate-200">
                                                {renderItemTitle(item)}
                                            </div>
                                            {hoveredItemId === item.id && (
                                                <button onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 transition-colors">
                                                    <ChevronRight size={14} />
                                                </button>
                                            )}
                                        </div>

                                        {/* Timeline Cells */}
                                        <div className="flex relative">
                                            {allDays.map(date => {
                                                const isSun = date.getDay() === 0;
                                                const isSat = date.getDay() === 6;
                                                const isPrep = prepDateObj && isSameDate(date, prepDateObj);
                                                const isDue = dueDateObj && isSameDate(date, dueDateObj);

                                                // [MODIFIED] Real Allocation Logic
                                                const allocationSteps = allocationMap.get(item.id);
                                                const step = allocationSteps?.find(s => isSameDate(s.date, date));
                                                const isHol = isHoliday(date, safeConfig);

                                                return (
                                                    <div key={date.toDateString()} className={cn(
                                                        "w-6 flex-shrink-0 border-r border-slate-50 dark:border-slate-800/50 relative flex items-center justify-center h-full",
                                                        isSun && !step ? "bg-red-50/50 dark:bg-red-900/10" : isSat && !step ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
                                                    )}>
                                                        {/* Real Allocation Chip (Blue) */}
                                                        {step && (
                                                            <div
                                                                className={cn(
                                                                    "absolute w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white shadow-sm transition-all hover:scale-110 z-10",
                                                                    "bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600"
                                                                )}
                                                                title={`割当: ${step.allocatedMinutes}分 / Cap: ${step.capacityMinutes}分\n残: ${step.capacityMinutes - step.allocatedMinutes}分`}
                                                            >
                                                                {/* Only show minutes if enough space, otherwise dot or nothing */}
                                                                {step.allocatedMinutes >= 60 ? Math.round(step.allocatedMinutes / 60) + 'h' : ''}
                                                            </div>
                                                        )}

                                                        {/* My Deadline Handle (Draggable) */}
                                                        {isPrep && (
                                                            <div
                                                                onMouseDown={(e) => {
                                                                    if (onUpdateItem) {
                                                                        e.preventDefault();
                                                                        setDragState({
                                                                            itemId: item.id,
                                                                            startX: e.clientX,
                                                                            currentX: e.clientX,
                                                                            originalDate: prepDateObj!
                                                                        });
                                                                    }
                                                                }}
                                                                style={getBarStyle(item, 'prep', {})}
                                                                className={cn(
                                                                    "absolute top-0.5 bottom-0.5 right-0 w-1.5 rounded-full z-20 cursor-grab active:cursor-grabbing",
                                                                    "bg-indigo-400 border border-white dark:border-slate-900 shadow-md",
                                                                    "hover:w-3 hover:bg-indigo-500 transition-all",
                                                                    // If we are dragging, verify visualization
                                                                    onUpdateItem ? "" : "hidden"
                                                                )}
                                                                title={`目安納期: ${format(prepDateObj!, 'M/d')} (ドラッグして移動)`}
                                                            />
                                                        )}

                                                        {/* Due Date Marker (Fixed) */}
                                                        {isDue && (
                                                            <div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500/80 z-10" title={`顧客納期: ${format(dueDateObj!, 'M/d')}`} />
                                                        )}
                                                    </div>
                                                );
                                            })}
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
