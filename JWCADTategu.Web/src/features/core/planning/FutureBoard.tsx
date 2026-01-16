import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useJBWOSViewModel } from '../jbwos/viewmodels/useJBWOSViewModel';
import { getDailyCapacity, isHoliday } from '../jbwos/logic/capacity';
import { format, addDays, isSameDay } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ArrowLeft, Coffee, Grid, GripVertical, ArrowRight, Folder } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, DragStartEvent, useDroppable, closestCorners } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item } from '../jbwos/types';
import { cn } from '../../../lib/utils';
import { DecisionDetailModal } from '../jbwos/components/Modal/DecisionDetailModal';

interface FutureBoardProps {
    onClose: () => void;
}

const SortableItem = ({ item, type, isGhost, daysLeft, containerId, onClick }: { item: Item; type: 'stock' | 'plan'; isGhost?: boolean; daysLeft?: number; containerId?: string; onClick?: (item: Item) => void }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: isGhost ? `${item.id}-ghost-${daysLeft}` : item.id,
        data: { type, item, isGhost, containerId }, // Pass containerId to data
        disabled: isGhost // Ghosts are not draggable
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : isGhost ? 0.6 : 1,
    };

    const isDraft = !item.due_date || (!item.work_days && !item.estimatedMinutes);

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            onClick={() => !isDragging && !isGhost && onClick && onClick(item)}
            className={cn(
                "p-2 bg-white dark:bg-slate-800 rounded-md shadow-sm border border-slate-200 dark:border-slate-700 hover:border-amber-400 transition-colors group flex flex-col gap-1 relative overflow-hidden",
                type === 'plan' && !isGhost ? 'border-l-4 border-l-amber-400' : '',
                isGhost ? 'bg-slate-50 dark:bg-slate-800/50 border-dashed' : 'cursor-move',
                type === 'stock' && isDraft ? 'border-dashed border-slate-300' : ''
            )}
        >
            <div className="flex items-center gap-2">
                {!isGhost && <GripVertical size={14} className="text-slate-300 flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-slate-700 dark:text-slate-200 truncate leading-tight flex items-center gap-1">
                        {item.isProject && <Folder size={12} className="text-blue-500 fill-blue-100 dark:fill-blue-900/30" />}
                        {item.title}
                        {isGhost && <span className="text-[10px] text-slate-400 ml-1">(続く)</span>}
                    </div>
                </div>
                {type === 'stock' && isDraft && <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="詳細未定" />}
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 pl-5">
                <span className={cn(item.due_date ? "text-slate-500" : "text-slate-300")}>
                    {item.due_date ? `〆${format(new Date(item.due_date), 'M/d', { locale: ja })}` : '未定'}
                </span>
                <span className="flex items-center gap-1">
                    {item.estimatedMinutes ? `${item.estimatedMinutes}m` : item.work_days ? `${item.work_days}d` : '-'}
                    {item.work_days && item.work_days > 1 && (
                        <span className="flex items-center gap-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 px-1 rounded-sm">
                            {isGhost ? `残り${daysLeft}日` : `${item.work_days}日`}
                            <ArrowRight size={8} />
                        </span>
                    )}
                </span>
            </div>
        </div>
    );
};

