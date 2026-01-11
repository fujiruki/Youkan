import React, { useState } from 'react';
import {
    DndContext,
    closestCorners,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
    DragOverlay,
    defaultDropAnimationSideEffects,
    DragStartEvent,
    DragOverEvent,
    DragEndEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { BucketColumn } from './BucketColumn';
import { ItemCard } from './ItemCard';
import { GentleMessage } from './GentleMessage';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';
import { Item } from '../../types';
import { cn } from '../../../../lib/utils';
import { Inbox, PlayCircle, Clock, Archive } from 'lucide-react'; // Example icons
import { t } from '../../../../i18n/labels';


interface GlobalBoardProps {
    onClose?: () => void;
}

export const JbwosBoard: React.FC<GlobalBoardProps> = ({ onClose }) => {
    const vm = useJBWOSViewModel();
    const [activeId, setActiveId] = useState<string | null>(null);

    // --- Dnd Kit Logic ---
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 8, // Prevent accidental drags
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);

        if (!over) return;

        const activeItemId = active.id as string;
        const overContainerId = over.id as string; // 'ready', 'waiting', etc.

        // Find current status of item
        let currentStatus = '';
        if (vm.inboxItems.find(i => i.id === activeItemId)) currentStatus = 'inbox';
        else if (vm.readyItems.find(i => i.id === activeItemId)) currentStatus = 'ready';
        else if (vm.waitingItems.find(i => i.id === activeItemId)) currentStatus = 'waiting';
        else if (vm.pendingItems.find(i => i.id === activeItemId)) currentStatus = 'pending';
        else if (vm.doneItems.find(i => i.id === activeItemId)) currentStatus = 'done';

        if (currentStatus === overContainerId) return; // No change

        try {
            switch (overContainerId) {
                case 'inbox':
                    await vm.moveToInbox(activeItemId);
                    break;
                case 'ready':
                    await vm.moveToReady(activeItemId);
                    break;
                case 'waiting':
                    await vm.moveToWaiting(activeItemId, "Moved via Drag"); // Reason UI needed later
                    break;
                case 'pending':
                    await vm.moveToPending(activeItemId);
                    break;
                case 'done':
                    await vm.markAsDone(activeItemId);
                    break;
            }
        } catch (e: any) {
            // Translate explicit "Max 2" error or fallback to generic
            if (e.message.includes('Ready bucket is full') || e.message.includes('Max 2')) {
                alert(t.jbwos.common.alerts.readyLimit);
            } else {
                console.warn('[GlobalBoard] Move failed:', e); // Only warn for unexpected errors
                alert(t.jbwos.common.alerts.moveFailed + `: ${e.message}`);
            }
        }
    };

    // --- Active Item for Overlay ---
    const findItem = (id: string) => {
        const all = [...vm.inboxItems, ...vm.readyItems, ...vm.waitingItems, ...vm.pendingItems, ...vm.doneItems];
        return all.find(i => i.id === id);
    };
    const activeItem = activeId ? findItem(activeId) : null;

    // --- Actions ---
    // --- Actions ---
    // Inline rename handler replacing the prompt-based one
    const handleRenameItem = async (id: string, newTitle: string) => {
        if (!newTitle.trim()) return;
        await vm.updateItemTitle(id, newTitle);
    };

    // Keep for fallback or other edit types if needed, but mainly we use inline now
    const handleEditItem = async (item: Item) => {
        // Legacy prompt - keeping just in case until inline is fully verified
        const newTitle = window.prompt(t.jbwos.common.editPrompt, item.title);
        if (newTitle && newTitle !== item.title) {
            await vm.updateItemTitle(item.id, newTitle);
        }
    };

    // --- Quick Input (Inbox) ---
    const [inputValue, setInputValue] = useState('');
    const handleThrowIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;
        try {
            await vm.throwIn(inputValue);
            setInputValue('');
        } catch (err) {
            console.error('[GlobalBoard] throwIn failed', err);
        }
    };

    // --- Zoom Logic ---
    const [zoomLevel, setZoomLevel] = useState(14); // Default 14px

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="h-full w-full bg-slate-100 dark:bg-slate-950 p-6 relative flex flex-col">
                {/* Header / Navigation Controls - Fixed text size to avoid resizing the UI itself */}
                <div className="absolute top-4 right-4 z-10 flex items-center gap-4 text-sm">
                    {/* Zoom Slider */}
                    <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm">
                        <span className="text-[10px] text-slate-500">A</span>
                        <input
                            type="range"
                            min="10"
                            max="24"
                            value={zoomLevel}
                            onChange={(e) => setZoomLevel(Number(e.target.value))}
                            className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700"
                        />
                        <span className="text-sm text-slate-500 font-bold">A</span>
                    </div>

                    <button
                        onClick={onClose}
                        className="p-2 rounded-full bg-white/50 hover:bg-white dark:bg-slate-800/50 dark:hover:bg-slate-700 text-slate-500 hover:text-slate-700 transition-colors shadow-sm"
                        title="元の画面に戻る"
                    >
                        ✖ {t.jbwos.common.close}
                    </button>
                </div>

                {/* Main Content - Zoom Applied Here using base font size */}
                <div
                    className="flex-1 flex gap-4 items-stretch pb-4 overflow-hidden"
                    style={{ fontSize: `${zoomLevel}px` }}
                >

                    {/* 1. Inbox */}
                    <BucketColumn
                        id="inbox"
                        title={t.jbwos.inbox.title}
                        items={vm.inboxItems}
                        description={t.jbwos.inbox.description}
                        className="flex-1 min-w-0" // Flexible
                        emptyMessage={<GentleMessage variant="inbox_clean" />}
                        onRenameItem={handleRenameItem} // Pass new handler
                        footer={
                            <form onSubmit={handleThrowIn} className="mt-2 relative">
                                <input
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={t.jbwos.inbox.placeholder}
                                    className="w-full px-4 py-3 rounded-full border-none shadow-sm focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-[1em]"
                                />
                            </form>
                        }
                    />

                    {/* 2. Waiting */}
                    <BucketColumn
                        id="waiting"
                        title={t.jbwos.waiting.title}
                        items={vm.waitingItems}
                        description={t.jbwos.waiting.description}
                        className="flex-1 min-w-0"
                        emptyMessage={<div className="text-slate-300 text-[0.9em] mt-10 text-center">{t.jbwos.waiting.empty}</div>}
                        onRenameItem={handleRenameItem}
                    />

                    {/* 3. Ready (The Sacred Zone) - Slightly wider/more important */}
                    <BucketColumn
                        id="ready"
                        title={t.jbwos.ready.title}
                        items={vm.readyItems}
                        description={t.jbwos.ready.description}
                        className="flex-[1.2] min-w-0 border-x-2 border-amber-100 dark:border-slate-800 px-4 h-full"
                        onRenameItem={handleRenameItem}
                        emptyMessage={
                            // If no items done yet today, show generic empty. If done items exist, show "Done for day"
                            vm.doneItems.length > 0 && vm.readyItems.length === 0
                                ? <GentleMessage variant="done_for_day" />
                                : <div className="text-slate-300 text-[0.9em] mt-10 text-center whitespace-pre-wrap">{t.jbwos.ready.emptyGeneric}</div>
                        }
                    />

                    {/* 4. Pending */}
                    <BucketColumn
                        id="pending"
                        title={t.jbwos.pending.title}
                        items={vm.pendingItems}
                        description={t.jbwos.pending.description}
                        className="flex-1 min-w-0 opacity-70 hover:opacity-100 transition-opacity"
                        onRenameItem={handleRenameItem}
                    />

                    {/* 5. Done (The Log of Achievement) */}
                    <BucketColumn
                        id="done"
                        title={t.jbwos.done.title}
                        items={vm.doneItems}
                        description={t.jbwos.done.description}
                        className="flex-1 min-w-0 bg-slate-50/50 dark:bg-slate-900/10 grayscale opacity-80"
                        emptyMessage={<div className="text-slate-300 text-[0.9em] mt-10 text-center">{t.jbwos.done.empty}</div>}
                        onRenameItem={handleRenameItem}
                    />
                </div>

            </div>

            <DragOverlay>
                {activeItem ? <ItemCard item={activeItem} /> : null}
            </DragOverlay>

        </DndContext>
    );
};
