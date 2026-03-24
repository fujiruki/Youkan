import React, { useState, useMemo } from 'react';
import { DndContext, useDroppable, DragOverlay, useSensors, useSensor, PointerSensor } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useYoukanViewModel } from '../youkan/viewmodels/useYoukanViewModel';
import { Item, CapacityConfig } from '../youkan/types';
import { getDailyCapacity, isHoliday } from '../youkan/logic/capacity';
import { format, addDays, startOfDay, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { cn } from '../../../lib/utils';
import { Package } from 'lucide-react';

// --- Types ---
interface DayStatus {
    type: 'head' | 'ghost';
    daysLeft: number; // 0=Due Today
    item: Item;
}

// --- Components ---
const DraggableItem = ({ item, isGhost, isOverlay, ...props }: any) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
        data: { item }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
    };

    return (
        <div ref={setNodeRef} style={style} {...props}>
            <ItemCard
                item={item}
                type="plan"
                isGhost={isGhost}
                isDragging={isDragging}
                listeners={listeners}
                attributes={attributes}
            />
        </div>
    );
};

// Item Card Component
const ItemCard = ({ item, type, isGhost, isDragging, style, listeners, attributes, daysLeft, onClick }: {
    item: Item;
    type: 'stock' | 'plan';
    isGhost?: boolean;
    isDragging?: boolean;
    style?: React.CSSProperties;
    listeners?: any;
    attributes?: any;
    daysLeft?: number;
    onClick?: (item: Item) => void;
}) => {
    return (
        <div
            className={cn(
                "group relative bg-white dark:bg-slate-800 rounded-lg p-2.5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md transition-all cursor-grab active:cursor-grabbing",
                isGhost && "opacity-50 grayscale border-dashed",
                isDragging && "shadow-xl ring-2 ring-primary rotate-2 z-50 opacity-90",
                type === 'stock' && "hover:border-l-4 hover:border-l-indigo-500"
            )}
            style={style}
            {...listeners}
            {...attributes}
            onClick={() => onClick?.(item)}
        >
            <div className="flex justify-between items-start gap-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-200 line-clamp-2">
                    {item.title}
                </span>
                {daysLeft !== undefined && (
                    <span className={cn(
                        "text-[10px] px-1.5 py-0.5 rounded-full font-bold whitespace-nowrap",
                        daysLeft < 0 ? "bg-red-100 text-red-600" :
                            daysLeft === 0 ? "bg-amber-100 text-amber-600" :
                                "bg-slate-100 text-slate-500"
                    )}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}日遅れ` :
                            daysLeft === 0 ? "今日" :
                                `あと${daysLeft}日`}
                    </span>
                )}
            </div>

            {(item.estimatedMinutes || item.work_days) && (
                <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
                    <span className="flex items-center gap-1">
                        <Package size={10} />
                        {item.estimatedMinutes ? `${item.estimatedMinutes}min` : `${item.work_days}日`}
                    </span>
                </div>
            )}
        </div>
    );
};

// Day Column
const DayColumn = ({ day, vm, setEditingItem }: { day: Date, vm: any, setEditingItem: (item: Item | null) => void }) => {
    const dayTs = Math.floor(day.getTime() / 1000);
    const isHolidayDay = isHoliday(day, vm.capacityConfig);
    const capacity = getDailyCapacity(day, vm.capacityConfig);
    const dayLabel = format(day, 'M/d (E)', { locale: ja });

    // Find Items for this day
    const dayItems: { item: Item, status: 'head' | 'ghost', daysLeft: number }[] = [];

    // Simple Logic: Iterate active/prep items and check if their "schedule" lands here
    // For MVP Board, we rely on 'prep_date' mainly.
    // And 'work_days' to project ghosts.

    vm.gdbPreparation.forEach((item: Item) => {
        const status = getItemStatusForDay(item, day, vm.capacityConfig);
        if (status) {
            dayItems.push({ item, status: status.type, daysLeft: status.daysLeft });
        }
    });

    const { setNodeRef, isOver } = useDroppable({
        id: `day-${dayTs}`,
        data: { date: dayTs }
    });

    return (
        <div
            ref={setNodeRef}
            className={cn(
                "flex-none w-64 flex flex-col h-full bg-slate-50/50 dark:bg-slate-900/30 border-r border-slate-200 dark:border-slate-800",
                isHolidayDay && "bg-red-50/30 dark:bg-red-900/10",
                isOver && "bg-indigo-50 dark:bg-indigo-900/20"
            )}
        >
            {/* Header */}
            <div
                className={cn(
                    "p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors",
                    isHolidayDay ? "text-red-500" : "text-slate-700 dark:text-slate-300"
                )}
                onClick={() => vm.toggleHoliday(day)}
                title="クリックで休日切り替え"
            >
                <div>
                    <span className="font-bold text-lg">{dayLabel}</span>
                    <div className="text-[10px] opacity-70 mt-0.5">
                        {isHolidayDay ? "休日 (Holiday)" : `稼働: ${Math.floor(capacity / 60)}h ${capacity % 60}m`}
                    </div>
                </div>
                {isHolidayDay && <div className="text-[10px] border border-red-200 rounded px-1">OFF</div>}
            </div>

            {/* List */}
            <div className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[100px]">
                {dayItems.map(({ item, status, daysLeft }) => (
                    <div key={`${item.id}-${dayTs}`} onClick={() => setEditingItem(item)}>
                        <ItemCard
                            item={item}
                            type="plan"
                            isGhost={status === 'ghost'}
                            daysLeft={daysLeft}
                        />
                    </div>
                ))}
                {dayItems.length === 0 && !isHolidayDay && (
                    <div className="h-20 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-lg flex items-center justify-center text-slate-300 text-xs">
                        Drop Here
                    </div>
                )}
            </div>
        </div>
    );
};

// Stock List (Unscheduled)
const StockList = ({ items: rawItems, setEditingItem }: { items: Item[], setEditingItem: (item: Item | null) => void }) => {
    const items = rawItems.filter(i => i != null && !!i.id);
    const { setNodeRef } = useDroppable({ id: 'stock' });

    return (
        <div className="w-80 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col shadow-xl z-20">
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                <Package size={18} />
                <span>未定・Inbox ({items.length})</span>
            </div>
            <div ref={setNodeRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50 dark:bg-slate-950/50">
                <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
                    {items.map(item => (
                        <DraggableItem key={item.id} item={item} onClick={setEditingItem} />
                    ))}
                </SortableContext>
            </div>
        </div>
    );
};


interface FutureBoardProps {
    onClose?: () => void;
}

export const FutureBoard: React.FC<FutureBoardProps> = ({ onClose }) => {
    const vm = useYoukanViewModel();
    const [draggingId, setDraggingId] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<Item | null>(null);
    console.log(editingItem); // Fix unused error

    // Date Range (2 Weeks)
    const startDate = startOfDay(new Date());
    const days = useMemo(() => Array.from({ length: 14 }).map((_, i) => addDays(startDate, i)), [startDate]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    );

    // Separate Items
    // For Board, we mainly care about "Preparation" items that have 'prep_date'.
    // If 'prep_date' is null, they go to Stock.
    // If 'prep_date' is set, they go to Calendar.
    // Also include 'active' items in Stock? Yes.

    // items with prep_date
    // const scheduledItems = vm.gdbPreparation.filter(i => i.prep_date); 
    // Wait, prep_date is number (timestamp in seconds).

    // stock items: active + preparation (no date) + intent?
    const stockItems = [
        ...vm.gdbActive,
        ...vm.gdbPreparation.filter(i => !i.prep_date),
        // ...vm.gdbIntent // Intent is too far? Maybe keep in backlog.
    ];

    const handleDragStart = (event: any) => {
        setDraggingId(event.active.id);
    };

    const handleDragEnd = (event: any) => {
        const { active, over } = event;
        setDraggingId(null);
        if (!over) return;

        const itemId = active.id;
        const overId = over.id; // 'stock' or 'day-TIMESTAMP'

        if (overId === 'stock') {
            vm.updatePreparationDate(itemId, null);
        } else if (typeof overId === 'string' && overId.startsWith('day-')) {
            const ts = parseInt(overId.replace('day-', ''), 10);
            if (!isNaN(ts)) {
                vm.updatePreparationDate(itemId, ts);
            }
        }
    };

    const activeItem = useMemo(() =>
        stockItems.find(i => i.id === draggingId) ||
        vm.gdbPreparation.find(i => i.id === draggingId),
        [draggingId, stockItems, vm.gdbPreparation]);

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex h-full w-full overflow-hidden bg-slate-100 dark:bg-slate-950">
                {/* Main Calendar Area (Horizontal Scroll) */}
                <div className="flex-1 overflow-x-auto flex divide-x divide-slate-200 dark:divide-slate-800 animate-in fade-in duration-500 relative">
                    {/* Close Button Overlay */}
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="absolute top-2 left-2 z-50 p-2 bg-white/80 dark:bg-slate-900/80 backdrop-blur rounded-full shadow-sm hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                        >
                            <span className="text-xl font-bold">×</span>
                        </button>
                    )}
                    {days.map(day => (
                        <DayColumn key={day.toISOString()} day={day} vm={vm} setEditingItem={setEditingItem} />
                    ))}
                </div>

                {/* Right Side Stock */}
                <StockList items={stockItems} setEditingItem={setEditingItem} />
            </div>

            <DragOverlay>
                {activeItem ? (
                    <ItemCard item={activeItem} type="plan" isDragging style={{ cursor: 'grabbing' }} />
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

// --- Logic Helpers ---

// Calculate Item Status for a specific day (Head, Ghost, or None)
// This logic needs to be sophisticated to handle holidays.
function getItemStatusForDay(item: Item, day: Date, config: CapacityConfig): DayStatus | null {
    if (!item.prep_date) return null;

    // Start Date (Preparation Date)
    const startDate = new Date(item.prep_date * 1000);

    // If this day is BEFORE start date, null.
    if (day < startOfDay(startDate)) return null;

    // Check if it is the Start Day
    // [FIX] Even if the start day is a holiday, we display the Head there (it's the target).
    if (isSameDay(day, startDate)) {
        // Warning if holiday? Maybe UI can show constraint violation later.
        return { type: 'head', daysLeft: 0, item };
    }

    // Ghosts Calculation (Working Days)
    // If item needs 3 days. Day 1 (Start) is Head. Day 2, 3 are Ghosts.
    // Only count working days.
    const workDays = item.work_days || 1;
    if (workDays <= 1) return null; // No ghosts needed

    // Walk from start date to find ghost days
    // let current = startOfDay(startDate); // Unused
    let workingDaysCounted = 1; // Start day counts as 1 (even if holiday, we force start)
    // Actually, if we start on holiday, does it count as valid work day? 
    // Let's assume yes for "Head", but for "Ghosts" we skip holidays. (User Spec)

    // Optimization: We only need to check if 'day' is one of the ghost days.
    // Iterating 14 days is cheap.

    // Loop until we reach 'day' or 'workDays' count.
    // We are looking for: Is 'day' the 2nd, 3rd... working day?

    // However, since we are inside `map(days)`, we are called for EACH day.
    // Better to pre-calc range?
    // For now, simple loop is fine.

    // Start walker from startDate + 1 day
    let walker = addDays(startDate, 1);

    while (workingDaysCounted < workDays) {
        // Is walker a holiday?
        const walkerIsHoliday = isHoliday(walker, config);

        if (!walkerIsHoliday) {
            workingDaysCounted++;
            if (isSameDay(walker, day)) {
                return { type: 'ghost', daysLeft: workDays - workingDaysCounted, item };
            }
        } else {
            // It's holiday, skip (ghost stretches)
            // But do we show ghost on holiday? 
            // "Holiday -> Ghost jumps over". So NO ghost on holiday.
        }

        // Safety break
        if (walker > addDays(startDate, 30)) break;

        walker = addDays(walker, 1);
    }

    return null;
}
