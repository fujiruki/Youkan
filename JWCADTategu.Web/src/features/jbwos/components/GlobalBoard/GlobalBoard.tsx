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
import { QuantityCalendar } from '../Calendar/QuantityCalendar'; // [NEW]
import { useToast } from '../../../../contexts/ToastContext'; // [NEW]

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

    // --- View Mode ---
    const [viewMode, setViewMode] = useState<'board' | 'calendar'>('board'); // [NEW]

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const activeItemId = active.id as string;
        const overContainerId = over.id as string;

        // Calendar Drop Logic
        if (typeof overContainerId === 'string' && overContainerId.startsWith('cal-day-')) {
            const timestampMs = parseInt(overContainerId.replace('cal-day-', ''), 10);
            if (!isNaN(timestampMs)) {
                // Convert MS to Seconds for Backend
                const prepDateSec = Math.floor(timestampMs / 1000);
                await vm.updatePreparationDate(activeItemId, prepDateSec);
                return;
            }
        }

        // Board Drop Logic
        if (overContainerId === 'preparation') {
            await vm.resolveDecision(activeItemId, 'hold', 'Dragged to Preparation');
        } else if (overContainerId === 'intent') {
            await vm.resolveDecision(activeItemId, 'no', 'intent');
        } else if (overContainerId === 'life') {
            await vm.resolveDecision(activeItemId, 'no', 'life');
        } else if (overContainerId === 'history') {
            await vm.resolveDecision(activeItemId, 'no', 'history');
        } else if (overContainerId === 'active') {
            // Maybe return to inbox/active?
            // Since active logic is "Inbox or RDD arrived", explicit move might mean setting RDD to now?
            // For now, let's assume we can't easily drag BACK without explicit action.
        }
        // Note: Moving back to Active from Preparation implies "re-evaluating". 
    };

    // --- Find Active Item Helper ---
    const findItem = (id: string) => {
        return [...vm.gdbActive, ...vm.gdbPreparation, ...vm.gdbLog].find(i => i.id === id);
    };
    const activeItem = activeId ? findItem(activeId) : null;

    // --- Quick Input (ThrowIn) ---
    const [inputValue, setInputValue] = useState('');
    const [detailItem, setDetailItem] = useState<Item | null>(null);
    const [lastThrowInId, setLastThrowInId] = useState<string | null>(null); // [NEW] Track last added item
    const inputRef = React.useRef<HTMLInputElement>(null); // [NEW] Ref for keeping focus
    const { showToast } = useToast(); // [NEW] Toast

    const handleThrowIn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim()) return;

        const newId = await vm.throwIn(inputValue);
        if (newId) {
            setLastThrowInId(newId);
            showToast({ type: 'success', title: 'Inboxに保存しました', message: inputValue }); // [NEW] Feedback
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
                    // [FIX] Restore focus to input after modal closes
                    setTimeout(() => inputRef.current?.focus(), 100);
                }}
                onDecision={async (id, decision, note) => {
                    // [NEW] Custom Routing for "Not This Time" (No)
                    if (decision === 'no' && (note === 'intent' || note === 'life')) {
                        // Move to Intent or Life (Status Update)
                        await ApiClient.updateItem(id, { status: note as any });
                        vm.refresh();
                    } else if (decision === 'no' && note === 'history') {
                        // Log to History (Standard Reject)
                        await vm.resolveDecision(id, 'no');
                    } else {
                        // Standard Yes/Hold
                        await vm.resolveDecision(id, decision, note);
                    }
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
                        <span>⚡ Today's Decision</span>
                        <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 ml-4">
                            <button
                                onClick={() => setViewMode('board')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'board' ? 'bg-white dark:bg-slate-600 shadow text-amber-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                BOARD
                            </button>
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-600 shadow text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                            >
                                CALENDAR
                            </button>
                        </div>
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
                    {viewMode === 'board' ? (
                        <div className="max-w-4xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6">

                            {/* 1. Active Shelf (Today's Judgment) */}
                            <section>
                                <BucketColumn
                                    id="active"
                                    title="【今日の約束にするか】"
                                    items={vm.gdbActive}
                                    description="ここにあるものを今日やるか決める"
                                    className="w-full bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700 p-0 overflow-hidden"
                                    emptyMessage={<GentleMessage variant="inbox_clean" />}
                                    onClickItem={(item) => setDetailItem(item)}
                                    onContextMenu={handleContextMenu}
                                    footer={
                                        <form onSubmit={handleThrowIn} className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700">
                                            <input
                                                ref={inputRef}
                                                type="text"
                                                value={inputValue}
                                                onChange={(e) => setInputValue(e.target.value)}
                                                onKeyDown={handleInputKeyDown}
                                                placeholder="ここに吐き出す... (EnterでInboxへ / Alt+Dで直前の詳細)"
                                                className="w-full px-3 py-2 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm focus:ring-2 focus:ring-amber-400 focus:outline-none transition-all placeholder:text-slate-400 text-sm text-slate-900 dark:text-slate-100"
                                            />
                                        </form>
                                    }
                                />
                            </section>

                            {/* 2. Preparation Shelf (The "Blurry") */}
                            <section className="opacity-90">
                                <BucketColumn
                                    id="preparation"
                                    title="【備え（ぼやけ）】"
                                    items={vm.gdbPreparation}
                                    description="まだ約束しない。量感カレンダーへ。"
                                    className="w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-0"
                                    emptyMessage={<div className="p-8 text-center text-slate-300 text-sm">備えなし</div>}
                                    onClickItem={(item) => setDetailItem(item)}
                                    onContextMenu={handleContextMenu}
                                />
                            </section>

                            {/* 3. Intent Shelf (Nice to do) */}
                            <section className="opacity-80">
                                <BucketColumn
                                    id="intent"
                                    title="【Intent（やれたらいい）】"
                                    items={vm.gdbIntent}
                                    description="期限も約束もない、溜めておく場所。"
                                    className="w-full bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 p-0"
                                    emptyMessage={<div className="p-8 text-center text-slate-300 text-sm">Intentなし</div>}
                                    onClickItem={(item) => setDetailItem(item)}
                                    // Context menu allows promote/delete? Yes.
                                    onContextMenu={handleContextMenu}
                                />
                            </section>

                            {/* 4. Log (The "History") */}
                            <section className="opacity-60 hover:opacity-100 transition-opacity pb-20">
                                <BucketColumn
                                    id="log"
                                    title="【履歴】"
                                    items={vm.gdbLog}
                                    description="完了・断った記録。"
                                    className="w-full border-t border-slate-200 dark:border-slate-800 pt-4"
                                    emptyMessage={<div className="p-4 text-center text-slate-300 text-xs">履歴なし</div>}
                                    onContextMenu={handleContextMenu}
                                />
                            </section>

                        </div>
                    ) : (
                        <div className="h-full w-full">
                            <QuantityCalendar
                                items={[...vm.gdbActive, ...vm.gdbPreparation, ...vm.gdbIntent, ...vm.todayCommits, ...vm.todayCandidates]}
                                onItemClick={(item) => setDetailItem(item)}
                            />
                        </div>
                    )}
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
