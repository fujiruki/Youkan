import React, { useState } from 'react';
import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    pointerWithin,
    useSensor,
    useSensors,
    DragOverlay,
    DragStartEvent,
    DragEndEvent
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ApiClient } from '../../../../api/client';
import { BucketColumn } from './BucketColumn';
import { ItemCard } from './ItemCard';
import { GentleMessage } from './GentleMessage';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';
import { BookOpen, AlertCircle } from 'lucide-react';
import { HelpGuideModal } from '../Modal/HelpGuideModal';
import { DecisionDetailModal } from '../Modal/DecisionDetailModal';
import { ContextMenu } from './ContextMenu'; // [NEW]
import { SideMemoPanel } from '../SideMemo/SideMemoPanel';
import { Item } from '../../types';

interface GlobalBoardProps {
    onClose?: () => void;
}

export const JbwosBoard: React.FC<GlobalBoardProps> = ({ onClose }) => {
    const vm = useJBWOSViewModel();
    const [activeId, setActiveId] = useState<string | null>(null);

    // --- Help Guid Modal ---
    const [showHelp, setShowHelp] = useState(false);

    // --- Side Memo Logic in Global Board ---
    // Ideally this could be lifted to App level, but GDB is the main workspace.
    // For now, let's include it here.

    // --- Dnd Kit Logic (Restricted) ---
    // GDB primarily supports moving between Active/Hold/Log (Conceptually)
    // But in Phase 2, "Decision" is an explicit action buttons, not just Drag.
    // However, Drag might still be useful for visually sorting or "Holding".
    // Let's keep Dnd for now, but limit targets.

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const activeItemId = active.id as string;
        const overContainerId = over.id as string;

        // Implementation of Drag Actions mapping to Decisions
        // Drag to "Hold" column -> resolveDecision(id, 'hold')
        // Drag to "Log" -> resolveDecision(id, 'no') or similar?
        // Drag to "Active" -> maybe un-hold?

        if (overContainerId === 'hold') {
            await vm.resolveDecision(activeItemId, 'hold', 'Dragged to Hold');
        }
        // Note: Moving back to Active from Hold implies "re-evaluating". 
        // We might need an explicit "return to inbox" action or handle it here if 'active' column exists.
    };

    // --- Find Active Item Helper ---
    const findItem = (id: string) => {
        return [...vm.gdbActive, ...vm.gdbHold, ...vm.gdbLog].find(i => i.id === id);
    };
    const activeItem = activeId ? findItem(activeId) : null;

    // --- Quick Input (ThrowIn) ---
    const [inputValue, setInputValue] = useState('');
    const [detailItem, setDetailItem] = useState<Item | null>(null);
    const [lastThrowInId, setLastThrowInId] = useState<string | null>(null); // [NEW] Track last added item
    const inputRef = React.useRef<HTMLInputElement>(null); // [NEW] Ref for keeping focus

    const handleThrowIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const newId = await vm.throwIn(inputValue);
        if (newId) {
            setLastThrowInId(newId);
            // setDetailItem(optimItem); // Removed: Don't open modal automatically
        }
        setInputValue('');
        // Ensure focus remains on input (it should by default, but to be safe)
        inputRef.current?.focus();
    };

    // [NEW] Shortcut Handler (Alt+D)
    // We listen globally or on the input? The requirement says "focusing the throw-in text box".
    // So let's add onKeyDown to the input.
    const handleInputKeyDown = (e: React.KeyboardEvent) => {
        // Alt + D or Ctrl + Up? User suggested "Shortcut to open Detail of Last Added Item".
        // Let's implement Alt + D as requested in previous turn context.
        if (e.altKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            if (lastThrowInId) {
                const item = findItem(lastThrowInId);
                if (item) {
                    setDetailItem(item);
                    // We need to pass a signal to focus date? 
                    // We'll handle this by passing a separate prop or strict item state?
                    // DecisionDetailModal detects Alt+D too, but here we just want to OPEN it.
                    // The Modal's own useEffect for Alt+D will trigger focus if we ensure it opens.
                }
            }
        }
    };

    // --- Context Menu Logic ---
    const [initialFocus, setInitialFocus] = useState<'date' | undefined>(undefined); // [NEW] moved to top
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, itemId: string } | null>(null);

    const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, itemId });
    };

    return (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <HelpGuideModal isOpen={showHelp} onClose={() => setShowHelp(false)} />

            {/* Context Menu Overlay */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    itemId={contextMenu.itemId}
                    onClose={() => setContextMenu(null)}
                    onDelete={async (id) => {
                        await vm.deleteItem(id);
                        setContextMenu(null);
                    }}
                    onEdit={(id) => {
                        const item = findItem(id);
                        if (item) {
                            setDetailItem(item);
                            setInitialFocus('date');
                        }
                        setContextMenu(null);
                    }}
                />
            )}

            <DecisionDetailModal
                item={detailItem}
                initialFocus={initialFocus}
                onClose={() => {
                    setDetailItem(null);
                    setInitialFocus(undefined);
                }}
                onDecision={async (id, decision, note) => {
                    await vm.resolveDecision(id, decision, note);
                    setDetailItem(null);
                    setInitialFocus(undefined);
                }}
                onDelete={async (id) => {
                    await vm.deleteItem(id);
                    setDetailItem(null);
                }}
                onUpdate={async (id, updates) => {
                    // 1. Optimistic Update Local Modal State
                    setDetailItem(prev => prev ? { ...prev, ...updates } : null);

                    // 2. Persist
                    await ApiClient.updateItem(id, updates);

                    // 3. Refresh Shelf
                    vm.refresh();
                }}
            />

            <div className="h-full w-full bg-slate-100 dark:bg-slate-950 flex flex-col relative overflow-hidden">
                {/* Header */}
                <div className="flex-none flex items-center justify-between px-6 py-3 bg-slate-100/50 dark:bg-slate-950/50 border-b border-white/10 shrink-0 z-10">
                    <div className="text-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span>⚡ Global Decision Board</span>
                        <button onClick={() => setShowHelp(true)} className="p-1 hover:bg-slate-200 rounded-full" title="Help">
                            <BookOpen size={18} className="text-slate-400" />
                        </button>
                    </div>
                    {vm.error && (
                        <div className="flex items-center gap-2 text-red-500 text-sm px-4 py-1 bg-red-50 rounded-full animate-pulse">
                            <AlertCircle size={14} />
                            {vm.error}
                            <button onClick={vm.clearError} className="font-bold ml-2">×</button>
                        </div>
                    )}
                    <button onClick={onClose} className="px-3 py-1.5 bg-slate-200 text-slate-600 rounded text-xs font-bold">
                        CLOSE
                    </button>
                </div>

                {/* Main Content (Vertical Stack as "Desk") */}
                <div className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-900/50">
                    <div className="max-w-4xl mx-auto w-full p-6 md:p-12 flex flex-col gap-12">

                        {/* 1. Active Shelf (The "Now") */}
                        <section>
                            <BucketColumn
                                id="active"
                                title="【今ここにある判断】"
                                items={vm.gdbActive}
                                description="未判断のアイテム。タップして詳細を開く。"
                                className="w-full bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700 p-0 overflow-hidden"
                                emptyMessage={<GentleMessage variant="inbox_clean" />}
                                onClickItem={(item) => setDetailItem(item)}
                                onContextMenu={handleContextMenu}
                                footer={
                                    <form onSubmit={handleThrowIn} className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
                                        <input
                                            ref={inputRef}
                                            type="text"
                                            value={inputValue}
                                            onChange={(e) => setInputValue(e.target.value)}
                                            onKeyDown={handleInputKeyDown}
                                            placeholder="ここに吐き出す... (EnterでInboxへ / Alt+Dで直前の詳細)"
                                            className="w-full px-4 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all placeholder:text-slate-400 text-sm text-slate-900 dark:text-slate-100"
                                        />
                                    </form>
                                }
                            />
                        </section>

                        {/* 2. Hold Shelf (The "Pending") */}
                        <section className="opacity-90">
                            <BucketColumn
                                id="hold"
                                title="【保留中の判断 (Hold)】"
                                items={vm.gdbHold}
                                description="条件待ち・塩漬け。Todayには出ない。"
                                className="w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-0"
                                emptyMessage={<div className="p-8 text-center text-slate-300 text-sm">保留なし</div>}
                                onClickItem={(item) => setDetailItem(item)}
                                onContextMenu={handleContextMenu}
                            />
                        </section>

                        {/* 3. Log (The "History") */}
                        <section className="opacity-60 hover:opacity-100 transition-opacity pb-20">
                            <BucketColumn
                                id="log"
                                title="【過去に判断したもの (参照)】"
                                items={vm.gdbLog}
                                description="最近の処理履歴。"
                                className="w-full border-t border-slate-200 dark:border-slate-800 pt-4"
                                emptyMessage={<div className="p-4 text-center text-slate-300 text-xs">履歴なし</div>}
                                onContextMenu={handleContextMenu}
                            />
                        </section>

                    </div>
                </div>

                {/* Side Memo Panel (Always Visible in GDB) */}
                <SideMemoPanel
                    memos={vm.memos}
                    onAdd={vm.addSideMemo}
                    onDelete={vm.deleteSideMemo}
                    onMoveToInbox={vm.memoToInbox}
                />

            </div>

            <DragOverlay>
                {activeItem ? <ItemCard item={activeItem} /> : null}
            </DragOverlay>
        </DndContext>
    );
};
