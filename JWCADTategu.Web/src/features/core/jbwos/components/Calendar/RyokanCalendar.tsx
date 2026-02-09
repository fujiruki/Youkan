import React, { useMemo, useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Item, FilterMode, Member, CapacityConfig } from '../../types';
import { motion, AnimatePresence } from 'framer-motion';
import { isHoliday } from '../../logic/capacity';
import { QuantityEngine, QuantityMetric } from '../../logic/QuantityEngine';
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronRight, X } from 'lucide-react';

export type RyokanDisplayMode = 'grid' | 'timeline' | 'gantt';

interface RyokanCalendarProps {
    items: Item[];
    onItemClick: (item: Item) => void;
    capacityConfig?: CapacityConfig;
    members?: Member[];

    // UI Options
    layoutMode?: 'panorama' | 'mini';
    displayMode?: RyokanDisplayMode;
    filterMode?: FilterMode;

    // External Volume Mapping
    externalVolumeMap?: Map<string, number>;
    intensityScale?: number;

    // Interactions
    onSelectDate?: (date: Date) => void;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    focusDate?: Date | null;
    workDays?: number;
    rowHeight?: number;
    projects?: any[];

    // Context Focus
    focusedTenantId?: string | null;
    focusedProjectId?: string | null;
    currentUserId?: string | null;
}

interface PressureConnection {
    id: string;
    source: { x: number, y: number };
    target: { x: number, y: number };
    color: string;
}

const getStartOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const isSameDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