export const FutureBoard: React.FC<FutureBoardProps> = ({ onClose }) => {
    const vm = useJBWOSViewModel();
    const [startDate] = useState<Date>(addDays(new Date(), 1)); // Start from Tomorrow
    const [activeId, setActiveId] = useState<string | null>(null);
    const [editingItem, setEditingItem] = useState<Item | null>(null); // [NEW] Grooming Modal State

    // Dnd Sensors
    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    // Days Generation (7 Days)
    const days = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));

    // Stock List Logic
    const { setNodeRef: setStockListRef } = useDroppable({ id: 'stock-list', data: { type: 'stock-container' } });

    // Filter Stock Items (Inbox + Unscheduled Preparation)
    // Exclude: Pending(Waiting/Hold), Intent, Today Active
    const rawStockItems = [
        ...vm.gdbActive.filter(i => i.status === 'inbox'), // Pure Inbox
        ...vm.gdbPreparation.filter(i => !i.prep_date && i.status !== 'decision_hold') // Unscheduled Prep (excluding hold)
    ].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    // Split into 2 Stages
    const unorganizedItems = rawStockItems.filter(i => !i.due_date && (!i.estimatedMinutes && !i.work_days));
    const standbyItems = rawStockItems.filter(i => i.due_date || (i.estimatedMinutes || i.work_days)); // Has some detail

    // Helper: Logic to determine if item occupies a day (Working Days only)
    const getItemStatusForDay = (item: Item, day: Date): { type: 'head' | 'ghost', daysLeft: number } | null => {
        if (!item.prep_date) return null;

        const dayStart = new Date(day); dayStart.setHours(0, 0, 0, 0);
        const itemDate = new Date(item.prep_date * 1000);
        itemDate.setHours(0, 0, 0, 0);

        // If current day is before start date, irrelevant
        if (dayStart < itemDate) return null;

        const isStartDay = isSameDay(itemDate, dayStart);
        const duration = item.work_days || 1;

        if (isStartDay) {
            // Head always shows, regardless of holiday status of itemDate
            return { type: 'head', daysLeft: duration - 1 };
        }

        // For ghost days, if the current day is a holiday, it's a gap.
        if (isHoliday(dayStart, vm.capacityConfig)) {
            return null;
        }

        // Calculate how many *working days* have passed from itemDate (inclusive) to dayStart (exclusive).
        let workingDaysPassed = 0;
        let iter = new Date(itemDate);

        while (iter < dayStart) {
            if (!isHoliday(iter, vm.capacityConfig)) {
                workingDaysPassed++;
            }
            iter = addDays(iter, 1);
        }

        // If the number of working days passed (including the itemDate if it was a working day)
        // is less than the total duration, then this day is a ghost.
        // The `workingDaysPassed` variable now represents the index of the current day
        // relative to the start of the task, considering only working days.
        // E.g., if itemDate is Mon (working), dayStart is Tue (working), workingDaysPassed = 1.
        // If itemDate is Mon (working), dayStart is Wed (working), workingDaysPassed = 2.
        // If itemDate is Mon (working), dayStart is Tue (holiday), Wed (working), workingDaysPassed = 1.

        // So, if workingDaysPassed is 0, it means dayStart is the first working day after itemDate.
        // If workingDaysPassed is 1, it means dayStart is the second working day after itemDate.
        // ...
        // If workingDaysPassed < duration - 1, then it's a ghost.
        // The `daysLeft` should be `duration - 1 - workingDaysPassed`.
        if (workingDaysPassed < duration) {
            return { type: 'ghost', daysLeft: duration - 1 - workingDaysPassed };
        }

        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeItemObj = active.data.current?.item as Item;
        if (!activeItemObj) return;

        // Drop on Stock
        if (over.id === 'stock-list' || over.data.current?.type === 'stock-container') {
            vm.updatePreparationDate(activeItemObj.id, null);
            return;
        }

        // Identify Target Container ID
        let targetId = over.id as string;

        // If dropped on an item, look up its containerId
        if (over.data.current?.containerId) {
            targetId = over.data.current.containerId;
        }

        // Drop on Day Column (id is timestamp string or date string)
        // We used `day-${ts}` as ID
        if (typeof targetId === 'string' && targetId.startsWith('day-')) {
            const ts = parseInt(targetId.replace('day-', ''), 10);
            if (!isNaN(ts)) {
                // Determine the correct timestamp (User dropped on specific day)
                // We preserve the time? No, set to start of that day (or noon) to be safe.
                // Actually `prep_date` is date-only effectively in logic usually.
                vm.updatePreparationDate(activeItemObj.id, ts);
            }
        }
    };

    const activeItem = activeId ? [...rawStockItems, ...vm.gdbPreparation, ...vm.gdbActive].find(i => i.id === activeId) : null;

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-50 flex flex-col overflow-hidden"
        >
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-sm z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                            <ArrowLeft className="text-slate-500" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Grid className="text-indigo-500" size={20} />
                                フューチャーボード (週間)
                            </h1>
                            <p className="text-xs text-slate-500">週間の流れをデザインする</p>
                        </div>
                    </div>
                    {/* Navigation or Info */}
                    <div className="flex gap-2">
                        {/* Maybe Add Week Navigation later */}
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left: Stock (2-Stage: Unorganized & Standby) */}
                    <div className="w-64 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0">
                        {/* Header for Total Count? Or section headers only? */}

                        <div ref={setStockListRef} id="stock-list" className="flex-1 overflow-y-auto p-2 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">

                            {/* Section 1: Unorganized (Draft) */}
                            <div className="mb-6">
                                <div className="px-2 pb-2 flex items-center justify-between border-b border-red-100 dark:border-red-900/30 mb-2">
                                    <span className="text-xs font-bold text-red-500 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 blinking-dot"></div>
                                        未整理 (Inbox)
                                    </span>
                                    <span className="text-[10px] bg-red-100 dark:bg-red-900/30 text-red-600 px-1.5 py-0.5 rounded-md">{unorganizedItems.length}</span>
                                </div>
                                <SortableContext items={unorganizedItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-2 min-h-[50px]">
                                        {unorganizedItems.map(item => (
                                            <SortableItem key={item.id} item={item} type="stock" onClick={setEditingItem} />
                                        ))}
                                        {unorganizedItems.length === 0 && (
                                            <div className="text-[10px] text-center text-slate-400 py-4 border border-dashed border-slate-200 dark:border-slate-800 rounded">
                                                未整理なし
                                            </div>
                                        )}
                                    </div>
                                </SortableContext>
                            </div>

                            {/* Section 2: Standby (Ready) */}
                            <div>
                                <div className="px-2 pb-2 flex items-center justify-between border-b border-indigo-100 dark:border-indigo-900/30 mb-2">
                                    <span className="text-xs font-bold text-indigo-500 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                        スタンバイ (Stock)
                                    </span>
                                    <span className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 px-1.5 py-0.5 rounded-md">{standbyItems.length}</span>
                                </div>
                                <SortableContext items={standbyItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                    <div className="space-y-2 min-h-[50px]">
                                        {standbyItems.map(item => (
                                            <SortableItem key={item.id} item={item} type="stock" onClick={setEditingItem} />
                                        ))}
                                        {standbyItems.length === 0 && (
                                            <div className="text-[10px] text-center text-slate-400 py-8 opacity-50">
                                                スタンバイなし<br />カレンダーへ配置可能
                                            </div>
                                        )}
                                    </div>
                                </SortableContext>
                            </div>

                            {rawStockItems.length === 0 && <div className="text-xs text-center text-slate-400 mt-10">Inboxは空です<br />すべて片付きました🎉</div>}
                        </div>
                    </div>

                    {/* Right: Week Columns */}
                    <div className="flex-1 overflow-x-auto overflow-y-hidden bg-slate-200 dark:bg-slate-900">
                        <div className="flex h-full p-4 gap-4 min-w-max">
                            {days.map((day, _index) => {
                                const dayTs = Math.floor(day.getTime() / 1000);
                                const isHolidayDay = isHoliday(day, vm.capacityConfig);
                                const capacity = getDailyCapacity(day, vm.capacityConfig);
                                const dayLabel = format(day, 'M/d (E)', { locale: ja });

                                // Find Items for this day
                                const dayItems: { item: Item, status: 'head' | 'ghost', daysLeft: number }[] = [];

                                vm.gdbPreparation.forEach(item => {
                                    const status = getItemStatusForDay(item, day);
                                    if (status) {
                                        dayItems.push({ item, status: status.type, daysLeft: status.daysLeft });
                                    }
                                });

                                // Calculate Capacity
                                // We count ALL items (head + ghost) for load
                                const plannedMins = dayItems.reduce((acc, { item }) => acc + (item.estimatedMinutes || 0), 0);
                                const loadPercent = Math.min(100, (plannedMins / (capacity || 1)) * 100);

                                // Droppable for this day
                                const { setNodeRef: setDayRef, isOver } = useDroppable({
                                    id: `day-${dayTs}`,
                                    data: { type: 'day-container', date: day }
                                });

                                return (
                                    <div
                                        key={dayTs}
                                        ref={setDayRef}
                                        className={cn(
                                            "w-64 flex flex-col rounded-xl overflow-hidden shadow-sm border-t-4 transition-colors",
                                            isHolidayDay ? "bg-slate-100 dark:bg-slate-800/50 border-red-300" : "bg-white dark:bg-slate-800 border-transparent",
                                            isHolidayDay ? "opacity-90" : "",
                                            isOver ? "bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-400 border-indigo-400" : ""
                                        )}
                                    >
                                        {/* Day Header */}
                                        <div className="p-3 border-b border-slate-100 dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className={cn("font-bold text-sm", isHolidayDay ? "text-red-500" : "text-slate-700 dark:text-slate-200")}>
                                                    {dayLabel}
                                                </span>
                                                {isHolidayDay && <Coffee size={14} className="text-red-400" />}
                                            </div>
                                            {/* Capacity Bar */}
                                            <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full", loadPercent > 100 ? "bg-red-500" : "bg-green-400")}
                                                    style={{ width: `${loadPercent}%` }}
                                                />
                                            </div>
                                            <div className="text-[10px] text-right text-slate-400 mt-1">
                                                use: {plannedMins}m / cap: {capacity}m
                                            </div>
                                        </div>

                                        {/* Items List */}
                                        <div className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50/50 dark:bg-slate-900/30">
                                            <SortableContext items={dayItems.filter(i => i.status === 'head').map(i => i.item.id)} strategy={verticalListSortingStrategy}>
                                                {dayItems.map(({ item, status, daysLeft }) => (
                                                    <SortableItem
                                                        key={`${item.id}-${dayTs}`} // Unique key for render
                                                        item={item}
                                                        type="plan"
                                                        isGhost={status === 'ghost'}
                                                        daysLeft={daysLeft}
                                                        containerId={`day-${dayTs}`}
                                                    />
                                                ))}
                                            </SortableContext>
                                            {dayItems.length === 0 && !isHolidayDay && (
                                                <div className="text-center py-10 opacity-20 hover:opacity-100 transition-opacity">
                                                    <div className="text-xs text-slate-400 border-2 border-dashed border-slate-300 rounded-lg p-2 mx-4">
                                                        ドロップして配置
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <DragOverlay>
                    {activeItem ? (
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-amber-400 w-64 opacity-90 cursor-grabbing">
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{activeItem.title}</div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            {/* Grooming Modal */}
            <DecisionDetailModal
                item={editingItem}
                onClose={() => setEditingItem(null)}
                onDecision={(id, decision, note) => {
                    vm.resolveDecision(id, decision, note);
                    setEditingItem(null); // Close after decision
                }}
                onDelete={(id) => {
                    vm.deleteItem(id);
                    setEditingItem(null);
                }}
                onUpdate={async (id, updates) => {
                    await vm.updateItem(id, updates);
                }}
                onCreateSubTask={vm.createSubTask}
                onGetSubTasks={vm.getSubTasks}
                yesButtonLabel="今日やる"
            />
        </motion.div >
    );
};
