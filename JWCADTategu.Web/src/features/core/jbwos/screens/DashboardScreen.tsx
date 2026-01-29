import React, { useState, useEffect } from 'react';
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel';
import { useFocusQueue } from '../../../../hooks/useFocusQueue';
import { Item } from '../types';
import { Project as LocalProject } from '../../../../db/db';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';
import { ProjectCreationDialog } from '../components/Modal/ProjectCreationDialog';
import { ContextMenu } from '../components/GlobalBoard/ContextMenu';
import { Clock, Users, ChevronDown, ChevronRight, Plus, BarChart2, FolderPlus, Trash2, List } from 'lucide-react';
import { FocusCard } from '../components/Dashboard/FocusCard';
import { HeaderProgressBar } from '../components/Dashboard/HeaderProgressBar';
import { SmartItemRow } from '../components/Dashboard/SmartItemRow';
import { SideMemoWidget } from '../components/SideMemo/SideMemoWidget';
import { JbwosBoard } from '../components/GlobalBoard/GlobalBoard';
import { QuantityCalendar } from '../components/Calendar/QuantityCalendar';
import { DEFAULT_CAPACITY_CONFIG } from '../logic/volumeCalculator';
import { ManufacturingLoadWidget } from '../../../plugins/manufacturing/components/ManufacturingLoadWidget';

// StatusBadge and SimpleItemRow removed in favor of SmartItemRow.tsx

