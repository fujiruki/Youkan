import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Item, FilterMode } from '../../types';
import { useDroppable } from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';
import { isHoliday } from '../../logic/capacity';
import { calculateDailyVolume, DEFAULT_CAPACITY_CONFIG } from '../../logic/volumeCalculator';
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface RyokanCalendarProps {
    items: Item[];
    onItemClick: (item: Item) => void;
    capacityConfig?: any;

    // UI Options
    layoutMode?: 'panorama' | 'mini';
    filterMode?: FilterMode;

    // External Volume Mapping
    externalVolumeMap?: Map<string, number>;
    intensityScale?: number;

    // Interactions
    onSelectDate?: (date: Date) => void;
    selectedDate?: Date | null;
    prepDate?: Date | null;
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
    filterMode = 'all',
    externalVolumeMap,
    intensityScale = 15,
    onSelectDate,
    selectedDate: propSelectedDate,
    prepDate: propPrepDate
}) => {
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

    const todayRef = useRef<HTMLDivElement>(null);
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
        <div className={cn("ryokan-calendar w-full h-full flex flex-col relative overflow-hidden", isMini ? "bg-white dark:bg-slate-900" : "bg-slate-50 dark:bg-slate-900", isMini ? "border-l-4 border-indigo-200 dark:border-indigo-800" : "")} ref={containerRef}>
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

            {/* Continuous Stream Flow */}
            <div className={cn("flex-1 overflow-auto scrollbar-hide select-none", isMini ? "overflow-y-auto" : "overflow-x-auto")}>
                <div className={cn("flex min-w-max h-full", isMini ? "flex-col w-full" : "flex-row")}>
                    {allDays.map(date => {
                        const dateKey = date.toDateString();
                        const dayItems = itemsByDate.get(dateKey) || [];
                        const allSigns = signsMap.get(dateKey) || [];
                        const isToday = isSameDate(date, today);
                        const isFirst = date.getDate() === 1;
                        const volume = heatMap.get(dateKey) || 0;
                        const intensity = Math.min(volume * intensityScale, 60);
                        const isS = propSelectedDate ? isSameDate(date, propSelectedDate) : false;
                        const isP = propPrepDate ? isSameDate(date, propPrepDate) : false;

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

            {/* Modal for detail view in Panorama Mode */}
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
