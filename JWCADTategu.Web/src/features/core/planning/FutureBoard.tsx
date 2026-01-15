import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useJBWOSViewModel } from '../jbwos/viewmodels/useJBWOSViewModel';
import { getDailyCapacity, isHoliday } from '../jbwos/logic/capacity';
import { format, addDays } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ArrowLeft, Sun, Coffee, Briefcase, Calendar as CalendarIcon, GripVertical } from 'lucide-react';
import { DndContext, DragEndEvent, DragOverlay, MouseSensor, TouchSensor, useSensor, useSensors, DragStartEvent, useDroppable, closestCorners } from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item } from '../jbwos/types';

interface FutureBoardProps {
    onClose: () => void;
}

const SortableItem = ({ item, type }: { item: Item; type: 'stock' | 'plan' }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: item.id,
        data: { type, item }
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`p-3 bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700 hover:border-amber-400 cursor-move transition-colors group flex items-center justify-between ${type === 'plan' ? 'border-l-4 border-l-amber-400' : ''}`}
        >
            <div className="flex items-center gap-2 overflow-hidden">
                <GripVertical size={16} className="text-slate-300 flex-shrink-0" />
                <div className="truncate">
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200 truncate">{item.title}</div>
                    {type === 'stock' && (
                        <div className="text-xs text-slate-400 mt-1 flex justify-between">
                            <span>{item.category || 'Inbox'}</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="text-xs text-slate-400 flex-shrink-0">
                {item.estimatedMinutes ? `${item.estimatedMinutes}m` : '-'}
            </div>
        </div>
    );
};

