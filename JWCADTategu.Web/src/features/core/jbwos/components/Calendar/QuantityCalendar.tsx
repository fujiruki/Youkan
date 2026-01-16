import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Item } from '../../types';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { isHoliday } from '../../logic/capacity';

// Default config for visualization logic (Standard Weekend Holidays)
const DEFAULT_CAPACITY_CONFIG: any = { // Changed to 'any' as CapacityConfig type is removed
    holidays: [
        { type: 'weekly', value: '0' }, // Sunday
        { type: 'weekly', value: '6' }  // Saturday
    ],
    defaultDailyMinutes: 480, // 8 hours
    exceptions: {}
};

// --- Date Helpers ---
const getStartOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};

const getStartOfWeek = (date: Date) => {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
};

const isSameDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

const parseDateString = (dateStr: string | undefined | null) => {
    if (!dateStr) return null;
    return new Date(dateStr);
};

interface Props {
    items: Item[];
    onItemClick: (item: Item) => void;
}

// [NEW] Pressure Line Type
interface PressureConnection {
    id: string;
    source: { x: number, y: number };
    target: { x: number, y: number };
    color: string;
}

export const QuantityCalendar: React.FC<Props> = ({ items, onItemClick }) => {
    const today = getStartOfToday();

    // [NEW] Signs List Modal State (Now Double Click)
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSigns, setSelectedSigns] = useState<Item[]>([]);

    // [NEW] Pressure Interaction State
    const [pressureConnections, setPressureConnections] = useState<PressureConnection[]>([]);
    const [flashingItemIds, setFlashingItemIds] = useState<Set<string>>(new Set());
    const containerRef = useRef<HTMLDivElement>(null);

    // Range: -6 Months to +1 Year
    // Align start to Monday
    const startDate = useMemo(() => {
        const d = new Date(today);
        d.setMonth(d.getMonth() - 6);
        return getStartOfWeek(d);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const endDate = useMemo(() => {
        const d = new Date(today);
        d.setFullYear(d.getFullYear() + 1);
        return d;
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    // Generate days
    const allDays = useMemo(() => {
        const days: Date[] = [];
        let current = new Date(startDate);
        while (current <= endDate) {
            days.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        return days;
    }, [startDate, endDate]);

    // Group items by date (FOR CHIPS: Due Date ONLY)
    const itemsByDate = useMemo(() => {
        const map = new Map<string, Item[]>();
        items.forEach(item => {
            // ONLY Due Date gets text chips
            if (item.due_date) {
                const d = parseDateString(item.due_date);
                if (d) {
                    const key = d.toDateString();
                    if (!map.has(key)) map.set(key, []);
                    map.get(key)!.push({ ...item, _virtualType: 'due' } as any);
                }
            }
        });
        return map;
    }, [items]);

    // Calculate Heatmap (Volume) - Due + Prep Span (Working Days Only)
    const heatMap = useMemo(() => {
        const map = new Map<string, number>();
        const config = DEFAULT_CAPACITY_CONFIG; // Use local default config

        items.forEach(item => {
            // 1. Due Date: Add moderate heat
            if (item.due_date) {
                const d = parseDateString(item.due_date);
                if (d) {
                    const key = d.toDateString();
                    map.set(key, (map.get(key) || 0) + 1.0);
                }
            }
            // 2. Prep Date Span: Add heat for work_days range (Working Days Only)
            if (item.prep_date) {
                const prepDate = new Date(item.prep_date * 1000);
                // Fallback: If work_days is 1 (default) or missing, try to use estimatedMinutes
                const estimatedDays = item.estimatedMinutes ? Math.ceil(item.estimatedMinutes / 420) : 0; // 7h * 60m = 420m
                const workDays = (item.work_days && item.work_days > 1) ? item.work_days : (estimatedDays || 1);

                let count = 0;
                let current = new Date(prepDate);
                // Safety break to prevent infinite loop
                let safety = 0;

                while (count < workDays && safety < 30) {
                    safety++;

                    // Check if current is holiday
                    // Note: isHoliday expects Date object.
                    // If prep_date itself is a holiday, do we count it?
                    // Spec: "StartDate is Prep Date". If Prep Date is holiday, we might start from NEXT work day?
                    // But current logic is: If today is work day, paint it.
                    // If Prep Date is Holiday, the loop checks isHoliday(current). It returns true.
                    // So we do NOT paint it, and do NOT increment count.
                    // Loop continues to next day. Correct.
                    if (!isHoliday(current, config)) {
                        const key = current.toDateString();
                        map.set(key, (map.get(key) || 0) + 1.0);
                        count++;
                    }

                    // Move to previous day (Backwards)
                    // Spec: "Prep Date" is the TARGET completion date.
                    // "2/4までの3日間" -> 2/2, 2/3, 2/4.
                    current.setDate(current.getDate() - 1);
                }
            }
        });
        return map;
    }, [items]);

    // [MODIFIED] Signs Map (ALL related items for cell click) - Due + Prep (Working Days Only)
    const signsMap = useMemo(() => {
        const map = new Map<string, Item[]>();
        const config = DEFAULT_CAPACITY_CONFIG;

        items.forEach(item => {
            // 1. Due Date
            if (item.due_date) {
                const d = parseDateString(item.due_date);
                if (d) {
                    const key = d.toDateString();
                    if (!map.has(key)) map.set(key, []);
                    map.get(key)!.push(item);
                }
            }
            // 2. Prep Date Span
            if (item.prep_date) {
                const prepDate = new Date(item.prep_date * 1000);
                // Fallback: If work_days is 1 (default) or missing, try to use estimatedMinutes
                const estimatedDays = item.estimatedMinutes ? Math.ceil(item.estimatedMinutes / 420) : 0;
                const workDays = (item.work_days && item.work_days > 1) ? Number(item.work_days) : (estimatedDays || 1);

                let count = 0;
                let current = new Date(prepDate);
                let safety = 0;

                while (count < workDays && safety < 30) {
                    safety++;

                    if (!isHoliday(current, config)) {
                        const key = current.toDateString();
                        if (!map.has(key)) map.set(key, []);
                        const existing = map.get(key)!;
                        if (!existing.find(x => x.id === item.id)) {
                            existing.push(item);
                        }
                        count++;
                    }
                    current.setDate(current.getDate() - 1); // BACKWARD
                }
            }
        });
        return map;
    }, [items]);



    // Auto-scroll to today
    const todayRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (todayRef.current) {
            todayRef.current.scrollIntoView({ block: 'center', behavior: 'auto' }); // Instant scroll, no animation
        }
    }, []);


    // [NEW] Ghost Items State
    const [hoveredDate, setHoveredDate] = useState<Date | null>(null);

    // --- Interaction Handlers ---
    const handleCellAction = (date: Date, signs: Item[], actionType: 'click' | 'doubleClick', rect?: DOMRect) => {
        if (signs.length === 0) return;

        if (actionType === 'doubleClick') {
            // Open Modal
            setSelectedDate(date);
            setSelectedSigns(signs);
            // Clear connections if opening modal
            setPressureConnections([]);
            setFlashingItemIds(new Set());
        } else {
            // Single Click: Draw Pressure Lines & Flash
            if (!rect || !containerRef.current) return;

            const containerRect = containerRef.current.getBoundingClientRect();
            const sourceX = rect.left + rect.width / 2 - containerRect.left;
            const sourceY = rect.top + rect.height / 2 - containerRect.top;

            const newConnections: PressureConnection[] = [];
            const newFlashingIds = new Set<string>();

            // Find target chips in DOM
            signs.forEach(item => {
                const chipId = `cal-chip-${item.id}`;
                const chipEl = document.getElementById(chipId);

                // Only connect if chip is visible in calendar
                if (chipEl) {
                    const chipRect = chipEl.getBoundingClientRect();
                    const targetX = chipRect.left + chipRect.width / 2 - containerRect.left;
                    const targetY = chipRect.top + chipRect.height / 2 - containerRect.top;

                    newConnections.push({
                        id: `${date.getTime()}-${item.id}`,
                        source: { x: sourceX, y: sourceY },
                        target: { x: targetX, y: targetY },
                        color: '#fbbf24' // Amber-400 (improved visibility)
                    });
                    newFlashingIds.add(item.id);
                }
            });

            setPressureConnections(newConnections);
            setFlashingItemIds(newFlashingIds);

            // [MODIFIED] Persistent Effect: Removed auto-clear timeout
            // The effect remains until the next click clears/updates it.
        }
    };

    // [NEW] Clear selection on background click
    const handleBackgroundClick = () => {
        // Only clear if directly clicking the container or empty space
        // (Event propagation from cell stops this if handled there, but we want empty CELLS to clear too?)
        // User said: "Clicking empty cell deselects".
        // If we click a cell with NO signs, handleCellAction returns early.
        // So clicking an empty cell will bubble up to this handler.
        setPressureConnections([]);
        setFlashingItemIds(new Set());
    };


    return (
        <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900 relative" ref={containerRef}>
            {/* DEBUG OVERLAY */}
            <div className="fixed bottom-0 left-0 right-0 h-48 bg-black/80 text-white p-4 overflow-auto z-[9999] text-xs font-mono">
                <h3 className="font-bold border-b border-gray-600 mb-2">Debug Info (v3.1)</h3>
                {items.filter(i => i.title.includes('木組み') || i.title.includes('Coaster')).map(item => {
                    const prepDate = item.prep_date ? new Date(item.prep_date * 1000) : null;
                    const estimatedDays = item.estimatedMinutes ? Math.ceil(item.estimatedMinutes / 420) : 0;
                    const rawWorkDays = item.work_days;
                    const effectiveWorkDays = (Number(rawWorkDays) > 1) ? Number(rawWorkDays) : (estimatedDays || 1);

                    // Re-calculate dates for this item to show what SHOULD be painted
                    const dates = [];
                    if (prepDate) {
                        let count = 0;
                        let current = new Date(prepDate);
                        let safety = 0;
                        const config = DEFAULT_CAPACITY_CONFIG;

                        while (count < effectiveWorkDays && safety < 30) {
                            safety++;
                            if (!isHoliday(current, config)) {
                                dates.push(current.toDateString());
                                count++;
                            }
                            // Important: Match the logic in heatMap (Backward iteration)
                            current.setDate(current.getDate() - 1);
                        }
                    }

                    return (
                        <div key={item.id} className="mb-2 border-b border-gray-700 pb-1">
                            <div className="text-emerald-400 font-bold">{item.title}</div>
                            <div>ID: {item.id}</div>
                            <div>Prep: {prepDate?.toLocaleString()}</div>
                            <div>
                                WorkDays (Effective): <span className="text-amber-400 font-bold">{effectiveWorkDays}</span>
                                <span className="text-gray-400 ml-2">(Raw: {rawWorkDays || 'null'}, Est: {item.estimatedMinutes || 0}m → {estimatedDays}d)</span>
                            </div>
                            <div>Calculated Dates: {dates.join(', ')}</div>
                        </div>
                    );
                })}
            </div>

            {/* SVG Overlay Layer */}
            <svg className="absolute inset-0 pointer-events-none z-50 w-full h-full overflow-visible">
                <defs>
                    <filter id="pressure-glow">
                        <feGaussianBlur stdDeviation="2" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                <AnimatePresence>
                    {pressureConnections.map(conn => (
                        <PressureLine key={conn.id} conn={conn} />
                    ))}
                </AnimatePresence>
            </svg>

            {/* Weekday Header (Sticky) */}
            <div className="flex-none grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-center py-2 z-20 shadow-sm relative">
                {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => (
                    <div key={i} className={`text-xs font-bold ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-slate-500'}`}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto relative z-10"
                onClick={handleBackgroundClick}
            >
                <div className="flex flex-col pb-32">
                    {/* [MODIFIED] Layout Fix: Single Continuous Grid */}
                    <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 leading-none">

                        {/* Padding cells for the very first day only */}
                        {Array.from({ length: (allDays[0].getDay() + 6) % 7 }).map((_, i) => (
                            <div key={`pad-start-${i}`} className="bg-slate-50/50 dark:bg-slate-900/50 border-r border-b border-slate-100 dark:border-slate-800" />
                        ))}

                        {allDays.map(date => {
                            const dateKey = date.toDateString();
                            const dayItems = itemsByDate.get(dateKey) || []; // ONLY Due items
                            const allSigns = signsMap.get(dateKey) || []; // ALL items (Due + Prep)
                            const isToday = isSameDate(date, today);
                            const isFirstOfMonth = date.getDate() === 1;
                            const isSunday = date.getDay() === 0;

                            // Volume Heatmap from heatMap
                            const volume = heatMap.get(dateKey) || 0;
                            const bgIntensity = Math.min(volume * 15, 60);

                            return (
                                <div
                                    key={dateKey}
                                    ref={isToday ? todayRef : null}
                                    className={`min-h-[100px] border-r border-b border-slate-200 dark:border-slate-800 relative group ${isFirstOfMonth ? 'border-t-2 border-t-slate-400 dark:border-t-slate-600' : ''
                                        }`}
                                >
                                    <CalendarCell
                                        date={date}
                                        items={dayItems}
                                        allSigns={allSigns}
                                        isToday={isToday}
                                        isFirstOfMonth={isFirstOfMonth}
                                        isSunday={isSunday}
                                        bgIntensity={bgIntensity}
                                        flashingItemIds={flashingItemIds}
                                        isHovered={hoveredDate ? isSameDate(hoveredDate, date) : false}
                                        onHoverChange={(isHovering) => setHoveredDate(isHovering ? date : null)}
                                        onItemClick={onItemClick}
                                        onCellAction={handleCellAction}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Signs List Modal */}
            {selectedSigns.length > 0 && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
                    onClick={() => {
                        setSelectedDate(null);
                        setSelectedSigns([]);
                    }}
                >
                    <div
                        className="bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-200 dark:border-slate-800 max-w-md w-full max-h-[80vh] overflow-hidden flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800">
                            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
                                この期間に気配があるもの
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                                {selectedDate?.toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })}
                            </p>
                        </div>

                        {/* List */}
                        <div className="flex-1 overflow-y-auto p-4 space-y-2">
                            {selectedSigns.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        onItemClick(item);
                                        setSelectedSigns([]);
                                        setSelectedDate(null);
                                    }}
                                    className="p-3 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors"
                                >
                                    <div className="font-medium text-slate-800 dark:text-slate-200 text-sm">
                                        {item.title}
                                    </div>
                                    <div className="flex gap-2 mt-1 text-xs text-slate-500">
                                        {item.due_date && (
                                            <span className="bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-400 px-2 py-0.5 rounded">
                                                納期: {item.due_date}
                                            </span>
                                        )}
                                        {item.prep_date && (
                                            <span className="bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded">
                                                備え: {new Date(item.prep_date * 1000).toLocaleDateString('ja-JP')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-3 border-t border-slate-200 dark:border-slate-800 flex justify-end">
                            <button
                                onClick={() => {
                                    setSelectedDate(null);
                                    setSelectedSigns([]);
                                }}
                                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// --- Pressure Line Component ---
const PressureLine: React.FC<{ conn: PressureConnection }> = ({ conn }) => {
    // [MODIFIED] Right-Curve Logic
    // We want the line to bulge out to the right to avoid crossing items directly.
    // Logic: 
    // Control Point X = max(source.x, target.x) + offset
    // Control Point Y = typically midpoint, maybe slightly offset.

    // Dynamic offset based on vertical distance magnitude?
    const dy = Math.abs(conn.target.y - conn.source.y);
    const bulge = 60 + (dy * 0.1); // Base bulge + slight increase for longer lines

    // Control Point
    // Force curve to the Right side
    const cpX = Math.max(conn.source.x, conn.target.x) + bulge;
    const cpY = (conn.source.y + conn.target.y) / 2;

    return (
        <motion.path
            d={`M ${conn.source.x} ${conn.source.y} Q ${cpX} ${cpY} ${conn.target.x} ${conn.target.y}`}
            fill="none"
            stroke={conn.color}
            strokeWidth="2.5" // Slightly thinner, more elegant
            strokeLinecap="round"
            filter="url(#pressure-glow)" // Glow effect
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.7 }} // Improved visibility
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
        />
    );
};


// Extracted Cell Component for Dnd Hook isolation
const CalendarCell: React.FC<{
    date: Date;
    items: Item[];
    allSigns: Item[];
    isToday: boolean;
    isFirstOfMonth: boolean;
    isSunday: boolean;
    bgIntensity: number;
    flashingItemIds: Set<string>;
    isHovered: boolean; // [NEW]
    onHoverChange: (isHovering: boolean) => void; // [NEW]
    onItemClick: (item: Item) => void;
    onCellAction: (date: Date, signs: Item[], actionType: 'click' | 'doubleClick', rect?: DOMRect) => void;
}> = ({ date, items, allSigns, isToday, isFirstOfMonth, isSunday, bgIntensity, flashingItemIds, isHovered, onHoverChange, onItemClick, onCellAction }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `cal-day-${date.getTime()}`,
        data: { date: date.getTime() }
    });

    const handleClick = (e: React.MouseEvent) => {
        // Stop propagation so background click doesn't clear immediately
        // If empty (no signs), it effectively does nothing visual here, 
        // but if we want it to Clear, we could call onCellAction with empty?
        // Actually, if signs is empty, handleCellAction returns early. 
        // So clicking an empty cell doesn't invoke "Clear" logic inside handleCellAction.
        // We need explicit clear logic.
        if (allSigns.length === 0) {
            // Treat as background click (Clear)
            // We can just NOT stop propagation? 
            // If we don't stop prop, it hits container onClick which clears.
            // BUT, we stopped prop above.
            // Let's conditionally stop prop.
            return; // Let it bubble to container
        }
        e.stopPropagation(); // Add this line here
        const rect = e.currentTarget.getBoundingClientRect();
        onCellAction(date, allSigns, 'click', rect);
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (allSigns.length === 0) return;

        // Double Click: Open Modal
        // Note: onClick will have fired before this, which is fine (Flash then Modal)
        const rect = e.currentTarget.getBoundingClientRect();
        onCellAction(date, allSigns, 'doubleClick', rect);
    };

    // Calculate Ghost Items (Items in allSigns but NOT visible in chips)
    // Visible chips are items.slice(0, 4)
    // Actually, chips are ONLY `due` items. `allSigns` includes `prep` items too.
    // So "Ghost" is basically anything in `allSigns` that isn't currently displayed as a chip.
    const visibleItemIds = new Set(items.slice(0, 4).map(i => i.id));
    const ghostItems = allSigns.filter(s => !visibleItemIds.has(s.id));

    return (
        <div
            ref={setNodeRef}
            className={`w-full h-full p-1 flex flex-col relative transition-colors ${isOver ? 'bg-amber-100 dark:bg-amber-900/50' : ''}`}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onMouseEnter={() => onHoverChange(true)}
            onMouseLeave={() => onHoverChange(false)}
        >
            {/* Heatmap Background */}
            <div
                className="absolute inset-0 bg-amber-500 dark:bg-amber-400 pointer-events-none transition-opacity"
                style={{ opacity: isOver ? 0.2 : bgIntensity / 100 }}
            />

            {/* Ghost Items Overlay (On Hover) */}
            {isHovered && ghostItems.length > 0 && (
                <div className="absolute inset-0 z-0 p-6 pointer-events-none overflow-hidden flex flex-col justify-end opacity-40">
                    {ghostItems.slice(0, 5).map(g => (
                        <div key={g.id} className="text-[10px] text-slate-800 dark:text-slate-200 truncate font-medium">
                            {g.title}
                        </div>
                    ))}
                    {ghostItems.length > 5 && <div className="text-[9px] text-slate-600">...他{ghostItems.length - 5}件</div>}
                </div>
            )}

            {/* Date Number with Month Label (1st only) */}
            <div className={`text-xs font-mono mb-1 z-10 relative flex items-start justify-between ${isToday ? 'font-bold text-blue-600' :
                isSunday ? 'text-rose-400/70 font-medium' :
                    'text-slate-400'
                }`}>
                <div className="flex flex-col items-start">
                    {isFirstOfMonth && (
                        <span className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5 font-bold">
                            {date.getMonth() + 1}月
                        </span>
                    )}
                    <span className={isToday ? 'bg-blue-100 dark:bg-blue-900/50 px-1.5 rounded-full' : ''}>{date.getDate()}</span>
                </div>
                {items.length > 0 && <span className="text-[10px] text-slate-300 transform scale-75">{items.length}</span>}
            </div>

            {/* Chips */}
            <div className="flex-1 flex flex-col gap-1 z-10 overflow-hidden">
                {items.slice(0, 4).map(item => (
                    <CalendarItemChip
                        key={item.id}
                        item={item}
                        isFlashing={flashingItemIds.has(item.id)}
                        onClick={() => onItemClick(item)}
                    />
                ))}
                {items.length > 4 && (
                    <div className="text-[10px] text-slate-400 text-center leading-none">
                        +{items.length - 4}
                    </div>
                )}
            </div>
        </div>
    );
};

const CalendarItemChip: React.FC<{ item: Item & { _virtualType?: string }; isFlashing: boolean; onClick: () => void }> = ({ item, isFlashing, onClick }) => {
    const isDue = item._virtualType === 'due';
    const isPrep = item._virtualType === 'prep';
    const chipId = `cal-chip-${item.id}`; // [NEW] ID for connection target

    return (
        <div
            id={chipId}
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`
                px-1.5 py-0.5 rounded-[2px] text-[10px] truncate shadow-sm cursor-pointer transition-all duration-300
                ${isDue ? 'bg-red-100 text-red-800 border-l-2 border-red-500 font-bold' : ''}
                ${isPrep ? 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 blur-[0.3px] hover:blur-0' : ''}
                ${isFlashing ? 'ring-2 ring-amber-400 ring-offset-1 scale-105 z-20 brightness-110 !blur-0' : 'hover:opacity-80'}
            `}
            title={item.title}
        >
            {item.title}
        </div>
    );
};