const SectionHeader = ({ title, count, icon, expanded, onToggle }: { title: string, count: number, icon?: React.ReactNode, expanded?: boolean, onToggle?: () => void }) => (
    <div
        className={`flex items-center gap-2 mb-2 mt-4 ${onToggle ? 'cursor-pointer select-none group' : ''}`}
        onClick={onToggle}
    >
        {onToggle && (
            <div className="text-slate-400 group-hover:text-slate-600 transition-colors">
                {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </div>
        )}
        {icon && <span className="text-slate-400">{icon}</span>}
        <h2 className="text-xs font-bold text-slate-500 uppercase tracking-widest">{title}</h2>
        {count > 0 && <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded-full font-mono">{count}</span>}
    </div>
);

export const DashboardScreen = ({ activeProject }: { activeProject?: LocalProject | null }) => {
    const [viewMode, setViewMode] = useState<'stream' | 'panorama' | 'calendar'>(() => {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('panorama')) return 'panorama';
        if (path.includes('calendar')) return 'calendar';
        const saved = localStorage.getItem('jbwos_view_mode');
        return (saved === 'panorama' || saved === 'stream' || saved === 'calendar') ? saved : 'stream';
    });

    useEffect(() => {
        localStorage.setItem('jbwos_view_mode', viewMode);
    }, [viewMode]);

    const {
        inboxItems, pendingItems, waitingItems,
        isLoading: isDashboardLoading,
        moveToFocus: legacyMoveToFocus, moveToInbox, completeItem, createItem, refresh: refreshDashboard, updateItem, deleteItem,
        undoItem,
        createProject,
        createSubTask, getSubTasks
    } = useDashboardViewModel(activeProject?.cloudId);

    const {
        items: queueItems,
        loading: isQueueLoading,
        capacityUsed,
        capacityLimit,
        setIntent,
        refresh: refreshQueue
    } = useFocusQueue(480, activeProject?.cloudId);

    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [newItemTitle, setNewItemTitle] = useState('');
    const [isPendingExpanded, setIsPendingExpanded] = useState(false);
    const [isWaitingExpanded, setIsWaitingExpanded] = useState(false);
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, itemId: string } | null>(null);
    const [lastInteractedItemId, setLastInteractedItemId] = useState<string | null>(null);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

    const handleViewModeChange = (mode: 'stream' | 'panorama' | 'calendar') => {
        setViewMode(mode);
        const basePath = import.meta.env.BASE_URL || '/';
        const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
        const urlMap = { 'stream': 'Focus', 'panorama': 'Panorama', 'calendar': 'Calendar' };
        window.history.pushState({}, '', normalizedBase + urlMap[mode]);
    };

    const handleRefresh = async () => {
        await Promise.all([refreshDashboard(), refreshQueue()]);
    };

    // [NEW] Shortcuts (Ctrl+Z, Alt+D)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Undo: Ctrl+Z
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                undoItem();
            }
            // Detail: Alt+D
            if (e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                if (lastInteractedItemId) {
                    const all = [...inboxItems, ...pendingItems, ...waitingItems, ...(queueItems || [])];
                    const item = all.find(i => i.id === lastInteractedItemId);
                    if (item) setSelectedItem(item);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [undoItem, lastInteractedItemId, inboxItems, pendingItems, waitingItems, queueItems]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemTitle.trim()) return;

        if (activeProject?.cloudId) {
            await createSubTask(activeProject.cloudId, newItemTitle);
        } else {
            await createItem(newItemTitle);
        }

        setNewItemTitle('');
        handleRefresh();
    };

    const handleSetIntent = async (id: string, isIntent: boolean) => {
        await setIntent(id, isIntent);
        handleRefresh();
    };

    const handleComplete = async (id: string) => {
        await completeItem(id);
        handleRefresh();
    };

    const handleDropToInbox = async (id: string) => {
        await moveToInbox(id);
        handleRefresh();
    };

    const handleMoveToFocus = async (id: string) => {
        await legacyMoveToFocus(id);
        handleRefresh();
    }

    const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, itemId });
        setLastInteractedItemId(itemId);
    };

    const [isInitialLoad, setIsInitialLoad] = useState(true);
    useEffect(() => {
        if (!isDashboardLoading && !isQueueLoading && isInitialLoad) {
            setIsInitialLoad(false);
        }
    }, [isDashboardLoading, isQueueLoading, isInitialLoad]);

    if ((isDashboardLoading || isQueueLoading) && isInitialLoad) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">JBWOSを読み込み中...</div>;
    }

    const activeFocusItem = queueItems.length > 0 ? queueItems[0] : null;
    const remainingQueue = queueItems.slice(1);
    const allItemsForCalendar = [...queueItems, ...inboxItems, ...pendingItems, ...waitingItems];

    // [Soft Recommend Logic]
    const remainingCapacity = Math.max(0, capacityLimit - capacityUsed);
    const recommendedItems = inboxItems
        .filter(item => {
            // Highly recommended if:
            // 1. Due today or overdue
            // 2. Fits in remaining capacity
            if (!item.estimatedMinutes) return false;
            if (item.estimatedMinutes > remainingCapacity) return false;

            if (item.due_date) {
                const due = new Date(item.due_date);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (due <= today) return true;
            }

            // Otherwise, recommend if fits and we have significant capacity
            return remainingCapacity > 120; // Recommend if more than 2h left
        })
        .slice(0, 3); // Max top 3 recommendations

    const recommendedIds = new Set(recommendedItems.map(i => i.id));

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-x-hidden" onClick={() => setContextMenu(null)}>
            {viewMode === 'panorama' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <header className="flex-none bg-white border-b border-slate-200 px-4 py-2 flex justify-between items-center shadow-sm z-10">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => handleViewModeChange('stream')} className="px-3 py-1.5 text-xs font-medium text-slate-500 rounded-md hover:bg-white/50 transition-all">Focus</button>
                            <button onClick={() => handleViewModeChange('panorama')} className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white shadow-sm rounded-md transition-all">Panorama</button>
                            <button onClick={() => handleViewModeChange('calendar')} className="px-3 py-1.5 text-xs font-medium text-slate-500 rounded-md hover:bg-white/50 transition-all">Calendar</button>
                        </div>
                        {activeProject && (
                            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 animate-in fade-in slide-in-from-right-4">
                                <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">Project Dash</span>
                                <span className="text-xs font-bold">{activeProject.name}</span>
                            </div>
                        )}
                    </header>
                    <JbwosBoard
                        initialLayoutMode="panorama"
                        onClose={() => handleViewModeChange('stream')}
                        projectId={activeProject?.cloudId}
                    />
                </div>
            ) : viewMode === 'calendar' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <header className="flex-none bg-white border-b border-slate-200 px-4 py-2 flex justify-between items-center shadow-sm z-10">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => handleViewModeChange('stream')} className="px-3 py-1.5 text-xs font-medium text-slate-500 rounded-md hover:bg-white/50 transition-all">Focus</button>
                            <button onClick={() => handleViewModeChange('panorama')} className="px-3 py-1.5 text-xs font-medium text-slate-500 rounded-md hover:bg-white/50 transition-all">Panorama</button>
                            <button onClick={() => handleViewModeChange('calendar')} className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white shadow-sm rounded-md transition-all">Calendar</button>
                        </div>
                    </header>
                    <div className="flex-1 overflow-hidden">
                        <QuantityCalendar items={allItemsForCalendar} onItemClick={setSelectedItem} capacityConfig={DEFAULT_CAPACITY_CONFIG} onToggleHoliday={() => { }} />
                    </div>
                </div>
            ) : (
                <>
                    <HeaderProgressBar
                        usedMinutes={capacityUsed}
                        limitMinutes={capacityLimit}
                    />
                    <div className="flex-1 overflow-y-auto pb-20">
                        {contextMenu && (
                            <ContextMenu
                                x={contextMenu.x}
                                y={contextMenu.y}
                                itemId={contextMenu.itemId}
                                onClose={() => setContextMenu(null)}
                                actions={[
                                    { label: 'プロジェクト化', icon: <FolderPlus size={14} />, onClick: async () => { await updateItem(contextMenu.itemId, { isProject: true }); handleRefresh(); } },
                                    { label: '削除', danger: true, icon: <Trash2 size={14} />, onClick: async () => { if (confirm('本当に削除しますか?')) { await deleteItem(contextMenu.itemId); handleRefresh(); } } }
                                ]}
                            />
                        )}

                        <div className="bg-gradient-to-b from-indigo-50 to-white pb-6 pt-6 px-4 md:px-6 rounded-b-[2.5rem] shadow-sm mb-8 transition-all relative">
                            {activeProject && (
                                <div className="absolute top-0 left-0 right-0 py-2 bg-indigo-600 text-white text-[10px] font-bold text-center uppercase tracking-widest rounded-t-none">
                                    Project EXECUTION Mode: {activeProject.name}
                                </div>
                            )}
                            <div className="max-w-3xl mx-auto pt-4">
                                <header className="mb-6 flex justify-between items-center">
                                    <div className="flex bg-slate-200/60 p-1 rounded-lg">
                                        <button onClick={() => handleViewModeChange('stream')} className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white shadow-sm rounded-md transition-all">Focus</button>
                                        <button onClick={() => handleViewModeChange('panorama')} className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:bg-white/50 hover:text-slate-600 rounded-md transition-all">Panorama</button>
                                        <button onClick={() => handleViewModeChange('calendar')} className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:bg-white/50 hover:text-slate-600 rounded-md transition-all">Calendar</button>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setIsProjectModalOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1 transition-colors">
                                            <Plus size={14} strokeWidth={3} />プロジェクト
                                        </button>
                                        <button className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-md transition-colors"><List size={18} /></button>
                                    </div>
                                </header>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                    <ManufacturingLoadWidget />
                                </div>

                                <div className="mb-2">
                                    {activeFocusItem ? (
                                        <FocusCard item={activeFocusItem} onSetIntent={handleSetIntent} onComplete={handleComplete} onDrop={handleDropToInbox} onClick={() => setSelectedItem(activeFocusItem)} />
                                    ) : (
                                        <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-4"><BarChart2 size={24} /></div>
                                            <h3 className="text-lg font-medium text-slate-600">現在タスク無し</h3>
                                        </div>
                                    )}
                                </div>

                                {remainingQueue.length > 0 && (
                                    <div className="mb-2 pl-4 border-l-2 border-indigo-100/50 ml-4 pb-1">
                                        <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1 pl-2">次に控えているタスク</h3>
                                        <div className="flex flex-col">
                                            {remainingQueue.map((item, index) => (
                                                <SmartItemRow key={item.id} item={item} index={index + 1} onClick={() => setSelectedItem(item)} onFocus={handleSetIntent} onContextMenu={handleContextMenu} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="max-w-3xl mx-auto px-4 md:px-6">
                            <div className="flex items-center justify-between mb-1">
                                <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">受信箱 (Inbox)</h2>
                                <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-mono">{inboxItems.length}</span>
                            </div>

                            <form onSubmit={handleCreate} className="mb-0 relative">
                                <input type="text" value={newItemTitle} onChange={(e) => setNewItemTitle(e.target.value)} placeholder="思いついたことを入力..." className="w-full pl-2 pr-10 py-1 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all text-sm" />
                                <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors" disabled={!newItemTitle.trim()}><Plus size={16} /></button>
                            </form>

                            <div className="flex flex-col mb-12">
                                {inboxItems.map(item => (
                                    <SmartItemRow
                                        key={item.id}
                                        item={item}
                                        onFocus={handleMoveToFocus}
                                        onClick={() => setSelectedItem(item)}
                                        onContextMenu={handleContextMenu}
                                        isRecommended={recommendedIds.has(item.id)}
                                    />
                                ))}
                            </div>

                            <SectionHeader title="待機中 (Waiting)" count={waitingItems.length} expanded={isWaitingExpanded} onToggle={() => setIsWaitingExpanded(!isWaitingExpanded)} icon={<Users size={14} />} />
                            {isWaitingExpanded && <div className="flex flex-col">{waitingItems.map(item => <SmartItemRow key={item.id} item={item} onFocus={handleMoveToFocus} onClick={() => setSelectedItem(item)} onContextMenu={handleContextMenu} />)}</div>}

                            <SectionHeader title="保留 (Pending)" count={pendingItems.length} expanded={isPendingExpanded} onToggle={() => setIsPendingExpanded(!isPendingExpanded)} icon={<Clock size={14} />} />
                            {isPendingExpanded && <div className="flex flex-col">{pendingItems.map(item => <SmartItemRow key={item.id} item={item} onFocus={handleMoveToFocus} onClick={() => setSelectedItem(item)} onContextMenu={handleContextMenu} />)}</div>}
                        </div>

                        {selectedItem && (
                            <DecisionDetailModal
                                item={selectedItem}
                                onClose={() => { setSelectedItem(null); handleRefresh(); }}
                                onDecision={async (id, decision, note, updates) => {
                                    let newStatus: Item['status'] = 'inbox';
                                    if (decision === 'yes') newStatus = 'focus';
                                    else if (decision === 'hold') newStatus = 'pending';
                                    else if (decision === 'no') newStatus = 'done';
                                    await updateItem(id, { ...updates, status: newStatus, memo: note }); setSelectedItem(null); handleRefresh();
                                }}
                                onDelete={async (id) => { if (confirm('本当に削除しますか?')) { await deleteItem(id); setSelectedItem(null); handleRefresh(); } }}
                                onUpdate={async (id, updates) => { await updateItem(id, updates); }}
                                onCreateSubTask={createSubTask}
                                onGetSubTasks={getSubTasks}
                            />
                        )}

                        <SideMemoWidget />
                        <ProjectCreationDialog isOpen={isProjectModalOpen} onClose={() => setIsProjectModalOpen(false)} onCreate={async (project, tasks) => { await createProject(project, tasks); setIsProjectModalOpen(false); }} />
                    </div>
                </>
            )}
        </div>
    );
};
