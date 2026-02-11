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
import { useItemContextMenu } from '../../hooks/useItemContextMenu';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { ApiClient } from '../../../../../api/client';
import { BucketColumn } from './BucketColumn';
import { ItemCard } from './ItemCard';
import { GentleMessage } from './GentleMessage';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';
import {
    CheckCircle2, AlertCircle, FolderPlus,
    BookOpen, X, Trash2, Edit2
} from 'lucide-react';
import { HelpGuideModal } from '../Modal/HelpGuideModal';
import { DecisionDetailModal } from '../Modal/DecisionDetailModal';
import { ContextMenu } from './ContextMenu';
import { SideMemoPanel } from '../SideMemo/SideMemoPanel';
import { Item } from '../../types';
import { useToast } from '../../../../../contexts/ToastContext';
import { ProjectCreationDialog } from '../Modal/ProjectCreationDialog';
import { useAuth } from '../../../auth/providers/AuthProvider'; // [NEW]
import { QuickInputWidget } from '../Inputs/QuickInputWidget'; // [NEW]


interface GlobalBoardProps {
    onClose?: () => void;
    initialLayoutMode?: 'standard' | 'panorama'; // [NEW]
    projectId?: string; // [NEW] Filter for specific project
    rowHeight?: number; // [NEW] Display density
    hideHeader?: boolean; // [NEW]
}

