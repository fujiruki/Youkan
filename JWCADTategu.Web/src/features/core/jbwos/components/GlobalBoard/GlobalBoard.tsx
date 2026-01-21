import React, { useState } from 'react';
import {
    DndContext,
    DragOverlay,
    useSensors,
    useSensor,
    PointerSensor,
    KeyboardSensor,
    pointerWithin,
    DragStartEvent,
    DragEndEvent,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ApiClient } from '../../../../../api/client';
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
import { useToast } from '../../../../../contexts/ToastContext'; // [NEW]
import { ProjectCreationDialog } from '../Modal/ProjectCreationDialog'; // [NEW]

interface GlobalBoardProps {
    onClose?: () => void;
    initialLayoutMode?: 'standard' | 'panorama'; // [NEW]
}

export const JbwosBoard: React.FC<GlobalBoardProps> = ({ onClose, initialLayoutMode }) => {
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
    const [viewMode, setViewMode] = useState<'board' | 'calendar'>('board');
    // [NEW] Layout Mode for Board: 'standard' (Vertical) or 'panorama' (Grid)
    const [layoutMode, setLayoutMode] = useState<'standard' | 'panorama'>(initialLayoutMode || 'standard');

    // [NEW] URL Synchronization
    const switchLayoutMode = (mode: 'standard' | 'panorama') => {
        setLayoutMode(mode);
        // Update URL strictly - Assuming base is important? 
        // Or just replace path suffix?
        // Let's just push strictly as requested: /JBWOS/Panorama or /JBWOS/Focus
        // Caution: This might affect if we are at root /. 
        // User requested: /JBWOS/Panorama
        // We should check if we are in dev/prod.
        // Simple pushState for now.
        const path = mode === 'panorama' ? '/JBWOS/Panorama' : '/JBWOS/Focus';
        window.history.pushState({ layoutMode: mode }, '', path);
    };

    // [NEW] Column Count for Panorama Mode
    const [columnCount, setColumnCount] = useState<number>(() => {
        try {
            const saved = localStorage.getItem('jbwos_panorama_cols');
            return saved ? parseInt(saved, 10) : 3; // Default to 3
        } catch (e) { return 3; }
    });

    const handleColumnChange = (val: number) => {
        setColumnCount(val);
        localStorage.setItem('jbwos_panorama_cols', val.toString());
    };

    // Helper to generate dynamic column classes
    // Tailwind needs full class names to be scannable, so we map them explictly.
    const getColumnClass = (count: number) => {
        switch (count) {
            case 1: return "md:columns-1";
            case 2: return "md:columns-2";
            case 3: return "md:columns-3";
            case 4: return "md:columns-4";
            case 5: return "md:columns-5";
            default: return "md:columns-3";
        }
    };

    // --- Find Container Helper ---
    const findContainer = (id: string) => {
        if (['active', 'preparation', 'intent', 'log', 'life', 'history'].includes(id)) return id;
        if (vm.gdbActive.find(i => i.id === id)) return 'active';
        if (vm.gdbPreparation.find(i => i.id === id)) return 'preparation';
        if (vm.gdbIntent.find(i => i.id === id)) return 'intent';
        if (vm.gdbLog.find(i => i.id === id)) return 'log';
        return null;
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        if (!over) return;

        const activeItemId = active.id as string;
        const overId = over.id as string;

        // Calendar Drop Logic
        if (typeof overId === 'string' && overId.startsWith('cal-day-')) {
            const timestampMs = parseInt(overId.replace('cal-day-', ''), 10);
            if (!isNaN(timestampMs)) {
                const prepDateSec = Math.floor(timestampMs / 1000);
                await vm.updatePreparationDate(activeItemId, prepDateSec);
                return;
            }
        }

        // Resolve Container
        const overContainerId = findContainer(overId);
        const activeContainerId = findContainer(activeItemId);

        // If dropped in same container, do nothing (sorting not implemented in VM yet)
        if (overContainerId === activeContainerId) return;

        // Board Drop Logic
        if (overContainerId === 'preparation') {
            await vm.resolveDecision(activeItemId, 'hold', 'Dragged to Preparation');
        } else if (overContainerId === 'intent') {
            await vm.moveToSomeday(activeItemId);
        } else if (overContainerId === 'life') {
            await vm.resolveDecision(activeItemId, 'no', 'life');
        } else if (overContainerId === 'history') {
            await vm.resolveDecision(activeItemId, 'no', 'history');
        } else if (overContainerId === 'active') {
            // Return to Inbox?
            // Only if coming from non-active
            if (activeContainerId !== 'active') {
                // Reuse returnToInbox or similar?
                // For now, vm.updateItem(id, {status: 'inbox'})
                await vm.updateItem(activeItemId, { status: 'inbox' });
                vm.refresh();
            }
        }
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
    const [showProjectDialog, setShowProjectDialog] = useState(false); // [NEW] Project creation dialog

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
    const [modalHistory, setModalHistory] = useState<Item[]>([]); // [NEW] Navigation Stack

    const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, itemId });
    };

    // [NEW] Open Item with History
    const handleOpenItem = (item: Item) => {
        if (detailItem) {
            // Push current to history if we are drilling down
            setModalHistory(prev => [...prev, detailItem]);
        }
        setDetailItem(item);
    };

    // [NEW] Open Parent (Drill-up / Context Switch)
    const handleOpenParent = (parentId: string) => {
        const parent = findItem(parentId);
        if (parent) {
            handleOpenItem(parent);
        }
    };

    const handleCloseModal = () => {
        if (modalHistory.length > 0) {
            // Pop from history
            const prev = modalHistory[modalHistory.length - 1];
            setDetailItem(prev);
            setModalHistory(prev => prev.slice(0, -1));
        } else {
            // Fully close
            setDetailItem(null);
            setInitialFocus(undefined);
            // [FIX] Restore focus to input after modal closes
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    // [FIX] Wrapper to ensure detailItem tracks updates immediately
    const handleItemUpdate = async (id: string, updates: Partial<Item>) => {
        // 1. Optimistic / Immediate Local Update
        if (detailItem && detailItem.id === id) {
            setDetailItem(prev => prev ? { ...prev, ...updates } : null);
        }
        // 2. Persist & Global State
        await vm.updateItem(id, updates);
    };

    return (
        <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <HelpGuideModal isOpen={showHelp} onClose={() => setShowHelp(false)} />
            <ProjectCreationDialog
                isOpen={showProjectDialog}
                onClose={() => setShowProjectDialog(false)}
                onCreate={async (project, defaultTasks) => {
                    // Ensure required fields are present
                    if (!project.title) return;
                    await vm.createProject(project as Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'>, defaultTasks);
                    setShowProjectDialog(false);
                    showToast({ type: 'success', title: 'プロジェクト作成完了', message: project.title });
                }}
            />

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
                onClose={handleCloseModal}
                onOpenItem={handleOpenItem}
                onOpenParent={handleOpenParent} // [NEW]
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
                onUpdate={handleItemUpdate} // [FIX] Use wrapper
                onDelegate={vm.delegateTask}
                onCreateSubTask={vm.createSubTask}
                onGetSubTasks={vm.getSubTasks}
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

                        {/* [NEW] Layout Switcher (Visible only in Board mode) */}
                        {/* [NEW] Layout Switcher (Visible only in Board mode) */}
                        {viewMode === 'board' && (
                            <div className="hidden md:flex items-center gap-2">
                                <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5 ml-2">
                                    <button
                                        onClick={() => switchLayoutMode('standard')}
                                        className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${layoutMode === 'standard' ? 'bg-white dark:bg-slate-600 shadow text-slate-800' : 'text-slate-500'}`}
                                        title="Standard (Vertical)"
                                    >
                                        Focus
                                    </button>
                                    <button
                                        onClick={() => switchLayoutMode('panorama')}
                                        className={`px-2 py-1 text-xs font-bold rounded-md transition-all ${layoutMode === 'panorama' ? 'bg-white dark:bg-slate-600 shadow text-slate-800' : 'text-slate-500'}`}
                                        title="Panorama (Grid All)"
                                    >
                                        Panorama
                                    </button>
                                </div>

                                {/* [NEW] Density Slider (Only in Panorama) */}
                                {layoutMode === 'panorama' && (
                                    <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-full">
                                        <span className="text-[10px] font-bold text-slate-400">密度</span>
                                        <input
                                            type="range"
                                            min="1"
                                            max="5"
                                            value={columnCount}
                                            onChange={(e) => handleColumnChange(Number(e.target.value))}
                                            className="w-20 h-1 bg-slate-300 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                            title="列数を変更 (1-5)"
                                        />
                                        <span className="text-xs font-mono text-slate-500 w-3">{columnCount}</span>
                                    </div>
                                )}
                            </div>
                        )}

                        <button
                            onClick={() => setShowProjectDialog(true)}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all ml-2 whitespace-nowrap"
                            title="新規プロジェクト作成"
                        >
                            <span className="hidden md:inline">+ プロジェクト</span>
                            <span className="md:hidden">+</span>
                        </button>
                        <button onClick={() => setShowHelp(true)} className="p-1 hover:bg-slate-200 rounded-full hidden md:block" title="Help">
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

                {/* Main Content (Vertical Stack as "Desk" or Fluid Masonry) */}
                <div className="flex-1 overflow-hidden bg-slate-50/50 dark:bg-slate-900/50">
                    {viewMode === 'board' ? (
                        <div className={layoutMode === 'panorama'
                            ? `block columns-1 ${getColumnClass(columnCount)} gap-4 p-4 h-full overflow-y-auto scrollbar-thin` // Dynamic Columns with custom scrollbar
                            : "max-w-4xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6 h-full overflow-y-auto scrollbar-thin" // Standard: Vertical
                        }>

                            {/* 1. Active Shelf (Today's Judgment) */}
                            <section className={layoutMode === 'panorama'
                                ? "mb-4 break-inside-avoid bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden"
                                : ""
                            }>
                                <div>
                                    <BucketColumn
                                        id="active"
                                        title="【今日やるか決める (Inbox)】"
                                        items={vm.gdbActive}
                                        description="ここにあるものを今日やるか決める"
                                        className={layoutMode === 'panorama' ? "p-2" : "w-full bg-white dark:bg-slate-800 shadow-sm rounded-xl border border-slate-200 dark:border-slate-700 p-0 overflow-hidden"}
                                        emptyMessage={<GentleMessage variant="inbox_clean" />}
                                        onClickItem={(item) => setDetailItem(item)}
                                        onContextMenu={handleContextMenu}
                                        isCompact={layoutMode === 'panorama'}
                                        onCreateSubTask={vm.createSubTask} // [NEW]
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
                                </div>
                            </section>

                            {/* 2. Preparation Shelf (The "Blurry") */}
                            <section className={layoutMode === 'panorama'
                                ? "mb-4 break-inside-avoid bg-slate-100/80 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700"
                                : "opacity-90"
                            }>
                                <div>
                                    <BucketColumn
                                        id="preparation"
                                        title="【準備・出番待ち (Standby)】"
                                        items={vm.gdbPreparation}
                                        description="まだ約束しない。量感カレンダーへ。"
                                        className={layoutMode === 'panorama' ? "p-2" : "w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-0"}
                                        emptyMessage={<div className="p-8 text-center text-slate-300 text-sm">備えなし</div>}
                                        onClickItem={(item) => setDetailItem(item)}
                                        onContextMenu={handleContextMenu}
                                        isCompact={layoutMode === 'panorama'}
                                        onCreateSubTask={vm.createSubTask} // [NEW]
                                    />
                                </div>
                            </section>

                            {/* 3. Intent Shelf (Nice to do) */}
                            <section className={layoutMode === 'panorama'
                                ? "mb-4 break-inside-avoid bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
                                : "opacity-80"
                            }>
                                <div>
                                    <BucketColumn
                                        id="intent"
                                        title="【いつかやれたら (Someday)】"
                                        items={vm.gdbIntent}
                                        description="期限も約束もない、溜めておく場所。"
                                        className={layoutMode === 'panorama' ? "p-2" : "w-full bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 p-0"}
                                        emptyMessage={<div className="p-8 text-center text-slate-300 text-sm">Intentなし</div>}
                                        onClickItem={(item) => setDetailItem(item)}
                                        // Context menu allows promote/delete? Yes.
                                        onContextMenu={handleContextMenu}
                                        isCompact={layoutMode === 'panorama'}
                                        onCreateSubTask={vm.createSubTask} // [NEW]
                                    />
                                </div>
                            </section>

                            {/* 4. Log (The "History") */}
                            <section className={layoutMode === 'panorama'
                                ? "mb-4 break-inside-avoid bg-slate-200/50 dark:bg-slate-800/30 rounded-lg border border-slate-300/50 dark:border-slate-700"
                                : "opacity-60 hover:opacity-100 transition-opacity pb-20"
                            }>
                                <div>
                                    <BucketColumn
                                        id="log"
                                        title="【履歴】"
                                        items={vm.gdbLog}
                                        description="完了・断った記録。"
                                        className={layoutMode === 'panorama' ? "p-2" : "w-full border-t border-slate-200 dark:border-slate-800 pt-4"}
                                        emptyMessage={<div className="p-4 text-center text-slate-300 text-xs">履歴なし</div>}
                                        onContextMenu={handleContextMenu}
                                        isCompact={layoutMode === 'panorama'}
                                    />
                                </div>
                            </section>

                        </div>
                    ) : (
                        <div className="h-full w-full overflow-y-auto">
                            <QuantityCalendar
                                items={[...vm.gdbActive, ...vm.gdbPreparation, ...vm.gdbIntent, ...vm.todayCommits, ...vm.todayCandidates]}
                                onItemClick={(item) => setDetailItem(item)}
                                capacityConfig={vm.capacityConfig}
                                onToggleHoliday={vm.toggleHoliday}
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
                {activeItem ? <ItemCard item={activeItem} isCompact={layoutMode === 'panorama'} /> : null}
            </DragOverlay>
        </DndContext>
    );
};
