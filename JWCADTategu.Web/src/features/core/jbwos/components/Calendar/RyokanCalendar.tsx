import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Item, FilterMode } from '../../types';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { isHoliday } from '../../logic/capacity';
import { calculateDailyVolume, DEFAULT_CAPACITY_CONFIG } from '../../logic/volumeCalculator';
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

export type RyokanDisplayMode = 'grid' | 'timeline' | 'gantt';

interface RyokanCalendarProps {
    items: Item[];
    onItemClick: (item: Item) => void;
    capacityConfig?: any;

    // UI Options
    layoutMode?: 'panorama' | 'mini';
    displayMode?: RyokanDisplayMode; // [NEW]
    filterMode?: FilterMode;

    // External Volume Mapping
    externalVolumeMap?: Map<string, number>;
    intensityScale?: number;

    // Interactions
    onSelectDate?: (date: Date) => void;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    rowHeight?: number;
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
    layoutMode = 'panorama',
    displayMode: propDisplayMode,
    filterMode = 'all',
    externalVolumeMap,
    intensityScale = 15,
    onSelectDate,
    selectedDate: propSelectedDate,
    prepDate: propPrepDate,
    rowHeight = 12
}) => {
    const [displayMode, setDisplayMode] = useState<RyokanDisplayMode>(propDisplayMode || (layoutMode === 'mini' ? 'timeline' : 'grid'));
    const today = getStartOfToday();
    const isMini = layoutMode === 'mini';
    const containerRef = useRef<HTMLDivElement>(null);

    // State
    const [selectedSigns, setSelectedSigns] = useState<Item[]>([]);
    const [pressureConnections, setPressureConnections] = useState<PressureConnection[]>([]);
    const [flashingItemIds, setFlashingItemIds] = useState<Set<string>>(new Set());

    const safeConfig = useMemo(() => {
        if (capacityConfig && capacityConfig.holidays) return capacityConfig;
        return DEFAULT_CAPACITY_CONFIG;
    }, [capacityConfig]);

    // Range: 
    // Panorama: -6 Months to +1 Year
    // Mini: -1 Month to +4 Months
    const startDate = useMemo(() => {
        const d = new Date(today);
        d.setMonth(d.getMonth() - (isMini ? 1 : 6));
        return getStartOfWeek(d);
    }, [isMini]);

    const endDate = useMemo(() => {
        const d = new Date(today);
        d.setMonth(d.getMonth() + (isMini ? 4 : 12));
        return d;
    }, [isMini]);

    const allDays = useMemo(() => {
        const days: Date[] = [];
        let current = new Date(startDate);
        while (current <= endDate) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    }, [startDate, endDate]);

    const heatMap = useMemo(() => {
        if (externalVolumeMap) return externalVolumeMap;
        return calculateDailyVolume(items, safeConfig, filterMode);
    }, [items, safeConfig, filterMode, externalVolumeMap]);

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to strategic positions based on displayMode
    useEffect(() => {
        if (!scrollContainerRef.current || allDays.length === 0) return;

        let targetDate = today;
        let offsetDays = 0;
        let cellWidth = 24; // Default for timeline/gantt (w-6)

        if (displayMode === 'gantt' || displayMode === 'timeline') {
            cellWidth = 24;
            if (displayMode === 'gantt') {
                // [NEW] 3 days from left (offset = -3)
                offsetDays = -3;
            } else {
                // 'timeline' -> Start of current week
                targetDate = getStartOfWeek(today);
                offsetDays = 0;
            }
        } else if (displayMode === 'grid') {
            cellWidth = 112; // Adjusted average
            // 'grid' -> Start of current month
            targetDate = new Date(today.getFullYear(), today.getMonth(), 1);
            offsetDays = 0;
        }

        const targetIndex = allDays.findIndex(d => isSameDate(d, targetDate));
        if (targetIndex !== -1) {
            const scrollTarget = Math.max(0, (targetIndex + offsetDays) * cellWidth);
            scrollContainerRef.current.scrollLeft = scrollTarget;
        }
    }, [allDays, today, displayMode]);

    const itemsByDate = useMemo(() => {
        const map = new Map<string, Item[]>();
        items.forEach(item => {
            if (item.due_date) {
                const d = new Date(item.due_date);
                if (!isNaN(d.getTime())) {
                    const key = d.toDateString();
                    if (!map.has(key)) map.set(key, []);
                    map.get(key)!.push(item);
                }
            }
        });
        return map;
    }, [items]);

    const signsMap = useMemo(() => {
        const map = new Map<string, Item[]>();
        items.forEach(item => {
            if (item.due_date) {
                const d = new Date(item.due_date);
                if (!isNaN(d.getTime())) {
                    const key = d.toDateString();
                    if (!map.has(key)) map.set(key, []);
                    map.get(key)!.push(item);
                }
            }
            if (item.prep_date) {
                const prepDate = new Date(item.prep_date * 1000);
                const workDays = item.work_days || Math.ceil((item.estimatedMinutes || 0) / 480) || 1;
                let count = 0;
                let current = new Date(prepDate);
                let safety = 0;
                while (count < workDays && safety < 30) {
                    safety++;
                    if (!isHoliday(current, safeConfig)) {
                        const key = current.toDateString();
                        if (!map.has(key)) map.set(key, []);
                        const existing = map.get(key)!;
                        if (!existing.find(x => x.id === item.id)) existing.push(item);
                        count++;
                    }
                    current.setDate(current.getDate() - 1);
                }
            }
        });
        return map;
    }, [items, safeConfig]);

    // ViewDispatcher にロジックを委譲。メインのステートは props または共通の計算結果から取得

    return (
        <div className={cn("ryokan-calendar w-full h-full flex flex-col relative overflow-hidden", isMini ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-900", isMini ? "border-l-4 border-indigo-200 dark:border-indigo-800" : "")} ref={containerRef}>
            {/* Mode Switcher (Visible in Full View) */}
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

            {/* View Dispatcher */}
            <div className="flex-1 overflow-hidden relative">
                {displayMode === 'timeline' && (
                    <RyokanTimelineView
                        allDays={allDays}
                        itemsByDate={itemsByDate}
                        signsMap={signsMap}
                        heatMap={heatMap}
                        today={today}
                        selectedDate={propSelectedDate}
                        prepDate={propPrepDate}
                        intensityScale={intensityScale}
                        isMini={isMini}
                        flashingItemIds={flashingItemIds}
                        pressureConnections={pressureConnections}
                        onItemClick={onItemClick}
                        onSelectDate={onSelectDate}
                        setPressureConnections={setPressureConnections}
                        setFlashingItemIds={setFlashingItemIds}
                        setSelectedSigns={setSelectedSigns}
                        safeConfig={safeConfig}
                    />
                )}
                {displayMode === 'grid' && (
                    <RyokanGridView
                        allDays={allDays}
                        itemsByDate={itemsByDate}
                        heatMap={heatMap}
                        today={today}
                        onItemClick={onItemClick}
                        safeConfig={safeConfig}
                        isMini={isMini}
                    />
                )}
                {displayMode === 'gantt' && (
                    <RyokanGanttView
                        allDays={allDays}
                        items={items}
                        heatMap={heatMap}
                        today={today}
                        onItemClick={onItemClick}
                        safeConfig={safeConfig}
                        rowHeight={rowHeight}
                    />
                )}
            </div>

            {/* Modal for detail view */}
            {selectedSigns.length > 0 && !onSelectDate && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm" onClick={() => setSelectedSigns([])}>
                    <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 max-w-sm w-full p-6" onClick={e => e.stopPropagation()}>
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4">この期間の気配</h3>
                        <div className="space-y-2">
                            {selectedSigns.map(s => (
                                <div key={s.id} onClick={() => { onItemClick(s); setSelectedSigns([]); }} className="p-3 border rounded-lg hover:bg-slate-50 cursor-pointer text-xs font-bold">{s.title}</div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

interface TimelineViewProps {
    allDays: Date[];
    itemsByDate: Map<string, Item[]>;
    signsMap: Map<string, Item[]>;
    heatMap: Map<string, number>;
    today: Date;
    selectedDate: Date | null | undefined;
    prepDate: Date | null | undefined;
    intensityScale: number;
    isMini: boolean;
    flashingItemIds: Set<string>;
    pressureConnections: PressureConnection[];
    onItemClick: (item: Item) => void;
    onSelectDate?: (date: Date) => void;
    setPressureConnections: (conns: PressureConnection[]) => void;
    setFlashingItemIds: (ids: Set<string>) => void;
    setSelectedSigns: (items: Item[]) => void;
    safeConfig: any;
}

const RyokanTimelineView: React.FC<TimelineViewProps> = ({
    allDays, itemsByDate, signsMap, heatMap, today,
    selectedDate, prepDate, intensityScale, isMini,
    flashingItemIds, pressureConnections, onItemClick, onSelectDate,
    setPressureConnections, setFlashingItemIds, setSelectedSigns, safeConfig
}) => {
    const todayRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (todayRef.current) {
            todayRef.current.scrollIntoView({ inline: 'center', block: 'center', behavior: 'auto' });
        }
    }, [isMini]);

    const handleCellAction = (date: Date, signs: Item[], actionType: 'click' | 'doubleClick', rect?: DOMRect) => {
        if (onSelectDate) onSelectDate(date);

        if (signs.length === 0) {
            setPressureConnections([]);
            setFlashingItemIds(new Set());
            return;
        }

        if (actionType === 'doubleClick' && !onSelectDate) {
            setSelectedSigns(signs);
            setPressureConnections([]);
            setFlashingItemIds(new Set());
        } else if (actionType === 'click') {
            if (!rect || !containerRef.current) return;
            const containerRect = containerRef.current.getBoundingClientRect();
            const sourceX = rect.left + rect.width / 2 - containerRect.left;
            const sourceY = rect.top + rect.height / 2 - containerRect.top;
            const newConnections: PressureConnection[] = [];
            const newFlashingIds = new Set<string>();

            signs.forEach(item => {
                const chipId = `cal-chip-${item.id}`;
                const chipEl = document.getElementById(chipId);
                if (chipEl) {
                    const chipRect = chipEl.getBoundingClientRect();
                    newConnections.push({
                        id: `${date.getTime()}-${item.id}`,
                        source: { x: sourceX, y: sourceY },
                        target: { x: chipRect.left + chipRect.width / 2 - containerRect.left, y: chipRect.top + chipRect.height / 2 - containerRect.top },
                        color: '#fbbf24'
                    });
                    newFlashingIds.add(item.id);
                }
            });
            setPressureConnections(newConnections);
            setFlashingItemIds(newFlashingIds);
        }
    };

    return (
        <div className="w-full h-full relative overflow-hidden" ref={containerRef}>
            {/* SVG Layer for Pressure Lines */}
            {!isMini && (
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
            )}

            <div className={cn("flex-1 h-full overflow-auto scrollbar-hide select-none", isMini ? "overflow-y-auto" : "overflow-x-auto")}>
                <div className={cn("flex min-w-max h-full", isMini ? "flex-col w-full" : "flex-row")}>
                    {allDays.map(date => {
                        const dateKey = date.toDateString();
                        const dayItems = itemsByDate.get(dateKey) || [];
                        const allSigns = signsMap.get(dateKey) || [];
                        const isToday = isSameDate(date, today);
                        const isFirst = date.getDate() === 1;
                        const volume = heatMap.get(dateKey) || 0;
                        const intensity = Math.min(volume * intensityScale, 60);
                        const isS = selectedDate ? isSameDate(date, selectedDate) : false;
                        const isP = prepDate ? isSameDate(date, prepDate) : false;

                        return (
                            <CalendarCell
                                key={dateKey}
                                date={date}
                                items={dayItems}
                                allSigns={allSigns}
                                isToday={isToday}
                                isFirst={isFirst}
                                intensity={intensity}
                                isMini={isMini}
                                isSelected={isS}
                                isPrep={isP}
                                isHoliday={isHoliday(date, safeConfig)}
                                flashingIds={flashingItemIds}
                                ref={isToday ? todayRef : null}
                                onAction={handleCellAction}
                                onItemClick={onItemClick}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};

interface GridViewProps {
    allDays: Date[];
    itemsByDate: Map<string, Item[]>;
    heatMap: Map<string, number>;
    today: Date;
    onItemClick: (item: Item) => void;
    safeConfig: any;
    isMini?: boolean;
}

const RyokanGridView: React.FC<GridViewProps> = ({
    allDays, itemsByDate, heatMap, today, onItemClick, safeConfig, isMini
}) => {
    const todayGridRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (todayGridRef.current) {
            todayGridRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
    }, [isMini]);

    // 7 columns fixed
    const weekDays = ['月', '火', '水', '木', '金', '土', '日'];

    return (
        <div className="w-full h-full overflow-y-auto p-4 bg-white dark:bg-slate-900 select-none">
            <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
                {/* Header */}
                {weekDays.map(d => (
                    <div key={d} className="bg-slate-100 dark:bg-slate-800 p-2 text-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter border-b border-slate-200 dark:border-slate-700">
                        {d}
                    </div>
                ))}

                {/* Days */}
                {allDays.map(date => {
                    const dateKey = date.toDateString();
                    const dayItems = itemsByDate.get(dateKey) || [];
                    const isToday = isSameDate(date, today);
                    const volume = heatMap.get(dateKey) || 0;
                    const intensity = Math.min(volume * 15, 60);
                    const isHol = isHoliday(date, safeConfig);

                    return (
                        <div
                            key={dateKey}
                            ref={isToday ? todayGridRef : null}
                            className={cn(
                                isMini ? "min-h-[60px]" : "min-h-[100px]",
                                "p-1 relative flex flex-col group transition-colors",
                                isHol ? "bg-red-50/20 dark:bg-red-900/10" : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                            )}
                        >
                            {/* Heatmap Layer */}
                            <div
                                className="absolute inset-0 bg-amber-500/30 dark:bg-amber-400/20 pointer-events-none transition-opacity"
                                style={{ opacity: intensity / 100 }}
                            />

                            <div className="relative z-10 flex justify-between items-start mb-1">
                                <span className={cn(
                                    "text-xs font-mono font-bold",
                                    isToday ? "bg-blue-600 text-white rounded-full w-5 h-5 flex items-center justify-center -mt-0.5" : "text-slate-400"
                                )}>
                                    {date.getDate()}
                                </span>
                                {date.getDate() === 1 && (
                                    <span className="text-[10px] font-bold text-indigo-400 uppercase">
                                        {format(date, 'MMM')}
                                    </span>
                                )}
                            </div>

                            <div className="relative z-10 space-y-1">
                                {dayItems.slice(0, 4).map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => onItemClick(item)}
                                        className="px-1.5 py-0.5 bg-red-50 dark:bg-red-900/30 border-l-2 border-red-500 text-[10px] font-bold text-red-900 dark:text-red-200 rounded-sm truncate cursor-pointer hover:shadow-sm transition-shadow"
                                        title={item.title}
                                    >
                                        {item.title}
                                    </div>
                                ))}
                                {dayItems.length > 4 && (
                                    <div className="text-[9px] text-slate-400 font-bold pl-1">
                                        +{dayItems.length - 4} items
                                    </div>
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
}

const RyokanGanttView: React.FC<GanttViewProps> = ({
    allDays, items, heatMap, today, onItemClick, safeConfig, rowHeight
}) => {
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

    // Sort items by due date (default)
    const sortedItems = useMemo(() => {
        return [...items].sort((a, b) => {
            const da = a.due_date ? new Date(a.due_date).getTime() : Infinity;
            const db = b.due_date ? new Date(b.due_date).getTime() : Infinity;
            return da - db;
        });
    }, [items]);

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            {/* Unified Scrollable Container */}
            <div className="flex-1 overflow-auto scrollbar-thin relative select-none">
                <div className="min-w-max">
                    {/* Header - Sticky top for vertical scrolling */}
                    <div className="sticky top-0 z-[30] flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                        {/* Corner - Sticky left and top */}
                        <div className="sticky left-0 z-[40] w-48 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 p-2 text-[10px] font-bold text-slate-400 uppercase">
                            アイテム名
                        </div>
                        {/* Day Header */}
                        <div className="flex">
                            {allDays.map(date => {
                                const isMon = date.getDay() === 1;
                                return (
                                    <div key={date.toDateString()} className={cn(
                                        "w-6 flex-shrink-0 text-center py-1 border-r border-slate-100 dark:border-slate-800 text-[8px] font-mono",
                                        isMon ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold" : "text-slate-300"
                                    )}>
                                        {isMon ? format(date, 'MM/dd') : date.getDate()}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Body */}
                    {sortedItems.map(item => {
                        // Commmit Period Calculation
                        const myDeadline = item.prep_date ? new Date(item.prep_date * 1000) : (item.due_date ? new Date(item.due_date) : null);
                        const workDays = item.work_days || Math.ceil((item.estimatedMinutes || 0) / 480) || 1;

                        const commitStart = myDeadline ? new Date(myDeadline) : null;
                        if (commitStart) {
                            // Backtrack workDays skipping holidays
                            let c = 0;
                            let safety = 0;
                            while (c < workDays && safety < 60) {
                                safety++;
                                if (!isHoliday(commitStart, safeConfig)) {
                                    c++;
                                }
                                if (c < workDays) commitStart.setDate(commitStart.getDate() - 1);
                            }
                        }

                        return (
                            <div key={item.id} className="flex border-b border-slate-50 dark:border-slate-800/20 group transition-all">
                                {/* Fixed Label - Sticky left */}
                                <div
                                    className={cn(
                                        "sticky left-0 z-[10] w-48 flex-shrink-0 bg-slate-50/90 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 px-2 truncate flex items-center shadow-[2px_0_5px_rgba(0,0,0,0.02)]",
                                        hoveredItemId === item.id ? "text-xs font-bold text-indigo-600 dark:text-indigo-400" : "text-[8px] text-slate-400"
                                    )}
                                    style={{ height: `${rowHeight}px` }}
                                    onMouseEnter={() => setHoveredItemId(item.id)}
                                    onMouseLeave={() => setHoveredItemId(null)}
                                    onClick={() => onItemClick(item)}
                                >
                                    {item.title}
                                </div>

                                {/* Bars Area */}
                                <div
                                    className={cn(
                                        "flex relative transition-all",
                                        hoveredItemId === item.id ? "bg-indigo-50/20 dark:bg-indigo-900/10" : ""
                                    )}
                                    style={{ height: `${rowHeight}px` }}
                                    onMouseEnter={() => setHoveredItemId(item.id)}
                                    onMouseLeave={() => setHoveredItemId(null)}
                                >
                                    {allDays.map(date => {
                                        const dateKey = date.toDateString();
                                        const isToday = isSameDate(date, today);
                                        const vol = heatMap.get(dateKey) || 0;
                                        const intensity = Math.min(vol * 15, 60);

                                        // Check if date is in commit period
                                        const isCommit = commitStart && myDeadline && date >= commitStart && date <= myDeadline && !isHoliday(date, safeConfig);
                                        const isFirstCommitDay = isCommit && (!commitStart || isSameDate(date, commitStart));

                                        // Due Date Marker
                                        const isDue = item.due_date && isSameDate(date, new Date(item.due_date));

                                        return (
                                            <div key={dateKey} className={cn(
                                                "w-6 flex-shrink-0 border-r border-slate-50 dark:border-slate-800/20 relative",
                                                isToday ? "bg-blue-50/10" : "",
                                                isDue ? "bg-red-50/50 dark:bg-red-900/20" : ""
                                            )}>
                                                {/* Daily Heatmap (Atmosphere) */}
                                                <div className="absolute inset-0 bg-amber-400/10" style={{ opacity: intensity / 100 }} />

                                                {/* Commit Period Bar */}
                                                {isCommit && (
                                                    <div className={cn(
                                                        "absolute inset-y-1 left-0 right-0 bg-indigo-400 dark:bg-indigo-500 rounded-sm shadow-sm flex items-center overflow-hidden",
                                                        hoveredItemId === item.id ? "opacity-100" : "opacity-70"
                                                    )}>
                                                        {isFirstCommitDay && (
                                                            <span className="ml-1 text-[7px] text-white font-bold whitespace-nowrap pointer-events-none select-none drop-shadow-sm">
                                                                実制作
                                                            </span>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Due Date Marker */}
                                                {isDue && (
                                                    <div className="absolute inset-y-0 left-1/2 w-0.5 bg-red-600 dark:bg-red-400 z-[5] shadow-[0_0_8px_rgba(220,38,38,0.5)]">
                                                        <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-red-600 dark:bg-red-400" />
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Legend / Info */}
            <div className="px-4 py-1.5 bg-slate-50 dark:bg-slate-800 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[10px] text-slate-400 font-bold">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1.5 text-indigo-500">
                        <div className="w-3 h-2 bg-indigo-400 rounded-sm" />
                        <span>実制作期間</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-red-500">
                        <div className="w-3 h-2 bg-red-50 border border-red-200 dark:bg-red-900/40 rounded-sm" />
                        <span>納期</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-0.5 h-3 bg-red-600" />
                        <span>納期マーカー</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-2 bg-amber-400/20" />
                        <span>全体量感（背景ヒートマップ）</span>
                    </div>
                </div>
                <div className="italic">
                    ※行をホバーすると詳細を確認できます
                </div>
            </div>
        </div>
    );
};

const CalendarCell = React.forwardRef<HTMLDivElement, {
    date: Date, items: Item[], allSigns: Item[], isToday: boolean, isFirst: boolean, intensity: number, isMini: boolean, isSelected: boolean, isPrep: boolean, isHoliday: boolean, flashingIds: Set<string>, onAction: any, onItemClick: any
}>(({ date, items, allSigns, isToday, isFirst, intensity, isMini, isSelected, isPrep, isHoliday, flashingIds, onAction, onItemClick }, ref) => {
    const { setNodeRef, isOver } = useDroppable({ id: `ryokan-${date.getTime()}`, data: { date: date.getTime() } });

    return (
        <div
            ref={(el) => { setNodeRef(el); if (typeof ref === 'function') ref(el); else if (ref) ref.current = el; }}
            className={cn(
                "calendar-cell relative transition-all duration-300",
                isMini ? "w-full h-10 border-b flex items-center px-4" : "w-28 h-full border-r flex flex-col p-2",
                isHoliday ? "bg-red-50/10 dark:bg-red-900/5" : "bg-white dark:bg-slate-900",
                isSelected ? "ring-2 ring-red-400 z-10 bg-red-50 dark:bg-red-900/20" : "",
                isPrep && !isSelected ? "ring-2 ring-indigo-400 z-10 bg-indigo-50 dark:bg-indigo-900/20" : "",
                isOver ? "bg-amber-100 dark:bg-amber-900/40" : ""
            )}
            onClick={(e) => {
                e.stopPropagation();
                onAction(date, allSigns, 'click', e.currentTarget.getBoundingClientRect());
            }}
            onDoubleClick={(e) => {
                e.stopPropagation();
                onAction(date, allSigns, 'doubleClick', e.currentTarget.getBoundingClientRect());
            }}
        >
            {/* Heatmap */}
            <div className="absolute inset-0 bg-amber-500/40 dark:bg-amber-400/30 pointer-events-none" style={{ opacity: intensity / 100 }} />

            <div className={cn("flex", isMini ? "items-center gap-4 w-full" : "flex-col w-full h-full")}>
                <div className={isMini ? "w-10 flex-shrink-0" : "flex items-start justify-between mb-1"}>
                    <div className="flex flex-col">
                        {isFirst && !isMini && <span className="text-[10px] font-bold text-slate-400">{format(date, 'MMM', { locale: ja })}</span>}
                        <span className={cn("text-xs font-mono", isToday ? "font-bold text-blue-600 underline" : "text-slate-500")}>
                            {isMini ? format(date, 'MM/dd') : date.getDate()}
                        </span>
                    </div>
                </div>

                <div className={cn("flex-1 flex gap-1", isMini ? "flex-row overflow-x-auto" : "flex-col overflow-hidden")}>
                    {items.slice(0, isMini ? 10 : 3).map(i => (
                        <div key={i.id} id={`cal-chip-${i.id}`} onClick={(e) => { e.stopPropagation(); onItemClick(i); }} className={cn("px-1.5 py-0.5 rounded text-[10px] truncate shadow-sm cursor-pointer border-l-2 border-red-400 bg-red-50 text-red-900 font-bold", flashingIds.has(i.id) ? "ring-2 ring-amber-400 scale-105" : "")}>
                            {i.title}
                        </div>
                    ))}
                    {!isMini && items.length > 3 && <span className="text-[8px] text-slate-400 text-center">+{items.length - 3}</span>}
                    {isMini && items.length > 10 && <span className="text-[8px] text-slate-400">...</span>}
                </div>
            </div>
        </div>
    );
});