export const FutureBoard: React.FC<FutureBoardProps> = ({ onClose }) => {
    const vm = useJBWOSViewModel();
    const [targetDate, setTargetDate] = useState<Date>(addDays(new Date(), 1)); // Default: Tomorrow
    const [activeId, setActiveId] = useState<string | null>(null);

    // Droppable Zones
    const { setNodeRef: setStockListRef } = useDroppable({ id: 'stock-list', data: { type: 'stock-container' } });
    const { setNodeRef: setPlanListRef } = useDroppable({ id: 'plan-list', data: { type: 'plan-container' } });

    const capacityMinutes = getDailyCapacity(targetDate, vm.capacityConfig);
    const isHolidayDay = isHoliday(targetDate, vm.capacityConfig);
    const dateLabel = format(targetDate, 'M月d日 (E)', { locale: ja });

    // Derive Lists
    // Normalize targetDate to start/end of day timestamps (seconds)
    const targetStart = new Date(targetDate);
    targetStart.setHours(0, 0, 0, 0);
    const targetEnd = new Date(targetDate);
    targetEnd.setHours(23, 59, 59, 999);

    // Convert to seconds for comparison
    const tsStart = Math.floor(targetStart.getTime() / 1000);
    const tsEnd = Math.floor(targetEnd.getTime() / 1000);

    const planItems = vm.gdbPreparation.filter(i =>
        i.prep_date && i.prep_date >= tsStart && i.prep_date <= tsEnd
    );

    // Stock = Active + Others in Preparation (not this day)
    const stockItems = [
        ...vm.gdbActive,
        ...vm.gdbPreparation.filter(i => !i.prep_date || i.prep_date < tsStart || i.prep_date > tsEnd)
    ].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    const sensors = useSensors(
        useSensor(MouseSensor, { activationConstraint: { distance: 10 } }),
        useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
    );

    // Calc Stats
    const fixedMinutes = 0;
    const plannedMinutes = planItems.reduce((acc, t) => acc + (t.estimatedMinutes || 0), 0) + fixedMinutes;
    const remainingMinutes = Math.max(0, capacityMinutes - plannedMinutes);
    const loadPercent = Math.min(100, (plannedMinutes / (capacityMinutes || 1)) * 100);

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) {
            console.log('DragEnd: No over target');
            return;
        }

        const activeData = active.data.current as { type: 'stock' | 'plan', item: Item } | undefined;
        const overData = over.data.current as { type?: string, item?: Item } | undefined;

        // Enhanced detection for drop zones
        const isOverPlan = over.id === 'plan-list' || overData?.type === 'plan' || overData?.type === 'plan-container';
        const isOverStock = over.id === 'stock-list' || overData?.type === 'stock' || overData?.type === 'stock-container';

        console.log('DragEnd:', {
            activeId: active.id,
            overId: over.id,
            isOverPlan,
            isOverStock,
            activeType: activeData?.type
        });

        if (isOverPlan && activeData?.type !== 'plan') {
            // Assign Date (Move to Plan)
            const timestamp = Math.floor(targetDate.getTime() / 1000);
            vm.updatePreparationDate(active.id as string, timestamp);
        } else if (isOverStock && activeData?.type === 'plan') {
            // Unassign Date (Move to Stock)
            vm.updatePreparationDate(active.id as string, null);
        }
    };

    const activeItem = activeId ? [...stockItems, ...planItems].find(i => i.id === activeId) : null;

    return (
        <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed inset-0 bg-slate-100 dark:bg-slate-900 z-50 flex flex-col"
        >
            <DndContext sensors={sensors} collisionDetection={closestCorners} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                {/* Header */}
                <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full">
                            <ArrowLeft className="text-slate-500" />
                        </button>
                        <div>
                            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                                <Sun className="text-amber-500" size={20} />
                                Tomorrow Planning
                            </h1>
                            <p className="text-xs text-slate-500">明日への架け橋をかけましょう</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm font-bold text-slate-700 dark:text-slate-300">{dateLabel}</div>
                            <div className="text-xs text-slate-500">
                                {isHolidayDay ? <span className="text-red-500 font-bold flex items-center gap-1 justify-end"><Coffee size={10} /> 休業日</span> : '稼働日'}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Main Content (2 Pane) */}
                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">

                    {/* Left: Stock (Inbox & Leftovers) */}
                    <div className="w-full md:w-1/3 bg-slate-50 dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex flex-col">
                        <div className="p-3 bg-slate-100 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 font-bold text-slate-600 text-sm flex justify-between">
                            <span>Stock (未配置)</span>
                            <span className="text-xs font-normal bg-slate-200 px-2 py-0.5 rounded-full">{stockItems.length} items</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                            <SortableContext items={stockItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                <div ref={setStockListRef} id="stock-list" className="min-h-[200px] space-y-2">
                                    {stockItems.map(item => (
                                        <SortableItem key={item.id} item={item} type="stock" />
                                    ))}
                                    {stockItems.length === 0 && (
                                        <div className="text-center text-slate-400 py-8 text-xs">候補タスクはありません</div>
                                    )}
                                </div>
                            </SortableContext>
                        </div>
                    </div>

                    {/* Right: Tomorrow Timeline / List */}
                    <div className="flex-1 bg-white dark:bg-slate-900 flex flex-col relative">
                        {/* Capacity Bar */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-slate-100">
                            <motion.div
                                className={`h-full ${isHolidayDay ? 'bg-red-300' : loadPercent > 100 ? 'bg-red-500' : 'bg-green-500'}`}
                                initial={{ width: 0 }}
                                animate={{ width: `${loadPercent}%` }}
                            />
                        </div>

                        <div className="p-4 flex-1 overflow-y-auto">
                            {/* Fixed Events (Big Rocks) */}
                            <div className="mb-6">
                                <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                    <Briefcase size={12} /> Fixed Schedule ({isHolidayDay ? '休日' : '背骨'})
                                </h3>
                                {/* Mock Removed - Clean Slate for User */}
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded border border-slate-200 text-center text-xs text-slate-400">
                                    固定スケジュールはありません
                                </div>
                            </div>

                            {/* Planned Tasks (Floating) */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-wider flex items-center gap-2">
                                    <CalendarIcon size={12} /> Planned Tasks (予定)
                                </h3>
                                {isHolidayDay ? (
                                    <div className="p-8 text-center text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-xl border border-dashed border-slate-300">
                                        <Coffee className="mx-auto mb-2 text-slate-300" size={32} />
                                        <p>休業日設定になっています</p>
                                    </div>
                                ) : (
                                    <SortableContext items={planItems.map(i => i.id)} strategy={verticalListSortingStrategy}>
                                        <div ref={setPlanListRef} id="plan-list" className="space-y-2 min-h-[200px] border-2 border-dashed border-slate-100 rounded-xl p-2 transition-colors hover:border-amber-100">
                                            {planItems.map(item => (
                                                <SortableItem key={item.id} item={item} type="plan" />
                                            ))}
                                            {planItems.length === 0 && (
                                                <div className="p-4 text-center text-xs text-slate-400">ここへタスクをドロップ</div>
                                            )}
                                        </div>
                                    </SortableContext>
                                )}
                            </div>
                        </div>

                        {/* Stats Footer */}
                        <div className="bg-slate-50 dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3 flex justify-between items-center text-xs">
                            <div className="flex gap-4">
                                <span>目安合計: <strong>{Math.round(plannedMinutes / 60 * 10) / 10}h</strong></span>
                                <span>稼働枠: <strong>{Math.round(capacityMinutes / 60 * 10) / 10}h</strong></span>
                            </div>
                            <div className={`${remainingMinutes < 0 ? 'text-red-500 font-bold' : 'text-slate-500'}`}>
                                残り: {remainingMinutes < 0 ? `オーバー ${Math.abs(remainingMinutes)}m` : `${remainingMinutes}m`}
                            </div>
                        </div>
                    </div>
                </div>

                <DragOverlay>
                    {activeItem ? (
                        <div className="p-3 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-amber-400 opacity-90 cursor-grabbing w-full max-w-xs">
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">{activeItem.title}</div>
                        </div>
                    ) : null}
                </DragOverlay>

            </DndContext>
        </motion.div>
    );
};