export const RyokanCalendar: React.FC<RyokanCalendarProps> = ({
    items,
    onItemClick,
    capacityConfig,
    members = [],
    layoutMode = 'panorama',
    displayMode: propDisplayMode,
    filterMode = 'all',
    onSelectDate,
    selectedDate: propSelectedDate,
    prepDate: propPrepDate,
    focusDate: propFocusDate,
    workDays = 1,
    rowHeight = 12,
    projects = [],
    focusedTenantId,
    focusedProjectId,
    currentUserId
}) => {
    const [displayMode, setDisplayMode] = useState<RyokanDisplayMode>(propDisplayMode || 'grid');
    const today = getStartOfToday();
    const isMini = layoutMode === 'mini';
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // State for Interactions
    const [selectedSigns, setSelectedSigns] = useState<Item[]>([]);
    const [pressureConnections, setPressureConnections] = useState<PressureConnection[]>([]);
    const [flashingItemIds, setFlashingItemIds] = useState<Set<string>>(new Set());
    const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
    const lastScrolledDateRef = useRef<string | null>(null);

    const safeConfig = useMemo(() => {
        if (capacityConfig && capacityConfig.holidays) return capacityConfig;
        return {
            defaultDailyMinutes: 480,
            holidays: [{ type: 'weekly', value: '0' }],
            exceptions: {}
        } as CapacityConfig;
    }, [capacityConfig]);

    const startDate = useMemo(() => {
        const d = new Date(today);
        d.setMonth(d.getMonth() - (isMini ? 1 : 6));
        return getStartOfWeek(d);
    }, [isMini, today]);

    const endDate = useMemo(() => {
        const d = new Date(today);
        d.setMonth(d.getMonth() + (isMini ? 4 : 12));
        return d;
    }, [isMini, today]);

    const allDays = useMemo(() => {
        const days: Date[] = [];
        let current = new Date(startDate);
        while (current <= endDate) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    }, [startDate, endDate]);

    // [Quantity Engine Integration]
    const metrics = useMemo(() => {
        return QuantityEngine.calculateMetrics(allDays, {
            items,
            members,
            capacityConfig: safeConfig,
            filterMode,
            focusedTenantId,
            focusedProjectId
        });
    }, [allDays, items, members, safeConfig, filterMode, focusedTenantId, focusedProjectId]);

    const heatMap = useMemo(() => {
        const map = new Map<string, number>();
        metrics.forEach((m, key) => {
            map.set(key, QuantityEngine.getIntensity(m.ratio));
        });
        return map;
    }, [metrics]);

    const commitPeriod = useMemo(() => {
        if (!propPrepDate || workDays <= 0) return [];
        const days: Date[] = [];
        let count = 0;
        let current = new Date(propPrepDate);
        let safety = 0;
        while (count < workDays && safety < 60) {
            safety++;
            if (!isHoliday(current, safeConfig)) {
                days.push(new Date(current));
                count++;
            }
            if (count < workDays) {
                current.setDate(current.getDate() - 1);
            }
        }
        return days;
    }, [propPrepDate, workDays, safeConfig]);

    // Interactions
    // Helers for Privacy & Visibility
    const renderItemTitle = (item: Item) => {
        // [Privacy Logic]
        // Show title if:
        // 1. I am the creator
        // 2. I am the assignee
        // 3. It belongs to the focused project (Assumed public within project context)
        // 4. It's a system/public task (no tenant, etc. - though here mostly private)

        const isMine = item.created_by === currentUserId || item.assignedTo === currentUserId;
        const isProjectContext = focusedProjectId && item.projectId === focusedProjectId;

        if (isMine || isProjectContext) {
            return item.title;
        }

        return "予定あり (Private)";
    };

    const handleItemAction = (item: Item) => {
        if (highlightedItemId === item.id) {
            setHighlightedItemId(null);
            setFlashingItemIds(new Set());
        } else {
            setHighlightedItemId(item.id);
            setFlashingItemIds(new Set([item.id]));
        }
        onItemClick(item);
    };

    const handleDayAction = (date: Date, actionType: 'click' | 'doubleClick', rect?: DOMRect) => {
        const dateKey = date.toDateString();
        const metric = metrics.get(dateKey);
        const signs = metric?.contributingItems || [];

        if (onSelectDate) onSelectDate(date);

        if (actionType === 'doubleClick') {
            setSelectedSigns(signs);
            setPressureConnections([]);
        } else {
            if (!rect || !scrollContainerRef.current) return;
            const container = scrollContainerRef.current;
            const containerRect = container.getBoundingClientRect();

            // Adjust for scroll offset to get coordinate relative to CONTENT origin
            const sourceX = rect.left + rect.width / 2 - containerRect.left + container.scrollLeft;
            const sourceY = rect.top + rect.height / 2 - containerRect.top + container.scrollTop;

            const newConnections: PressureConnection[] = [];
            const newFlashingIds = new Set<string>();

            signs.forEach(item => {
                const chip = document.getElementById(`cal-chip-${item.id}`);
                if (chip) {
                    const chipRect = chip.getBoundingClientRect();
                    newConnections.push({
                        id: `${date.getTime()}-${item.id}`,
                        source: { x: sourceX, y: sourceY },
                        target: {
                            x: chipRect.left + chipRect.width / 2 - containerRect.left + container.scrollLeft,
                            y: chipRect.top + chipRect.height / 2 - containerRect.top + container.scrollTop
                        },
                        color: '#fbbf24'
                    });
                    newFlashingIds.add(item.id);
                }
            });

            setPressureConnections(newConnections);
            setFlashingItemIds(newFlashingIds);
        }
    };

    // Scroll Logic
    useEffect(() => {
        if (!scrollContainerRef.current || allDays.length === 0) return;
        let targetDate = propFocusDate || propSelectedDate || today;

        // [FIX] Avoid unnecessary scroll jump if same date (unless explicit focus change)
        const dateKey = targetDate.toDateString();
        const isUserAction = !!propFocusDate || !!propSelectedDate;

        if (!propFocusDate && !propSelectedDate) {
            if (displayMode === 'gantt') targetDate = today;
            else if (displayMode === 'timeline') targetDate = getStartOfWeek(today);
            else targetDate = new Date(today.getFullYear(), today.getMonth(), 1);
        }

        let cellWidth = 24;
        let offsetDays = 0;

        if (displayMode === 'gantt' || displayMode === 'timeline') {
            cellWidth = 24;
            offsetDays = displayMode === 'gantt' ? -2 : 0;
        } else if (displayMode === 'grid') {
            cellWidth = 112;
            // [FIX] Removed forced 1st of month. Use actual target date.
            // targetDate = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1); 
            const containerWidth = scrollContainerRef.current?.clientWidth || 0;
            offsetDays = -Math.floor((containerWidth / cellWidth) / 2);
        }

        const targetIndex = allDays.findIndex(d => isSameDate(d, targetDate));
        if (targetIndex !== -1) {
            if (displayMode === 'grid') {
                const row = Math.floor(targetIndex / 7);
                const targetScrollTop = row * 120;
                const container = scrollContainerRef.current;

                // [FIX] Smart Scroll: Only scroll if target is NOT currently visible
                const isVisible = targetScrollTop >= container.scrollTop &&
                    targetScrollTop <= (container.scrollTop + container.clientHeight - 120);

                if (!isVisible || (isUserAction && lastScrolledDateRef.current !== dateKey)) {
                    container.scrollTop = targetScrollTop;
                    lastScrolledDateRef.current = dateKey;
                }
            } else {
                const targetScrollLeft = Math.max(0, (targetIndex + offsetDays) * cellWidth);
                const container = scrollContainerRef.current;
                const isVisible = targetScrollLeft >= container.scrollLeft &&
                    targetScrollLeft <= (container.scrollLeft + container.clientWidth - cellWidth);

                if (!isVisible || (isUserAction && lastScrolledDateRef.current !== dateKey)) {
                    container.scrollLeft = targetScrollLeft;
                    lastScrolledDateRef.current = dateKey;
                }
            }
        }
    }, [allDays, today, displayMode, propFocusDate, propSelectedDate]);

    return (
        <div className={cn("ryokan-calendar w-full h-full flex flex-col relative overflow-hidden", isMini ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-900", isMini ? "border-l-4 border-indigo-200 dark:border-indigo-800" : "")} ref={containerRef}>
            {!isMini && (
                <div className="flex-none px-4 py-2 bg-white/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 mr-2">表示モード:</span>
                        {[
                            { id: 'grid', label: 'グリッド', icon: '📅' },
                            { id: 'timeline', label: 'タイムライン', icon: '↔️' },
                            { id: 'gantt', label: 'ガント', icon: '📊' }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => setDisplayMode(mode.id as RyokanDisplayMode)}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1",
                                    displayMode === mode.id
                                        ? "bg-indigo-500 text-white shadow-md"
                                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300"
                                )}
                            >
                                <span>{mode.icon}</span>
                                <span>{mode.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-hidden relative" ref={scrollContainerRef}>
                {displayMode === 'timeline' && (
                    <RyokanTimelineView
                        allDays={allDays}
                        metrics={metrics}
                        heatMap={heatMap}
                        today={today}
                        selectedDate={propSelectedDate}
                        prepDate={propPrepDate}
                        isMini={isMini}
                        flashingItemIds={flashingItemIds}
                        pressureConnections={pressureConnections}
                        onItemClick={handleItemAction}
                        onAction={handleDayAction}
                        safeConfig={safeConfig}
                        commitPeriod={commitPeriod}
                        projects={projects}
                        renderItemTitle={renderItemTitle}
                        scrollRef={scrollContainerRef as any}
                    />
                )}
                {displayMode === 'grid' && (
                    <RyokanGridView
                        allDays={allDays}
                        metrics={metrics}
                        heatMap={heatMap}
                        today={today}
                        onItemClick={handleItemAction}
                        onAction={handleDayAction}
                        selectedDate={propSelectedDate}
                        prepDate={propPrepDate}
                        commitPeriod={commitPeriod}
                        scrollRef={scrollContainerRef as any}
                        projects={projects}
                        renderItemTitle={renderItemTitle}
                        pressureConnections={pressureConnections}
                    />
                )}
                {displayMode === 'gantt' && (
                    <RyokanGanttView
                        allDays={allDays}
                        items={items}
                        heatMap={heatMap}
                        today={today}
                        onItemClick={handleItemAction}
                        safeConfig={safeConfig}
                        rowHeight={rowHeight}
                        projects={projects}
                        onJumpToDate={(date) => {
                            const targetIndex = allDays.findIndex(d => isSameDate(d, date));
                            if (targetIndex !== -1 && scrollContainerRef.current) {
                                const targetScroll = Math.max(0, targetIndex * 24 - 48);
                                scrollContainerRef.current.scrollTo({ left: targetScroll, behavior: 'smooth' });
                            }
                        }}
                        renderItemTitle={renderItemTitle}
                    />
                )}
            </div>

            {selectedSigns.length > 0 && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedSigns([])}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full overflow-hidden"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 flex items-center justify-between">
                            <h3 className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest flex items-center gap-2">
                                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse" />
                                負荷内訳 ({selectedSigns.length})
                            </h3>
                            <button onClick={() => setSelectedSigns([])} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                            {selectedSigns.map(s => {
                                const project = projects.find(p => p.id === s.projectId);
                                return (
                                    <div
                                        key={s.id}
                                        onClick={() => { onItemClick(s); setSelectedSigns([]); }}
                                        className={cn(
                                            "group flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-all cursor-pointer bg-white dark:bg-slate-900",
                                            "border-l-4",
                                            s.status === 'focus' ? "border-l-orange-400" :
                                                s.status === 'done' ? "border-l-emerald-400" :
                                                    s.status === 'waiting' ? "border-l-amber-400" : "border-l-slate-300"
                                        )}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {s.title}
                                                </span>
                                                {project && (
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                                        {project.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {s.due_date && (
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                        期限: {format(new Date(s.due_date), 'MM/dd')}
                                                    </span>
                                                )}
                                                {s.estimatedMinutes && (
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        <span className="w-1 h-1 bg-slate-300 rounded-full" />
                                                        工数: {s.estimatedMinutes}m
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronRight size={16} className="text-indigo-500" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

interface TimelineViewProps {
    allDays: Date[];
    metrics: Map<string, QuantityMetric>;
    heatMap: Map<string, number>;
    today: Date;
    selectedDate: Date | null | undefined;
    prepDate: Date | null | undefined;
    isMini: boolean;
    flashingItemIds: Set<string>;
    pressureConnections: PressureConnection[];
    onItemClick: (item: Item) => void;
    onAction: (date: Date, actionType: 'click' | 'doubleClick', rect?: DOMRect) => void;
    safeConfig: any;
    commitPeriod?: Date[];
    projects?: any[];
    renderItemTitle: (item: Item) => string;
    scrollRef?: React.RefObject<HTMLDivElement>;
}

const RyokanTimelineView: React.FC<TimelineViewProps> = ({
    allDays, metrics, heatMap, today,
    selectedDate, prepDate, isMini,
    flashingItemIds, pressureConnections, onItemClick, onAction,
    safeConfig: _safeConfig, commitPeriod = [], projects = [],
    renderItemTitle,
    scrollRef
}) => {
    const todayRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (todayRef.current) {
            todayRef.current.scrollIntoView({ inline: 'center', block: 'center', behavior: 'auto' });
        }
    }, [isMini]);

    const handleCellAction = (date: Date, _signs: Item[], actionType: 'click' | 'doubleClick', rect?: DOMRect) => {
        onAction(date, actionType, rect);
    };

    return (
        <div className="w-full h-full relative overflow-hidden" ref={containerRef}>

            <div className={cn("flex-1 h-full overflow-auto scrollbar-hide select-none", isMini ? "overflow-y-auto" : "overflow-x-auto")} ref={scrollRef}>
                <div className={cn("flex min-w-max h-full relative", isMini ? "flex-col w-full" : "flex-row")}>
                    <svg className="absolute inset-0 pointer-events-none z-50 w-full h-full overflow-visible">
                        <AnimatePresence>
                            {pressureConnections.map(conn => (
                                <motion.path
                                    key={conn.id}
                                    d={`M ${conn.source.x} ${conn.source.y} Q ${Math.max(conn.source.x, conn.target.x) + 60} ${(conn.source.y + conn.target.y) / 2} ${conn.target.x} ${conn.target.y}`}
                                    fill="none"
                                    stroke={conn.color}
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 0.7 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.4 }}
                                />
                            ))}
                        </AnimatePresence>
                    </svg>
                    {allDays.map(date => {
                        const dateKey = date.toDateString();
                        const metric = metrics.get(dateKey);
                        const isToday = isSameDate(date, today);
                        const isFirst = date.getDate() === 1;
                        const intensity = heatMap.get(dateKey) || 0;
                        const isS = selectedDate ? isSameDate(date, selectedDate) : false;
                        const isP = prepDate ? isSameDate(date, prepDate) : false;

                        return (
                            <CalendarCell
                                key={dateKey}
                                date={date}
                                metric={metric}
                                isToday={isToday}
                                isFirst={isFirst}
                                intensity={intensity}
                                isMini={isMini}
                                isSelected={isS}
                                isPrep={isP}
                                isCommitPeriod={commitPeriod.some(d => isSameDate(d, date))}
                                flashingIds={flashingItemIds}
                                ref={isToday ? todayRef : null}
                                onAction={handleCellAction}
                                onItemClick={onItemClick}
                                projects={projects}
                                renderItemTitle={renderItemTitle}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

interface CalendarCellProps {
    date: Date;
    metric?: QuantityMetric;
    isToday: boolean;
    isFirst: boolean;
    intensity: number;
    isMini: boolean;
    isSelected: boolean;
    isPrep: boolean;
    isCommitPeriod: boolean;
    flashingIds: Set<string>;
    onAction: (date: Date, signs: Item[], actionType: 'click' | 'doubleClick', rect?: DOMRect) => void;
    onItemClick: (item: Item) => void;
    projects?: any[];
    renderItemTitle: (item: Item) => string;
}

const CalendarCell = forwardRef<HTMLDivElement, CalendarCellProps>(({
    date, metric, isToday, isFirst, intensity, isMini, isSelected, isPrep, isCommitPeriod, flashingIds, onAction, onItemClick, projects = [], renderItemTitle
}, ref) => {
    const items = metric?.contributingItems || [];
    const isHoliday = metric?.isHoliday || false;
    const cellRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => cellRef.current!);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAction(date, items, 'doubleClick', cellRef.current?.getBoundingClientRect());
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAction(date, items, 'click', cellRef.current?.getBoundingClientRect());
    };

    return (
        <div
            ref={cellRef}
            className={cn(
                "calendar-cell relative flex-shrink-0 transition-all duration-300",
                isMini ? "w-full h-10 border-b flex items-center px-4" : "w-28 h-full border-r flex flex-col p-2 border-b border-slate-100 dark:border-slate-800",
                isHoliday ? "bg-red-50/10 dark:bg-red-900/5" : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800",
                isSelected ? "z-10 bg-red-50 dark:bg-red-900/20 shadow-[inset_0_0_0_2px_rgba(244,63,94,1)]" : "",
                (isPrep || isCommitPeriod) && !isSelected ? "z-10 bg-indigo-50 dark:bg-indigo-900/20 shadow-[inset_0_0_0_2px_rgba(99,102,241,1)]" : ""
            )}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div className="absolute inset-0 bg-amber-500/40 dark:bg-amber-400/30 pointer-events-none" style={{ opacity: intensity / 100 }} />

            <div className={cn("flex relative z-10", isMini ? "items-center gap-4 w-full" : "flex-col w-full h-full")}>
                <div className={isMini ? "w-10 flex-shrink-0" : "flex items-start justify-between mb-1"}>
                    <div className="flex flex-col">
                        {isFirst && !isMini && <span className="text-[10px] font-bold text-slate-400">{format(date, 'MMM', { locale: ja })}</span>}
                        <span className={cn("text-xs font-mono", isToday ? "font-bold text-blue-600 underline" : "text-slate-500")}>
                            {isMini ? format(date, 'MM/dd') : date.getDate()}
                        </span>
                    </div>
                </div>

                <div className={cn("flex-1 flex gap-1", isMini ? "flex-row overflow-x-auto" : "flex-col overflow-hidden")}>
                    {items.slice(0, isMini ? 10 : 3).map(i => {
                        const proj = projects.find(p => p.id === i.projectId);
                        return (
                            <div key={i.id} id={`cal-chip-${i.id}`} onClick={(e) => { e.stopPropagation(); onItemClick(i); }} className={cn("px-1.5 py-0.5 rounded text-[10px] truncate shadow-sm cursor-pointer border-l-2 bg-red-50 text-red-900 font-bold", flashingIds.has(i.id) ? "ring-2 ring-amber-400 scale-105" : "", i.tenantId ? "border-l-indigo-400" : "border-l-red-400")}>
                                {proj && <span className="text-slate-400 mr-1">[{proj.name}]</span>}
                                {renderItemTitle(i)}
                            </div>
                        );
                    })}
                    {!isMini && items.length > 3 && <span className="text-[8px] text-slate-400 text-center">+{items.length - 3}</span>}
                    {isMini && items.length > 10 && <span className="text-[8px] text-slate-400">...</span>}
                </div>
            </div>
        </div>
    );
});

interface GridViewProps {
    allDays: Date[];
    metrics: Map<string, QuantityMetric>;
    heatMap: Map<string, number>;
    today: Date;
    onItemClick: (item: Item) => void;
    onAction: (date: Date, actionType: 'click' | 'doubleClick', rect?: DOMRect) => void;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    commitPeriod?: Date[];
    scrollRef?: React.RefObject<HTMLDivElement>;
    highlightedItemId?: string | null;
    projects?: any[];
    renderItemTitle: (item: Item) => string;
    pressureConnections?: PressureConnection[];
}

const RyokanGridView: React.FC<GridViewProps> = ({
    allDays, metrics, heatMap, today, onItemClick, onAction,
    selectedDate, prepDate, commitPeriod = [], scrollRef, highlightedItemId, projects = [], renderItemTitle,
    pressureConnections = []
}) => {
    return (
        <div
            ref={scrollRef}
            className="w-full h-full overflow-auto p-4 bg-slate-50 dark:bg-slate-900/50 scrollbar-hide relative"
        >
            {/* Background Volume Curve */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <svg className="w-full h-full opacity-30 dark:opacity-20 overflow-visible">
                    <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#818cf8" />
                            <stop offset="50%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#4f46e5" />
                        </linearGradient>
                    </defs>
                    <VolumeCurve allDays={allDays} metrics={metrics} />
                </svg>
            </div>

            <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm relative z-10">
                <svg className="absolute inset-0 pointer-events-none z-50 w-full h-full overflow-visible">
                    <AnimatePresence>
                        {pressureConnections.map(conn => (
                            <motion.path
                                key={conn.id}
                                d={`M ${conn.source.x} ${conn.source.y} Q ${Math.max(conn.source.x, conn.target.x) + 60} ${(conn.source.y + conn.target.y) / 2} ${conn.target.x} ${conn.target.y}`}
                                fill="none"
                                stroke={conn.color}
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                initial={{ pathLength: 0, opacity: 0 }}
                                animate={{ pathLength: 1, opacity: 0.7 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.4 }}
                            />
                        ))}
                    </AnimatePresence>
                </svg>
                {allDays.map(date => {
                    const dateKey = date.toDateString();
                    const metric = metrics.get(dateKey);
                    const dayItems = metric?.contributingItems || [];
                    const isToday = isSameDate(date, today);
                    const isHol = metric?.isHoliday || false;
                    const intensity = heatMap.get(dateKey) || 0;

                    const isS = selectedDate ? isSameDate(date, selectedDate) : false;
                    const isP = prepDate ? isSameDate(date, prepDate) : false;
                    const isCP = commitPeriod.some(d => isSameDate(d, date));
                    const isH = highlightedItemId && dayItems.some(i => i.id === highlightedItemId);

                    return (
                        <div
                            key={dateKey}
                            onClick={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                onAction(date, 'click', rect);
                            }}
                            onDoubleClick={() => onAction(date, 'doubleClick')}
                            className={cn(
                                "min-h-[120px] p-2 relative transition-all group border-b border-r border-slate-200 dark:border-slate-800",
                                isHol ? "bg-red-50/20 dark:bg-red-900/10" : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800",
                                isS ? "z-10 shadow-[inset_0_0_0_2px_rgba(244,63,94,1)]" : "",
                                (isP || isCP) && !isS ? "z-10 shadow-[inset_0_0_0_2px_rgba(99,102,241,1)]" : "",
                                isH ? "z-20 ring-2 ring-amber-400 bg-amber-50/30 dark:bg-amber-900/20" : ""
                            )}
                        >
                            <div className="absolute inset-0 bg-amber-500/30 dark:bg-amber-400/20 pointer-events-none" style={{ opacity: intensity / 100 }} />

                            <div className="relative z-10 flex justify-between items-start mb-1">
                                <span className={cn(
                                    "text-[10px] font-mono font-bold",
                                    isToday ? "text-blue-600 underline" : "text-slate-400",
                                    isHol && !isToday ? "text-red-400" : ""
                                )}>
                                    {format(date, 'MM/dd')}
                                </span>
                                {metric && metric.capacityMinutes > 0 && metric.volumeMinutes > 0 && (
                                    <span className="text-[8px] text-slate-300 font-mono">
                                        {Math.round(metric.ratio * 100)}%
                                    </span>
                                )}
                            </div>

                            <div className="relative z-10 space-y-1">
                                {dayItems.slice(0, 4).map(item => {
                                    const proj = projects.find(p => p.id === item.projectId);
                                    const isHighlightedItem = highlightedItemId === item.id;
                                    return (
                                        <div
                                            key={item.id}
                                            id={`cal-chip-${item.id}`}
                                            onClick={(e) => { e.stopPropagation(); onItemClick(item); }}
                                            className={cn(
                                                "px-1.5 py-1 bg-white/90 dark:bg-slate-800/90 border-l-2 text-[9px] font-bold rounded shadow-sm truncate cursor-pointer transition-transform",
                                                isHighlightedItem ? "border-amber-400 scale-105 z-30 ring-1 ring-amber-200" : "border-red-400 text-slate-700 dark:text-slate-300",
                                                item.tenantId ? "border-l-indigo-400" : "border-l-red-400"
                                            )}
                                        >
                                            {proj && <span className="text-slate-400 mr-1">[{proj.name}]</span>}
                                            {renderItemTitle(item)}
                                        </div>
                                    );
                                })}
                                {dayItems.length > 4 && (
                                    <div className="text-[8px] text-slate-400 pl-1 font-bold">他 {dayItems.length - 4} 件 ...</div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

interface GanttViewProps {
    allDays: Date[];
    items: Item[];
    heatMap: Map<string, number>;
    today: Date;
    onItemClick: (item: Item) => void;
    safeConfig: any;
    rowHeight: number;
    projects: any[];
    onJumpToDate?: (date: Date) => void;
    renderItemTitle: (item: Item) => string;
}

const RyokanGanttView: React.FC<GanttViewProps> = ({
    allDays, items, heatMap: _heatMap, today, onItemClick, safeConfig, rowHeight, projects, onJumpToDate, renderItemTitle
}) => {
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="flex-none flex bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 z-20">
                <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">アイテム / プロジェクト</span>
                </div>
                <div className="flex flex-1 overflow-x-auto scrollbar-hide">
                    {allDays.map(date => (
                        <div key={date.toDateString()} className={cn(
                            "w-6 flex-shrink-0 text-center py-2 border-r border-slate-100 dark:border-slate-800/50 flex flex-col items-center",
                            isSameDate(date, today) ? "bg-blue-600/10" : ""
                        )}>
                            <span className="text-[8px] font-bold text-slate-400">{format(date, 'eee', { locale: ja })}</span>
                            <span className={cn(
                                "text-[10px] font-mono font-bold",
                                isSameDate(date, today) ? "text-blue-600" : "text-slate-600 dark:text-slate-400"
                            )}>{date.getDate()}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide" ref={scrollContainerRef}>
                <div className="min-w-max">
                    {items.map(item => {
                        const myDeadline = item.prep_date ? new Date(item.prep_date * 1000) : (item.due_date ? new Date(item.due_date) : null);
                        const wDays = item.work_days || Math.ceil((item.estimatedMinutes || 0) / 480) || 1;
                        let commitStart = myDeadline ? new Date(myDeadline) : null;
                        if (commitStart) {
                            let c = 0;
                            let s = 0;
                            while (c < wDays && s < 60) {
                                s++;
                                if (!isHoliday(commitStart, safeConfig)) c++;
                                if (c < wDays) commitStart.setDate(commitStart.getDate() - 1);
                            }
                        }
                        const project = projects.find(p => p.id === item.projectId);
                        const deadlineDate = myDeadline || (item.due_date ? new Date(item.due_date) : null);

                        return (
                            <div key={item.id} className="flex border-b border-slate-50 dark:border-slate-800/20 group transition-all">
                                <div
                                    className={cn(
                                        "sticky left-0 z-[10] w-64 flex-shrink-0 bg-slate-50/90 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 px-2 flex items-center justify-between transition-colors",
                                        hoveredItemId === item.id ? "bg-indigo-50 dark:bg-indigo-900/40" : ""
                                    )}
                                    style={{ height: `${rowHeight}px` }}
                                    onMouseEnter={() => setHoveredItemId(item.id)}
                                    onMouseLeave={() => setHoveredItemId(null)}
                                >
                                    <div className="flex-1 min-w-0 pr-2 cursor-pointer" onClick={() => deadlineDate && onJumpToDate?.(deadlineDate)}>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className={cn("truncate font-bold tracking-tight", hoveredItemId === item.id ? "text-xs text-indigo-600 dark:text-indigo-400" : "text-[10px] text-slate-500")}>
                                                {renderItemTitle(item)}
                                            </span>
                                            {project && <span className="truncate text-[9px] text-slate-400 ml-1">{project.name}</span>}
                                        </div>
                                        {/* [NEW] Subtly display My Due & Work Days */}
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {item.prep_date && (
                                                <span className="text-[9px] text-slate-400 font-mono tracking-tighter">My: {format(new Date(item.prep_date * 1000), 'MM/dd')}</span>
                                            )}
                                            {item.work_days ? (
                                                <span className="text-[9px] text-slate-400 font-mono tracking-tighter">工: {item.work_days}d</span>
                                            ) : item.estimatedMinutes ? (
                                                <span className="text-[9px] text-slate-400 font-mono tracking-tighter">工: {item.estimatedMinutes}m</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    {hoveredItemId === item.id && (
                                        <button onClick={(e) => { e.stopPropagation(); onItemClick(item); }} className="p-1 rounded bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 text-indigo-500 hover:text-indigo-600"><ChevronRight size={10} /></button>
                                    )}
                                </div>
                                <div className={cn("flex relative transition-all cursor-pointer", hoveredItemId === item.id ? "bg-indigo-50/20 dark:bg-indigo-900/10" : "")} style={{ height: `${rowHeight}px` }}>
                                    {allDays.map(date => {
                                        const isDue = item.due_date && isSameDate(date, new Date(item.due_date));
                                        const isCommit = commitStart && myDeadline && date >= commitStart && date <= myDeadline && !isHoliday(date, safeConfig);
                                        return (
                                            <div key={date.toDateString()} className={cn("w-6 flex-shrink-0 border-r border-slate-50 dark:border-slate-800/20 relative", isDue ? "bg-red-50/50" : "")} onClick={(e) => { e.stopPropagation(); onItemClick(item); /* [FIX] Click on flag/bar space opens detail */ }}>
                                                {isCommit && <div className="absolute inset-y-1 left-0 right-0 bg-indigo-400 dark:bg-indigo-500 rounded-sm" />}
                                                {isDue && <div className="absolute inset-y-0 left-1/2 w-0.5 bg-red-600" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

// --- New Visualization Components ---

interface VolumeCurveProps {
    allDays: Date[];
    metrics: Map<string, QuantityMetric>;
}

const VolumeCurve: React.FC<VolumeCurveProps> = ({ allDays, metrics }) => {
    const rowHeight = 120;
    const totalRows = Math.ceil(allDays.length / 7);
    const totalHeight = totalRows * rowHeight;

    const path = useMemo(() => {
        if (allDays.length === 0) return "";

        const cellWidthPerc = 100 / 7;

        let d = "";
        for (let r = 0; r < totalRows; r++) {
            const rowPoints: { x: number, y: number }[] = [];
            for (let c = 0; c < 7; c++) {
                const idx = r * 7 + c;
                if (idx >= allDays.length) break;

                const dateKey = allDays[idx].toDateString();
                const metric = metrics.get(dateKey);
                const ratio = metric?.ratio || 0;

                const x = c * cellWidthPerc + cellWidthPerc / 2;
                const y = (r + 1) * rowHeight - Math.min(ratio, 1.5) * (rowHeight * 0.4);

                rowPoints.push({ x, y });
            }

            if (rowPoints.length > 0) {
                d += `M ${rowPoints[0].x} ${rowPoints[0].y} `;
                for (let i = 1; i < rowPoints.length; i++) {
                    const prev = rowPoints[i - 1];
                    const curr = rowPoints[i];
                    const cx = (prev.x + curr.x) / 2;
                    d += `Q ${cx} ${prev.y} ${curr.x} ${curr.y} `;
                }
            }
        }
        return d;
    }, [allDays, metrics, totalRows]);

    return (
        <svg
            className="absolute inset-0 w-full h-full pointer-events-none z-0 overflow-visible"
            viewBox={`0 0 100 ${totalHeight}`}
            preserveAspectRatio="none"
        >
            <path
                d={path}
                fill="none"
                stroke="url(#volumeGradient)"
                strokeWidth="0.5"
                strokeLinecap="round"
                className="filter drop-shadow-sm transition-all duration-700"
                vectorEffect="non-scaling-stroke"
            />
        </svg>
    );
};