export const JbwosBoard: React.FC<GlobalBoardProps> = ({
    onClose,
    initialLayoutMode,
    projectId,
    rowHeight = 12,
    hideHeader = false
}) => {
    const vm = useJBWOSViewModel(projectId);
    const {
        gdbActive,
        gdbPreparation,
        gdbIntent,
        ghostGdbCount,
        ghostTodayCount,
        allProjects // [NEW] Needed for logic
    } = vm;
    const [activeId, setActiveId] = useState<string | null>(null);
    const { joinedTenants } = useAuth(); // [RESTORED]
    const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null); // [NEW]

    // Default Selection Logic based on filterMode
    // Default Selection Logic based on filterMode
    // [FIX] Determine Focused Project
    const focusedProject = projectId ? allProjects.find(p => p.id === projectId) : null;

    // Default Selection Logic based on filterMode
    useEffect(() => {
        if (vm.filterMode === 'company' && joinedTenants.length > 0) {
            if (!selectedTenantId || !joinedTenants.find(t => t.id === selectedTenantId)) {
                console.log('[Board] Auto-selecting first tenant:', joinedTenants[0].name);
                setSelectedTenantId(joinedTenants[0].id);
            }
        } else if (vm.filterMode === 'personal' || vm.filterMode === 'all') {
            setSelectedTenantId(null);
        }
    }, [vm.filterMode, joinedTenants.length]); // Re-run when filter mode or list length changes

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
    // [NEW] Layout Mode for Board: 'standard' (Vertical) or 'panorama' (Grid)
    const [layoutMode, setLayoutMode] = useState<'standard' | 'panorama'>(initialLayoutMode || 'standard');

    // [NEW] URL Synchronization - Uses Vite base path for production compatibility
    useEffect(() => {
        if (initialLayoutMode) {
            setLayoutMode(initialLayoutMode);
        }
    }, [initialLayoutMode]);

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
    // [REPLACED] Logic moved to QuickInputWidget

    const [detailItem, setDetailItem] = useState<Item | null>(null);
    const { showToast } = useToast();
    const [showProjectDialog, setShowProjectDialog] = useState(false);



    // --- Context Menu Logic ---
    const [initialFocus, setInitialFocus] = useState<'date' | undefined>(undefined); // [NEW] moved to top
    const { menuState: contextMenu, handleContextMenu, closeMenu, lastTargetId, setLastTargetId } = useItemContextMenu({
        onDelete: (id) => vm.deleteItem(id)
    });
    const [modalHistory, setModalHistory] = useState<Item[]>([]); // [NEW] Navigation Stack

    // [NEW] Global Key Listeners for ALT+D (Undo is handled by UndoProvider)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // ALT + D: Open Detail (Global Fallback)
            if (e.altKey && e.key.toLowerCase() === 'd') {
                if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
                e.preventDefault();
                // We use contextMenu.targetId if available, otherwise just ignore?
                // Or maybe the hook should track "lastInteracted" even if menu is closed.
                // For now, let's stick to simple commonality.
                const targetId = contextMenu?.targetId || lastTargetId;
                if (targetId) {
                    const item = findItem(targetId);
                    if (item) {
                        setDetailItem(item);
                        setInitialFocus('date');
                    }
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [contextMenu, vm]);

    // handleContextMenu moved to hook

    // [NEW] Open Item with History
    const handleOpenItem = (item: Item) => {
        if (detailItem) {
            // Push current to history if we are drilling down
            setModalHistory(prev => [...prev, detailItem]);
        }
        setDetailItem(item);
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
            setInitialFocus(undefined);
            // [Fix] Focus restoration removed as we moved input logic
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
                onCreate={async (project: any, defaultTasks: any[]) => {
                    // Ensure required fields are present
                    if (!project.title) return;
                    await vm.createProject(project as Omit<Item, 'id' | 'createdAt' | 'updatedAt' | 'statusUpdatedAt'>, defaultTasks);
                    setShowProjectDialog(false);
                    showToast({ type: 'success', title: 'プロジェクト作成完了', message: project.title || project.name });
                }}
            />

            {/* Context Menu Overlay */}
            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    itemId={contextMenu.targetId!}
                    onClose={closeMenu}
                    onDelete={async (id) => {
                        await vm.deleteItem(id);
                        closeMenu();
                    }}
                    actions={[
                        {
                            label: '詳細 / 名前変更',
                            icon: <Edit2 size={14} />,
                            onClick: () => {
                                const item = findItem(contextMenu.targetId!);
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
                                await vm.updateItem(contextMenu.targetId!, { isProject: true });
                            }
                        },
                        {
                            label: '今日やる (Done Today)',
                            icon: <CheckCircle2 size={14} className="text-green-500" />,
                            onClick: async () => {
                                await vm.resolveDecision(contextMenu.targetId!, 'yes');
                            }
                        },
                        {
                            label: '断る (Rejected)',
                            icon: <AlertCircle size={14} className="text-amber-500" />,
                            onClick: async () => {
                                await vm.resolveDecision(contextMenu.targetId!, 'no', 'history');
                            }
                        },
                        {
                            label: '完全削除 (Delete)',
                            icon: <Trash2 size={14} />,
                            danger: true,
                            onClick: async () => {
                                await vm.deleteItem(contextMenu.targetId!);
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
                joinedTenants={joinedTenants}
                quantityItems={[...vm.gdbActive, ...vm.gdbPreparation, ...vm.gdbLog, ...vm.gdbIntent]}
                filterMode={vm.filterMode}
                capacityConfig={vm.capacityConfig}
            />

            <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex flex-col relative overflow-y-auto overflow-x-hidden">
                {/* Header */}
                {!hideHeader && (
                    <div className="flex-none flex items-center justify-between px-3 md:px-6 py-3 bg-slate-100/50 dark:bg-slate-800/50 border-b border-white/10 shrink-0 z-10 gap-1 md:gap-2">
                        <div className="text-xl font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                            <span className="hidden md:inline">⚡ Today's Decision</span>
                            <span className="md:hidden">⚡</span>

                            {/* Consistently using DashboardScreen's header for View Mode switching */}

                            {/* Density Slider (Panorama Only) */}
                            {layoutMode === 'panorama' && (
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
                )}

                {/* Main Content (Vertical Stack as "Desk" or Fluid Masonry) */}
                <div className="flex-1 overflow-hidden bg-white dark:bg-slate-900 transition-colors duration-200">
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
                                    onClickItem={(item) => { setDetailItem(item); setLastTargetId(item.id); }}
                                    onContextMenu={handleContextMenu}
                                    isCompact={layoutMode === 'panorama'}
                                    rowHeight={rowHeight}
                                    onCreateSubTask={vm.createSubTask}
                                    headerRight={
                                        focusedProject ? (
                                            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded px-2 py-0.5 border border-slate-200 dark:border-slate-600" >
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">To:</span>
                                                <span className="text-[10px] font-bold text-slate-700 dark:text-slate-200 truncate max-w-[100px]">
                                                    {focusedProject.tenantId
                                                        ? (joinedTenants.find((t: any) => t.id === focusedProject.tenantId)?.name || 'Unknown')
                                                        : 'Personal'}
                                                </span>
                                            </div>
                                        ) : (
                                            <select
                                                value={selectedTenantId || ''}
                                                onChange={(e) => setSelectedTenantId(e.target.value || null)}
                                                className="text-[10px] bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 outline-none focus:ring-1 focus:ring-amber-400 font-bold text-slate-600 dark:text-slate-300 h-[22px]"
                                            >
                                                <option value="">Personal</option>
                                                {joinedTenants.map((t: any) => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        )
                                    }
                                    footer={
                                        <QuickInputWidget
                                            className="p-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-700"
                                            viewModel={vm}
                                            projectContext={focusedProject ? {
                                                id: String(focusedProject.id),
                                                title: focusedProject.title,
                                                name: focusedProject.title,
                                                tenantId: focusedProject.tenantId
                                            } : selectedTenantId ? {
                                                title: joinedTenants.find((t: any) => t.id === selectedTenantId)?.name || 'Unknown',
                                                name: joinedTenants.find((t: any) => t.id === selectedTenantId)?.name || 'Unknown',
                                                tenantId: selectedTenantId
                                            } : null}
                                            onRequestFallbackOpen={() => {
                                                if (lastTargetId) {
                                                    const item = findItem(lastTargetId);
                                                    if (item) {
                                                        setDetailItem(item);
                                                        setInitialFocus('date');
                                                    }
                                                }
                                            }}
                                            onOpenItem={(item) => setDetailItem(item)}
                                            placeholder="ここに吐き出す... (EnterでInboxへ / Alt+Dで直前の詳細)"
                                        />
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
                                    onClickItem={(item) => { setDetailItem(item); setLastTargetId(item.id); }}
                                    onContextMenu={handleContextMenu}
                                    isCompact={layoutMode === 'panorama'}
                                    rowHeight={rowHeight} // [NEW]
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
                                    onClickItem={(item) => { setDetailItem(item); setLastTargetId(item.id); }}
                                    onContextMenu={handleContextMenu}
                                    isCompact={layoutMode === 'panorama'}
                                    rowHeight={rowHeight} // [NEW]
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
                                    rowHeight={rowHeight} // [NEW]
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
                </div>

                {/* Side Memo Panel (Always Visible in GDB) */}
                <SideMemoPanel
                    memos={vm.memos}
                    onAdd={vm.addSideMemo}
                    onDelete={vm.deleteSideMemo}
                    onMoveToInbox={vm.memoToInbox}
                />

            </div >

            <DragOverlay>
                {activeItem ? <ItemCard item={activeItem} isCompact={layoutMode === 'panorama'} /> : null}
            </DragOverlay>
        </DndContext >
    );
};
