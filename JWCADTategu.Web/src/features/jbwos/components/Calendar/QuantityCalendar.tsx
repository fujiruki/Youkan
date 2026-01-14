import React, { useMemo, useEffect, useRef } from 'react';
import { Item } from '../../types';
import { useDroppable } from '@dnd-kit/core';

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

export const QuantityCalendar: React.FC<Props> = ({ items, onItemClick }) => {
    const today = getStartOfToday();

    // [NEW] Signs List Modal State
    const [selectedDate, setSelectedDate] = React.useState<Date | null>(null);
    const [selectedSigns, setSelectedSigns] = React.useState<Item[]>([]);

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

    // Calculate Heatmap (Volume) - Due + Prep Span
    const heatMap = useMemo(() => {
        const map = new Map<string, number>();
        items.forEach(item => {
            // 1. Due Date: Add moderate heat
            if (item.due_date) {
                const d = parseDateString(item.due_date);
                if (d) {
                    const key = d.toDateString();
                    map.set(key, (map.get(key) || 0) + 1.0);
                }
            }
            // 2. Prep Date Span: Add heat for work_days range
            if (item.prep_date) {
                const prepDate = new Date(item.prep_date * 1000);
                const workDays = item.work_days || 1;
                for (let i = 0; i < workDays; i++) {
                    const d = new Date(prepDate);
                    d.setDate(d.getDate() - i);
                    const key = d.toDateString();
                    // Lighter weight for prep items
                    map.set(key, (map.get(key) || 0) + 0.5);
                }
            }
        });
        return map;
    }, [items]);

    // Signs Map (ALL related items for cell click) - Due + Prep
    const signsMap = useMemo(() => {
        const map = new Map<string, Item[]>();
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
                const workDays = item.work_days || 1;
                for (let i = 0; i < workDays; i++) {
                    const d = new Date(prepDate);
                    d.setDate(d.getDate() - i);
                    const key = d.toDateString();
                    if (!map.has(key)) map.set(key, []);
                    // Avoid duplicates
                    const existing = map.get(key)!;
                    if (!existing.find(x => x.id === item.id)) {
                        existing.push(item);
                    }
                }
            }
        });
        return map;
    }, [items]);


    // Auto-scroll to today
    const todayRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        if (todayRef.current) {
            todayRef.current.scrollIntoView({ block: 'center', behavior: 'smooth' });
        }
    }, []);

    // Render Months Logic
    // We group days into "Months" for visual separation headers? 
    // Or just one big grid? User asked "Like a monthly calendar". 
    // Usually means Header: MON TUE ... then grid.
    // If we have multiple months, we might want Month Headers periodically.

    // Group by Month Key (YYYY-MM)
    const months = useMemo(() => {
        const groups: { key: string, label: string, days: Date[] }[] = [];
        let currentMonthKey = '';
        let currentGroup: Date[] = [];

        allDays.forEach(day => {
            const key = `${day.getFullYear()}-${day.getMonth()}`;
            if (key !== currentMonthKey) {
                if (currentGroup.length > 0) {
                    groups.push({
                        key: currentMonthKey,
                        label: currentGroup[0].toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' }),
                        days: currentGroup
                    });
                }
                currentMonthKey = key;
                currentGroup = [];
            }
            currentGroup.push(day);
        });
        // Push last
        if (currentGroup.length > 0) {
            groups.push({
                key: currentMonthKey,
                label: currentGroup[0].toLocaleDateString('ja-JP', { year: 'numeric', month: 'long' }),
                days: currentGroup
            });
        }
        return groups;
    }, [allDays]);


    return (
        <div className="w-full h-full flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* Weekday Header (Sticky) */}
            <div className="flex-none grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-950 text-center py-2 z-20 shadow-sm">
                {['月', '火', '水', '木', '金', '土', '日'].map((day, i) => (
                    <div key={i} className={`text-xs font-bold ${i === 6 ? 'text-red-500' : i === 5 ? 'text-blue-500' : 'text-slate-500'}`}>
                        {day}
                    </div>
                ))}
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto">
                <div className="flex flex-col pb-32">
                    {months.map(month => (
                        <React.Fragment key={month.key}>
                            {/* Days Grid - Continuous, no month header */}
                            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 leading-none">
                                {/* Padding cells for first month only */}
                                {month === months[0] && Array.from({ length: (month.days[0].getDay() + 6) % 7 }).map((_, i) => (
                                    <div key={`pad-start-${month.key}-${i}`} className="bg-slate-50/50 dark:bg-slate-900/50 border-r border-b border-slate-100 dark:border-slate-800" />
                                ))}

                                {month.days.map(date => {
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
                                            className="min-h-[100px] border-r border-b border-slate-200 dark:border-slate-800 relative group"
                                        >
                                            <CalendarCell
                                                date={date}
                                                items={dayItems}
                                                allSigns={allSigns}
                                                isToday={isToday}
                                                isFirstOfMonth={isFirstOfMonth}
                                                isSunday={isSunday}
                                                bgIntensity={bgIntensity}
                                                onItemClick={onItemClick}
                                                onCellClick={(signs) => {
                                                    setSelectedDate(date);
                                                    setSelectedSigns(signs);
                                                }}
                                            />
                                        </div>
                                    );
                                })}
                            </div>
                        </React.Fragment>
                    ))}
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

// Extracted Cell Component for Dnd Hook isolation
const CalendarCell: React.FC<{
    date: Date;
    items: Item[];
    allSigns: Item[]; // [NEW] All items for this day (Due + Prep)
    isToday: boolean;
    isFirstOfMonth: boolean; // [NEW]
    isSunday: boolean; // [NEW]
    bgIntensity: number;
    onItemClick: (item: Item) => void;
    onCellClick: (signs: Item[]) => void; // [NEW] Click handler for cell
}> = ({ date, items, allSigns, isToday, isFirstOfMonth, isSunday, bgIntensity, onItemClick, onCellClick }) => {
    const { setNodeRef, isOver } = useDroppable({
        id: `cal-day-${date.getTime()}`,
        data: { date: date.getTime() }
    });

    return (
        <div
            ref={setNodeRef}
            className={`w-full h-full p-1 flex flex-col relative transition-colors ${isOver ? 'bg-amber-100 dark:bg-amber-900/50' : ''}`}
            onClick={() => {
                // Cell click: show "Signs List" if there are any prep items
                if (allSigns.length > 0) {
                    onCellClick(allSigns);
                }
            }}
        >
            {/* Heatmap Background */}
            <div
                className="absolute inset-0 bg-amber-500 dark:bg-amber-400 pointer-events-none transition-opacity"
                style={{ opacity: isOver ? 0.2 : bgIntensity / 100 }}
            />

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
                    <CalendarItemChip key={item.id} item={item} onClick={() => onItemClick(item)} />
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

const CalendarItemChip: React.FC<{ item: Item & { _virtualType?: string }; onClick: () => void }> = ({ item, onClick }) => {
    const isDue = item._virtualType === 'due';
    const isPrep = item._virtualType === 'prep';

    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}
            className={`
                px-1.5 py-0.5 rounded-[2px] text-[10px] truncate shadow-sm cursor-pointer hover:opacity-80 transition-all
                ${isDue ? 'bg-red-100 text-red-800 border-l-2 border-red-500 font-bold' : ''}
                ${isPrep ? 'bg-white/80 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 blur-[0.3px] hover:blur-0' : ''}
            `}
            title={item.title}
        >
            {item.title}
        </div>
    );
};
