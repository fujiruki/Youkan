import React, { useState, useEffect, useRef } from 'react';
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
import { Inbox, PlayCircle, Clock, Archive, Trash2, BookOpen } from 'lucide-react';
import { FirstExperienceModal } from '../Modal/FirstExperienceModal';
import { ConfirmDeleteDialog } from '../Modal/ConfirmDeleteDialog';
import { HelpGuideModal } from '../Modal/HelpGuideModal';
// Example icons
import { t } from '../../../../i18n/labels';


interface GlobalBoardProps {
    onClose?: () => void;
}

interface ContextMenuState {
    visible: boolean;
    x: number;
    y: number;
    itemId: string | null;
}

export const JbwosBoard: React.FC<GlobalBoardProps> = ({ onClose }) => {
    const vm = useJBWOSViewModel();
    const [activeId, setActiveId] = useState<string | null>(null);
    const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0, itemId: null });
    const menuRef = useRef<HTMLDivElement>(null); // [NEW] Ref for context menu

    // --- Help Modal State ---
    const [showHelp, setShowHelp] = useState(false);

    // --- Onboarding Logic ---
    const [showOnboarding, setShowOnboarding] = useState(false);
    useEffect(() => {
        const hasVisited = localStorage.getItem('jbwos_visited_v1');
        if (!hasVisited) {
            setShowOnboarding(true);
        }
    }, []);

    const handleOnboardingComplete = () => {
        localStorage.setItem('jbwos_visited_v1', 'true');
        setShowOnboarding(false);
    };

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
        else if (vm.scheduledItems.find(i => i.id === activeItemId)) currentStatus = 'scheduled';
        else if (vm.waitingItems.find(i => i.id === activeItemId)) currentStatus = 'waiting'; // GDB
        else if (vm.readyItems.find(i => i.id === activeItemId)) currentStatus = 'ready'; // Today
        else if (vm.executionItems.find(i => i.id === activeItemId)) currentStatus = 'execution';
        else if (vm.pendingItems.find(i => i.id === activeItemId)) currentStatus = 'pending';
        else if (vm.doneItems.find(i => i.id === activeItemId)) currentStatus = 'done'; // History

        if (currentStatus === overContainerId) return; // No change

        try {
            switch (overContainerId) {
                case 'inbox':
                    await vm.moveToInbox(activeItemId);
                    break;
                case 'scheduled':
                    await vm.moveToScheduled(activeItemId);
                    break;
                case 'waiting': // GDB
                    await vm.moveToWaiting(activeItemId, "Moved via Drag");
                    break;
                // Ready, Execution, Done are REMOVED from GDB D&D per "Pure GDB" and "Event Driven" rules.
                // Items cannot be dragged into Today directly.

            }
        } catch (e: any) {
            console.error('[GlobalBoard] Drag End Error:', e);
            // Translate explicit "Max 2" error or fallback to generic
            if (e.message.includes('Ready bucket is full') || e.message.includes('Max 2') || e.message.includes('手一杯')) {
                alert(t.jbwos.common.alerts?.readyLimit || "今日はもう手一杯です（最大2件まで）");
            } else {
                console.warn('[GlobalBoard] Move failed:', e); // Only warn for unexpected errors
                alert(t.jbwos.common.alerts.moveFailed + `: ${e.message} `);
            }
        }
    };

    // --- Active Item for Overlay ---
    const findItem = (id: string) => {
        const all = [
            ...vm.inboxItems,
            ...vm.scheduledItems,
            ...vm.waitingItems,
            ...vm.readyItems,
            ...vm.executionItems,
            ...vm.pendingItems,
            ...vm.doneItems
        ];
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

    // --- Actions ---

    // [NEW] Inbox Focus Shortcut
    const inboxInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl+I to focus Inbox
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                inboxInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // --- Context Menu Logic ---
    const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setContextMenu({
            visible: true,
            x: e.clientX,
            y: e.clientY,
            itemId: itemId
        });
    };

    const handleCloseContextMenu = () => {
        setContextMenu({ ...contextMenu, visible: false });
    };

    // [NEW] Undo Shortcut (Ctrl+Z)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                if (vm.canUndo) {
                    console.log('[GlobalBoard] Undo triggered via shortcut');
                    vm.undo();
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [vm.canUndo, vm.undo]); // Re-bind when canUndo changes

    // --- Delete (Archive) Logic ---
    // [UX Update] Removed confirmation dialog as Undo is available.
    const handleDeleteItem = async () => {
        const itemId = contextMenu.itemId;
        handleCloseContextMenu();
        if (itemId) {
            console.log('[GlobalBoard] Archiving item directly:', itemId);
            await vm.archiveItem(itemId);
        }
    };

    // Close menu on click outside
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (contextMenu.visible && menuRef.current && !menuRef.current.contains(e.target as Node)) {
                handleCloseContextMenu();
            }
        };
        // Use 'click' to avoid conflict with drag/select actions that start with mousedown
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, [contextMenu.visible]);

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
            {showOnboarding && <FirstExperienceModal onComplete={handleOnboardingComplete} />}
            <HelpGuideModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
            <div className="h-full w-full bg-slate-100 dark:bg-slate-950 flex flex-col relative overflow-hidden">
                {/* Header / Navigation Controls - Separate Row */}
                <div className="flex-none flex items-center justify-between px-6 py-3 bg-slate-100/50 dark:bg-slate-950/50 border-b border-white/10 shrink-0 z-10">
                    <div className="flex items-center gap-2">
                        {/* Left side content (Title or Logo if needed) */}
                        <div className="text-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <span className="text-2xl">⚡</span>
                            <span className="hidden sm:inline">Global Decision Board</span>
                            <button
                                onClick={() => setShowHelp(true)}
                                className="ml-2 p-1.5 text-slate-400 hover:text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-full transition-colors"
                                title="ガイドを開く"
                            >
                                <BookOpen size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="flex items-center gap-4 text-sm">
                        {/* Zoom Slider */}
                        <div className="flex items-center gap-2 bg-white/50 dark:bg-slate-800/50 px-3 py-1.5 rounded-full shadow-sm backdrop-blur-sm border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] text-slate-500">A</span>
                            <input
                                type="range"
                                min="10"
                                max="24"
                                value={zoomLevel}
                                onChange={(e) => setZoomLevel(Number(e.target.value))}
                                className="w-24 h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer dark:bg-slate-700 accent-amber-500"
                            />
                            <span className="text-sm text-slate-500 font-bold">A</span>
                        </div>

                        <button
                            onClick={onClose}
                            className="flex items-center gap-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-full transition-colors font-medium text-xs shadow-sm"
                            title="元の画面に戻る"
                        >
                            ✖ {t.jbwos.common.close}
                        </button>
                    </div>
                </div>

                {/* Context Menu Overlay */}
                {contextMenu.visible && (
                    <div
                        ref={menuRef} // [NEW] Attach ref
                        className="fixed z-50 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xl rounded-lg py-1 w-40 animate-in fade-in zoom-in-95 duration-100"
                        style={{ top: contextMenu.y, left: contextMenu.x }}
                    // Removed onClick={stopPropagation} as we handle specific outside clicks now
                    >
                        <button
                            onClick={handleDeleteItem}
                            className="w-full text-left px-4 py-2 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2"
                        >
                            <Trash2 size={14} />
                            削除する
                        </button>
                    </div>
                )}

                {/* Main Content - Zoom Applied Here using base font size */}
                <div
                    className="flex-1 flex gap-4 items-stretch p-6 pt-2 pb-4 overflow-hidden"
                    style={{ fontSize: `${zoomLevel}px` }}
                >

                    {/* 1. Inbox (放り込み箱) */}
                    <BucketColumn
                        id="inbox"
                        title={t.jbwos.inbox.title}
                        items={vm.inboxItems}
                        description={t.jbwos.inbox.description}
                        className="flex-1 min-w-0" // Flexible
                        emptyMessage={<GentleMessage variant="inbox_clean" />}
                        onRenameItem={handleRenameItem} // Pass new handler
                        onContextMenu={handleContextMenu}
                        footer={
                            <form onSubmit={handleThrowIn} className="mt-2 relative">
                                <input
                                    ref={inboxInputRef} // [NEW]
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={t.jbwos.inbox.placeholder}
                                    className="w-full px-4 py-3 rounded-full border-none shadow-sm focus:ring-2 focus:ring-amber-400 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 text-[1em]"
                                />
                            </form>
                        }
                    />

                    {/* 2. Scheduled (予定) - NEW */}
                    <BucketColumn
                        id="scheduled"
                        title={t.jbwos.scheduled.title}
                        items={vm.scheduledItems}
                        description={t.jbwos.scheduled.description}
                        className="flex-1 min-w-0"
                        emptyMessage={<div className="text-slate-300 text-[0.9em] mt-10 text-center">{t.jbwos.scheduled.empty}</div>}
                        onRenameItem={handleRenameItem}
                        onContextMenu={handleContextMenu}
                    />

                    {/* 3. Waiting (連絡待ち) */}
                    <BucketColumn
                        id="waiting"
                        title={t.jbwos.waiting.title}
                        items={vm.waitingItems}
                        description={t.jbwos.waiting.description}
                        className="flex-1 min-w-0" // Flexible
                        emptyMessage={<div className="text-slate-300 text-[0.9em] mt-10 text-center">{t.jbwos.waiting.empty}</div>}
                        onRenameItem={handleRenameItem}
                        onContextMenu={handleContextMenu}
                    />
                </div>

            </div>

            <DragOverlay>
                {activeItem ? <ItemCard item={activeItem} onContextMenu={() => { }} /> : null}
            </DragOverlay>

        </DndContext>
    );
};
