import React, { useState } from 'react';
import { useGlobalBoardViewModel } from '../../viewmodels/useGlobalBoardViewModel';
import { JudgmentStatus, JudgableItem } from '../../jbwos-core/types';
import { Plus, Maximize2, AlertCircle, ArrowRight, Home } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import {
    DndContext,
    useDraggable,
    useDroppable,
    DragEndEvent,
    useSensor,
    useSensors,
    PointerSensor,
    TouchSensor,
    KeyboardSensor,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DropAnimation
} from '@dnd-kit/core';
import { motion, AnimatePresence } from 'framer-motion';

interface GlobalDecisionBoardProps {
    onNavigateToProjects: () => void;
    onEditItem: (door: any) => void;
}

const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
        styles: {
            active: {
                opacity: '0.5',
            },
        },
    }),
};

export const GlobalDecisionBoard: React.FC<GlobalDecisionBoardProps> = ({
    onNavigateToProjects,
    onEditItem
}) => {
    const {
        inboxItems,
        readyItems,
        waitingItems,
        isInboxOverflowing,
        isStoppingEvent,
        canMoveToReady,
        moveDoorToStatus
    } = useGlobalBoardViewModel();
    const { t } = useTranslation();
    const [activeId, setActiveId] = useState<number | null>(null);

    // Dnd-Kit Sensors (Touch & Mouse optimization)
    // PointerSensor handles both mouse and touch, but we need activation constraints
    // to prevent accidental drags while scrolling on touch devices.
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Require 8px movement before drag starts (allows scrolling)
            },
        }),
        useSensor(KeyboardSensor)
    );

    const handleDragStart = (event: any) => {
        setActiveId(parseInt(event.active.id.toString()));
    };

    // Dnd-Kit Logic
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (over) {
            const itemId = parseInt(active.id.toString());
            const targetStatus = over.id as JudgmentStatus;

            try {
                await moveDoorToStatus(itemId, targetStatus);
            } catch (error: any) {
                // Shake animation or toast could be here
                alert(error.message);
            }
        }
    };

    if (isStoppingEvent) {
        return (
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="fixed inset-0 bg-slate-50 z-50 flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-1000"
            >
                <motion.div
                    initial={{ scale: 0.9, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    transition={{ type: "spring", stiffness: 200, damping: 20 }}
                >
                    <h1 className="text-4xl font-light text-slate-800 mb-4 tracking-wider">
                        今日はもう、やるものはありません。
                    </h1>
                    <p className="text-slate-500 text-lg">
                        判断は、すでに終わっています。
                    </p>
                    <motion.button
                        onClick={onNavigateToProjects}
                        className="mt-12 text-slate-400 hover:text-slate-600 text-sm flex items-center gap-2 transition-colors mx-auto"
                    >
                        <Maximize2 size={16} /> External View (Projects)
                    </motion.button>
                </motion.div>
            </motion.div>
        );
    }

    // Focus Mode: Dim others if Ready has items
    const isFocusMode = readyItems.length > 0;
    const dimStyle = isFocusMode ? "opacity-30 pointer-events-none transition-opacity duration-700" : "transition-opacity duration-500";

    // Find the active item data for DragOverlay
    const activeItem = activeId ?
        [...inboxItems, ...readyItems, ...waitingItems].find(i => i.id === activeId)
        : null;

    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-full flex flex-col bg-[#F8F9FA] text-slate-800 font-sans">
                {/* Heavy Header for Judgment */}
                <header className="px-4 py-4 md:px-8 md:py-6 bg-white border-b border-slate-100 flex justify-between items-center shadow-sm shrink-0">
                    <div>
                        <h1 className="text-xl md:text-2xl font-light tracking-tight text-slate-900 flex items-center gap-2">
                            <Home size={24} className="text-slate-400" />
                            Global Decision Board
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={onNavigateToProjects}
                            className="px-3 py-1.5 md:px-4 md:py-2 text-xs md:text-sm text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-all flex items-center gap-2"
                            title="Emergency Exit to Project List"
                        >
                            <Maximize2 size={16} />
                            Projects
                        </button>
                    </div>
                </header>

                <div className="flex-1 overflow-x-auto p-4 md:p-8 flex gap-4 md:gap-8 items-start justify-start md:justify-center">

                    {/* INBOX */}
                    <DroppableBucket id="inbox" className={`w-72 md:w-80 flex-shrink-0 flex flex-col gap-4 ${dimStyle}`}>
                        <div className="flex justify-between items-baseline px-2">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Inbox</h2>
                            <span className="text-xs text-slate-300">CAPTURE</span>
                        </div>

                        <div className="bg-slate-100 rounded-xl p-1 min-h-[200px] relative transition-all">
                            {/* Microcopy Header */}
                            <div className="p-3 text-center text-xs text-slate-500 border-b border-white/50 mb-2">
                                {isInboxOverflowing ?
                                    "今日は、ここから1件だけ出せば十分です。" :
                                    "ここは、あとで決める場所です。"}
                            </div>

                            {isInboxOverflowing && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="absolute inset-x-0 bottom-0 top-12 bg-slate-200/90 backdrop-blur-sm flex items-center justify-center p-6 text-center z-10 rounded-b-xl cursor-not-allowed text-slate-500"
                                >
                                    <div>
                                        <span className="block mb-2 text-2xl">🛑</span>
                                        <p className="font-medium text-slate-600">思考を停止してください。</p>
                                    </div>
                                </motion.div>
                            )}

                            <div className="flex flex-col gap-2 relative z-0">
                                <AnimatePresence>
                                    {inboxItems.map(item => (
                                        <DraggableTaskCard key={item.id} item={item} onClick={() => onEditItem(item)} />
                                    ))}
                                </AnimatePresence>
                                {inboxItems.length === 0 && (
                                    <div className="py-8 text-center text-slate-300 text-sm">Empty</div>
                                )}
                            </div>
                        </div>
                    </DroppableBucket>

                    {/* READY (Center Stage) */}
                    <DroppableBucket id="ready" className="w-80 md:w-96 flex-shrink-0 flex flex-col gap-6">
                        <div className="flex justify-between items-baseline px-2">
                            <h2 className="text-sm font-bold text-indigo-600 uppercase tracking-widest">Ready</h2>
                            <span className="text-xs text-indigo-300">DO TODAY (Max 2)</span>
                        </div>

                        <motion.div
                            layout
                            className={`bg-white rounded-2xl p-4 min-h-[300px] shadow-xl border-t-4 border-indigo-500 transition-all ${readyItems.length >= 2 ? 'ring-4 ring-indigo-50' : ''}`}
                        >
                            <div className="mb-6 p-4 bg-indigo-50/50 rounded-lg text-center">
                                <p className="text-indigo-800 font-medium">
                                    {readyItems.length === 0 && "今日は、やることはありません。"}
                                    {readyItems.length === 1 && "今日は、これで十分です。"}
                                    {readyItems.length === 2 && "これ以上、決める必要はありません。"}
                                </p>
                            </div>

                            <div className="flex flex-col gap-4">
                                <AnimatePresence>
                                    {readyItems.map(item => (
                                        <DraggableTaskCard key={item.id} item={item} variant="highlight" onClick={() => onEditItem(item)} />
                                    ))}
                                </AnimatePresence>

                                {readyItems.length < 2 && (
                                    <div className="border-2 border-dashed border-slate-100 rounded-xl p-8 flex flex-col items-center justify-center text-slate-300 transition-colors hover:border-indigo-100 hover:bg-indigo-50/10">
                                        <span className="text-2xl mb-2">+</span>
                                        <span className="text-xs">Drop here</span>
                                    </div>
                                )}
                            </div>
                        </motion.div>

                        <div className="text-center">
                            {readyItems.length > 0 && (
                                <motion.button
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className="px-6 py-3 bg-slate-900 text-white rounded-full text-sm font-medium shadow-lg"
                                    onClick={() => {
                                        readyItems.forEach(i => moveDoorToStatus(i.id!, 'done'));
                                    }}
                                >
                                    Finish All
                                </motion.button>
                            )}
                        </div>
                    </DroppableBucket>

                    {/* WAITING */}
                    <DroppableBucket id="waiting" className={`w-72 md:w-72 flex-shrink-0 flex flex-col gap-4 ${dimStyle}`}>
                        <div className="flex justify-between items-baseline px-2">
                            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Waiting</h2>
                            <span className="text-xs text-slate-300">BLOCKED</span>
                        </div>

                        <div className="bg-slate-50/50 rounded-xl p-1 min-h-[200px] border border-slate-100">
                            <div className="p-3 text-center text-xs text-slate-400 border-b border-slate-100 mb-2">
                                これは、あなたのせいではありません。
                            </div>
                            <div className="flex flex-col gap-2">
                                <AnimatePresence>
                                    {waitingItems.map(item => (
                                        <DraggableTaskCard key={item.id} item={item} onClick={() => onEditItem(item)} />
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    </DroppableBucket>

                    {/* PENDING (Collapsed) */}
                    <DroppableBucket id="pending" className={`w-12 md:w-16 flex-shrink-0 flex flex-col gap-4 items-center ${dimStyle}`}>
                        <div className="writing-vertical text-xs font-bold text-slate-300 uppercase tracking-widest py-4">
                            Pending
                        </div>
                        <div className="w-10 md:w-12 h-64 bg-slate-100 rounded-full flex items-center justify-center border border-slate-200">
                            <span className="text-slate-400 text-xs font-mono">Dump</span>
                        </div>
                    </DroppableBucket>

                </div>
            </div>

            {/* Drag Overlay for smooth visual */}
            <DragOverlay dropAnimation={dropAnimationConfig}>
                {activeItem ? (
                    <div className="p-4 rounded-xl bg-white border border-indigo-200 shadow-2xl skew-y-2 opacity-90 w-72">
                        <h3 className="font-medium text-slate-800">{activeItem.title}</h3>
                        <div className="mt-2 text-xs text-slate-400">{activeItem.description}</div>
                    </div>
                ) : null}
            </DragOverlay>

        </DndContext>
    );
};

// --- DND Components ---

const DroppableBucket = ({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) => {
    const { setNodeRef, isOver } = useDroppable({ id });
    const style = {
        opacity: isOver ? 0.8 : 1,
    };
    return (
        <div ref={setNodeRef} style={style} className={className}>
            {children}
        </div>
    );
};

// Draggable Task Card with Animations
const DraggableTaskCard = ({ item, variant = 'default', onClick }: { item: JudgableItem, variant?: 'default' | 'highlight', onClick: () => void }) => {
    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: item.id.toString(),
    });

    // View Mapping
    const projectName = item.tags ? item.tags[0] : '';
    const name = item.title;
    const meta = item.description || '';

    // If dragging, we hide the original one to avoid duplication (DrawOverlay shows the moving one)
    if (isDragging) {
        return (
            <div ref={setNodeRef} className="opacity-0 p-4 h-24" />
        )
    }

    return (
        <motion.div
            ref={setNodeRef}
            layoutId={item.id.toString()}
            layout // Smooth reordering
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            {...listeners}
            {...attributes}
            onClick={onClick}
            className={`
            group relative p-4 rounded-xl cursor-grab active:cursor-grabbing transition-shadow hover:-translate-y-1 select-none touch-none
            ${variant === 'highlight' ? 'bg-white border border-indigo-100 shadow-lg' : 'bg-white border border-slate-200 shadow-sm hover:shadow-md'}
          `}
        >
            <div className="absolute top-3 right-3 flex gap-1">
                {projectName && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 rounded-sm">
                        {projectName}
                    </span>
                )}
            </div>

            <h3 className={`font-medium pr-16 ${variant === 'highlight' ? 'text-lg text-slate-800' : 'text-sm text-slate-700'}`}>
                {name}
            </h3>

            <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                <span>{meta}</span>
            </div>
        </motion.div>
    );
};
