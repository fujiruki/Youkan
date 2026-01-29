import React, { useState, useEffect } from 'react';
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
import {
    CheckCircle2, AlertCircle, FolderPlus,
    LayoutList, LayoutGrid, Calendar, BookOpen, X, Trash2, Edit2
} from 'lucide-react';
import { HelpGuideModal } from '../Modal/HelpGuideModal';
import { DecisionDetailModal } from '../Modal/DecisionDetailModal';
import { ContextMenu } from './ContextMenu';
import { SideMemoPanel } from '../SideMemo/SideMemoPanel';
import { Item } from '../../types';
import { RyokanCalendar } from '../Calendar/RyokanCalendar';
import { useToast } from '../../../../../contexts/ToastContext';
import { ProjectCreationDialog } from '../Modal/ProjectCreationDialog';


interface GlobalBoardProps {
    onClose?: () => void;
    initialLayoutMode?: 'standard' | 'panorama'; // [NEW]
    projectId?: string; // [NEW] Filter for specific project
}

export const JbwosBoard: React.FC<GlobalBoardProps> = ({ onClose, initialLayoutMode, projectId }) => {
    const vm = useJBWOSViewModel(projectId);
    const {
        gdbActive,
        gdbPreparation,
        gdbIntent,
        todayCandidates,
        todayCommits,
        ghostGdbCount,
        ghostTodayCount
    } = vm;
    const [activeId, setActiveId] = useState<string | null>(null);

    // --- help Guid Modal ---
    const [showHelp, setShowHelp] = useState(false);

    // [NEW] Refresh when project context changes
    useEffect(() => {
        vm.refreshGdb(projectId);
    }, [projectId, vm.refreshGdb]);

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

    // [NEW] URL Synchronization - Uses Vite base path for production compatibility
    const switchLayoutMode = (mode: 'standard' | 'panorama') => {
        setLayoutMode(mode);
        // Get base path from Vite config (e.g., './' or '/contents/TateguDesignStudio/')
        const basePath = import.meta.env.BASE_URL || '/';
        const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
        const path = mode === 'panorama' ? normalizedBase + 'JBWOS/Panorama' : normalizedBase + 'JBWOS/Focus';
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
        if (['active', 'waiting', 'pending', 'log', 'life', 'history'].includes(id)) return id;
        if (vm.gdbActive.find(i => i.id === id)) return 'active';
        if (vm.gdbPreparation.find(i => i.id === id)) return 'waiting';
        if (vm.gdbIntent.find(i => i.id === id)) return 'pending';
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
        if (overContainerId === 'waiting') {
            // Move to Waiting. Using Generic Update or Delegate?
            // "Waiting" usually implies delegation or external dependency.
            // If just dragging, maybe we need a "reason"?
            // For now, simple move:
            await vm.updateItem(activeItemId, { status: 'waiting', waitingReason: 'Moved from board' });
            vm.refreshAll();
        } else if (overContainerId === 'pending') {
            await vm.moveToSomeday(activeItemId);
        } else if (overContainerId === 'life') {
            await vm.resolveDecision(activeItemId, 'no', 'life');
        } else if (overContainerId === 'history') {
            // Done/Archive logic
            await vm.resolveDecision(activeItemId, 'no', 'history');
        } else if (overContainerId === 'active') {
            // Return to Inbox
            if (activeContainerId !== 'active') {
                await vm.updateItem(activeItemId, { status: 'inbox' });
                vm.refreshAll();
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
        if (e.altKey && e.key.toLowerCase() === 'd') {
            e.preventDefault();
            if (lastThrowInId) {
                const item = findItem(lastThrowInId);
                if (item) {
                    setDetailItem(item);
                    setInitialFocus('date'); // [NEW] Focus date for instant decision
                }
            }
        }
    };

    // --- Context Menu Logic ---
    const [initialFocus, setInitialFocus] = useState<'date' | undefined>(undefined); // [NEW] moved to top
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, itemId: string } | null>(null);
    const [lastInteractedItemId, setLastInteractedItemId] = useState<string | null>(null); // [NEW] Track for Del key
    const [modalHistory, setModalHistory] = useState<Item[]>([]); // [NEW] Navigation Stack

    // [NEW] Global Key Listeners for Delete / Undo
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if typing in input
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

            // Delete key
            if (e.key === 'Delete' && lastInteractedItemId) {
                if (confirm('このアイテムを削除しますか？')) {
                    vm.deleteItem(lastInteractedItemId);
                    setLastInteractedItemId(null);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lastInteractedItemId, vm]);

    const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, itemId });
        setLastInteractedItemId(itemId); // [NEW]
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
                    actions={[
                        {
                            label: '詳細 / 名前変更',
                            icon: <Edit2 size={14} />,
                            onClick: () => {
                                const item = findItem(contextMenu.itemId);
                                if (item) {
                                    setDetailItem(item);
                                    setInitialFocus(undefined);
                                }
                            }
                        },
                        {
                            label: 'プロジェクト化',
                            icon: <FolderPlus size={14} />,
                            onClick: async () => {
                                await vm.updateItem(contextMenu.itemId, { isProject: true });
                            }
                        },
                        {
                            label: '今日やる (Done Today)',
                            icon: <CheckCircle2 size={14} className="text-green-500" />,
                            onClick: async () => {
                                await vm.resolveDecision(contextMenu.itemId, 'yes');
                            }
                        },
                        {
                            label: '断る (Rejected)',
                            icon: <AlertCircle size={14} className="text-amber-500" />,
                            onClick: async () => {
                                await vm.resolveDecision(contextMenu.itemId, 'no', 'history');
                            }
                        },
                        {
                            label: '完全削除 (Delete)',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onClick: async () => {
                                await vm.deleteItem(contextMenu.itemId);
                            }
                        }
                    ]}
                />
            )}

            <DecisionDetailModal
                item={detailItem}
                initialFocus={initialFocus}
                onClose={handleCloseModal}
                onOpenItem={handleOpenItem}
                onOpenParent={handleOpenParent} // [NEW]
                onDecision={async (id, decision, note, updates) => {
                    // [NEW] Custom Routing for "Not This Time" (No)
                    if (decision === 'no' && (note === 'intent' || note === 'life')) {
                        // Apply pending updates first
                        if (updates && Object.keys(updates).length > 0) {
                            await vm.updateItem(id, updates);
                        }
                        // Move to Intent or Life (Status Update)
                        await ApiClient.updateItem(id, { status: note as any });
                        vm.refreshAll();
                    } else if (decision === 'no' && note === 'history') {
                        // Log to History (Standard Reject)
                        await vm.resolveDecision(id, 'no', undefined, updates);
                    } else {
                        // Standard Yes/Hold
                        await vm.resolveDecision(id, decision, note, updates);
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
                members={vm.members}
            />

            <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex flex-col relative overflow-y-auto overflow-x-hidden">
                {/* Header */}
                <div className="flex-none flex items-center justify-between px-3 md:px-6 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-white/10 shrink-0 z-10 gap-1 md:gap-2">
                    <div className="text-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                        <span className="hidden md:inline">⚡ Today's Decision</span>
                        <span className="md:hidden">⚡</span>

                        {/* Unified Tabs (Focus / Panorama / Calendar) */}
                        <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-1 ml-2 md:ml-4">
                            <button
                                onClick={() => { setViewMode('board'); switchLayoutMode('standard'); }}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${viewMode === 'board' && layoutMode === 'standard' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                                title="Focus View (Vertical)"
                            >
                                <LayoutList size={14} className="md:hidden" />
                                <span className="hidden md:inline">Focus</span>
                            </button>
                            <button
                                onClick={() => { setViewMode('board'); switchLayoutMode('panorama'); }}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${viewMode === 'board' && layoutMode === 'panorama' ? 'bg-white dark:bg-slate-600 shadow text-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-700'}`}
                                title="Panorama View (Grid)"
                            >
                                <LayoutGrid size={14} className="md:hidden" />
                                <span className="hidden md:inline">Panorama</span>
                            </button>
                            <button
                                onClick={() => setViewMode('calendar')}
                                className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-600 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500 hover:text-slate-700'}`}
                                title="Calendar View"
                            >
                                <Calendar size={14} className="md:hidden" />
                                <span className="hidden md:inline">Calendar</span>
                            </button>
                        </div>

                        {/* Density Slider (Panorama Only) */}
                        {viewMode === 'board' && layoutMode === 'panorama' && (
                            <div className="hidden md:flex items-center gap-2 ml-4 px-3 py-1 bg-slate-200/50 dark:bg-slate-800/50 rounded-full animate-in fade-in slide-in-from-left-2">
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

                        <div className="flex-1 w-4"></div> {/* Spacer */}

                        <button
                            onClick={() => setShowProjectDialog(true)}
                            className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-bold transition-all ml-2 whitespace-nowrap shadow-sm hover:shadow"
                            title="新規プロジェクト作成"
                        >
                            <span className="hidden md:inline">+ プロジェクト</span>
                            <span className="md:hidden">+</span>
                        </button>
                        <button onClick={() => setShowHelp(true)} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full hidden md:block transition-colors" title="Help">
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
                    <button onClick={onClose} className="px-3 py-1.5 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded text-xs font-bold hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors">
                        <span className="hidden md:inline">CLOSE</span>
                        <span className="md:hidden"><X size={18} /></span>
                    </button>
                </div>

                {/* Main Content (Vertical Stack as "Desk" or Fluid Masonry) */}
                <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-200">
                    {viewMode === 'board' ? (
                        <div className={layoutMode === 'panorama'
                            ? `block columns-1 ${getColumnClass(columnCount)} gap-2 md:gap-4 p-1 md:p-4 h-full overflow-y-auto scrollbar-thin` // Reduced gap/padding for mobile
                            : "max-w-4xl mx-auto w-full p-4 md:p-6 flex flex-col gap-6 h-full overflow-y-auto scrollbar-thin"
                        }>

                            {/* 1. Active Shelf (Today's Judgment) */}
                            <section className={layoutMode === 'panorama'
                                ? "mb-2 break-inside-avoid bg-white dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden" // Dense: rounded-sm, mb-2
                                : ""
                            }>
                                <div>
                                    <BucketColumn
                                        id="active"
                                        title="【今日やるか決める (Inbox)】"
                                        items={gdbActive}
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

                            {/* 2. Waiting Shelf (External/Blocked) */}
                            <section className={layoutMode === 'panorama'
                                ? "mb-4 break-inside-avoid bg-slate-100/80 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700"
                                : "opacity-90"
                            }>
                                <div>
                                    <BucketColumn
                                        id="waiting"
                                        title="【待ち (Waiting)】"
                                        items={gdbPreparation} // Mapped to Waiting
                                        description="他者や到着を待っている状態。"
                                        className={layoutMode === 'panorama' ? "p-2" : "w-full bg-slate-50 dark:bg-slate-900/50 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 p-0"}
                                        emptyMessage={<div className="p-8 text-center text-slate-300 text-sm">待ちなし</div>}
                                        onClickItem={(item) => setDetailItem(item)}
                                        onContextMenu={handleContextMenu}
                                        isCompact={layoutMode === 'panorama'}
                                        onCreateSubTask={vm.createSubTask}
                                    />
                                </div>
                            </section>

                            {/* 3. Pending Shelf (The "Shelf") */}
                            <section className={layoutMode === 'panorama'
                                ? "mb-4 break-inside-avoid bg-amber-50/50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800"
                                : "opacity-80"
                            }>
                                <div>
                                    <BucketColumn
                                        id="pending"
                                        title="【保留 (Pending)】"
                                        items={gdbIntent} // Mapped to Pending
                                        description="今はやらないと決めたもの（棚）。"
                                        className={layoutMode === 'panorama' ? "p-2" : "w-full bg-amber-50/50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800 p-0"}
                                        emptyMessage={<div className="p-8 text-center text-slate-300 text-sm">保留なし</div>}
                                        onClickItem={(item) => setDetailItem(item)}
                                        onContextMenu={handleContextMenu}
                                        isCompact={layoutMode === 'panorama'}
                                        onCreateSubTask={vm.createSubTask}
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

                            {(ghostGdbCount > 0 || ghostTodayCount > 0) && (
                                <div className="col-span-full py-4 text-center border-t border-slate-100/50 dark:border-slate-800/50 animate-pulse">
                                    <span className="text-[10px] text-slate-400 font-mono italic">
                                        + {ghostGdbCount + ghostTodayCount} hidden items (コンテキスト外の現実はここにあります)
                                    </span>
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="h-full w-full overflow-y-auto">
                            <RyokanCalendar
                                items={[...gdbActive, ...gdbPreparation, ...gdbIntent, ...todayCommits, ...todayCandidates]}
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
