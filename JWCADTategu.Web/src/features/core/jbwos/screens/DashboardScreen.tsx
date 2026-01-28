import React, { useState, useEffect } from 'react';
import { format } from 'date-fns'; // [NEW] For date formatting
import { useDashboardViewModel } from '../viewmodels/useDashboardViewModel';
import { useFocusQueue } from '../../../../hooks/useFocusQueue'; // [NEW] Logic Hook
import { Item } from '../types';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';
import { ProjectCreationDialog } from '../components/Modal/ProjectCreationDialog'; // [NEW]
import { ContextMenu } from '../components/GlobalBoard/ContextMenu'; // [NEW]
import { Clock, Users, ChevronDown, ChevronRight, Plus, BarChart2, FolderPlus, Trash2, List } from 'lucide-react';
import { FocusCard } from '../components/Dashboard/FocusCard';
import { DayProgressBar } from '../components/Dashboard/DayProgressBar';
import { SideMemoWidget } from '../components/SideMemo/SideMemoWidget';
import { JbwosBoard } from '../components/GlobalBoard/GlobalBoard'; // [NEW] Import Panorama Board
import { QuantityCalendar } from '../components/Calendar/QuantityCalendar'; // [NEW] Calendar
import { DEFAULT_CAPACITY_CONFIG } from '../logic/volumeCalculator'; // [NEW] For Calendar Config

// --- Sub-components ---

// [NEW] Status Badge Component
const StatusBadge = ({ status, isIntent }: { status: string, isIntent?: boolean }) => {
    if (status === 'inbox') return <span className="bg-orange-100 text-orange-600 text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">受信</span>;
    if (status === 'pending') return <span className="bg-slate-100 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">保留</span>;
    if (status === 'waiting') return <span className="bg-purple-100 text-purple-600 text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">待機</span>;
    if (status === 'focus') {
        return isIntent
            ? <span className="bg-indigo-100 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">今日</span>
            : <span className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">Focus</span>;
    }
    return <span className="bg-gray-100 text-gray-500 text-[10px] px-1.5 py-0.5 rounded font-bold whitespace-nowrap">{status}</span>;
};

const SimpleItemRow = ({ item, onFocus, onClick, onContextMenu, index }: { item: Item, onFocus: (id: string, isIntent: boolean) => void, onClick: () => void, onContextMenu?: (e: React.MouseEvent, itemId: string) => void, index?: number }) => (
    <div
        onClick={onClick}
        onContextMenu={(e) => {
            if (onContextMenu) {
                e.preventDefault(); // Prevent native menu
                onContextMenu(e, item.id);
            }
        }}
        className="flex items-center gap-2 p-2 bg-white border border-slate-100 rounded mb-1 hover:border-slate-300 transition-colors group cursor-pointer h-10 w-full overflow-hidden select-none"
    >
        {index !== undefined && (
            <span className="text-[10px] font-mono text-slate-300 w-3 text-right flex-shrink-0">{index + 1}</span>
        )}

        {/* [NEW] Text Badge instead of Dot */}
        <StatusBadge status={item.status} isIntent={item.isIntent} />

        {/* Main Content: Single Line Flex */}
        <div className="flex-1 flex items-center min-w-0 gap-2">
            {/* Task Title (Flex-1 to take available space) */}
            <div className="text-sm font-medium text-slate-700 truncate min-w-0" title={item.title}>
                {item.title}
            </div>

            {/* [NEW] Project Title (Inline, Constrained to approx 4 chars) */}
            {item.projectTitle && (
                <div className="text-[10px] text-slate-400 flex-shrink-0 max-w-[5em] truncate flex items-center gap-0.5" title={item.projectTitle}>
                    <span className="text-indigo-300">↳</span>
                    {item.projectTitle}
                </div>
            )}

            {/* Meta Info */}
            <div className="flex items-center gap-2 ml-auto flex-shrink-0 text-xs text-slate-400">
                {item.tenantName && !item.tenantId?.startsWith('p_') && ( // Hide 'personal' tenant if needed, currently showing all valid
                    <span className="hidden sm:inline-block max-w-[80px] truncate">🏢 {item.tenantName}</span>
                )}

                {/* [NEW] Deadlines */}
                <div className="flex flex-col items-end text-[10px] leading-tight">
                    {item.due_date && (
                        <span className="text-red-400 font-medium" title="納期">
                            納期: {format(new Date(item.due_date), 'M/d')}
                        </span>
                    )}
                    {item.prep_date && (
                        <span className="text-indigo-400" title="My期限">
                            My: {format(new Date(item.prep_date * 1000), 'M/d')}
                        </span>
                    )}
                </div>

                {item.estimatedMinutes && item.estimatedMinutes > 0 && <span className="font-mono">⏱️{item.estimatedMinutes}m</span>}
            </div>
        </div>

        {/* Hover Action (Focus) */}
        <button
            onClick={(e) => { e.stopPropagation(); onFocus(item.id, true); }}
            className="opacity-0 group-hover:opacity-100 flex-shrink-0 text-[10px] bg-indigo-50 text-indigo-600 px-2 py-1 rounded hover:bg-indigo-100 transition-all font-medium whitespace-nowrap"
        >
            今日やる
        </button>
    </div>
);

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

export const DashboardScreen = () => {
    // [NEW] View Mode State
    const [viewMode, setViewMode] = useState<'stream' | 'panorama' | 'calendar'>(() => {
        if (window.location.pathname.toLowerCase().includes('panorama')) return 'panorama';
        if (window.location.pathname.toLowerCase().includes('calendar')) return 'calendar';
        const saved = localStorage.getItem('jbwos_view_mode');
        return (saved === 'panorama' || saved === 'stream' || saved === 'calendar') ? saved : 'stream';
    });

    useEffect(() => {
        localStorage.setItem('jbwos_view_mode', viewMode);
    }, [viewMode]);

    // [NEW] Listen for global dashboard reset event (from App.tsx header navigation)
    useEffect(() => {
        const handleReset = () => {
            setViewMode('stream');
            // Ensure URL is synced if needed, but App.tsx handles the pushState
        };
        window.addEventListener('dashboard-reset', handleReset);
        return () => window.removeEventListener('dashboard-reset', handleReset);
    }, []);

    // ... (Existing VM Hooks) ...
    const {
        inboxItems, pendingItems, waitingItems,
        isLoading: isDashboardLoading,
        moveToFocus: legacyMoveToFocus, moveToInbox, completeItem, createItem, refresh: refreshDashboard, updateItem, deleteItem,
        createProject, // [NEW]
        createSubTask, getSubTasks // [NEW] Subtask Support
    } = useDashboardViewModel();

    const {
        items: queueItems,
        loading: isQueueLoading,
        capacityUsed,
        capacityLimit,
        setIntent,
        refresh: refreshQueue
    } = useFocusQueue();

    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [newItemTitle, setNewItemTitle] = useState('');
    const [isPendingExpanded, setIsPendingExpanded] = useState(false);
    const [isWaitingExpanded, setIsWaitingExpanded] = useState(false);

    // [NEW] Context Menu State
    const [contextMenu, setContextMenu] = useState<{ x: number, y: number, itemId: string } | null>(null);
    const [lastInteractedItemId, setLastInteractedItemId] = useState<string | null>(null);

    // [NEW] Project Creation Modal State
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

    // [NEW] URL Sync Helper - Uses Vite base path for production compatibility
    const handleViewModeChange = (mode: 'stream' | 'panorama' | 'calendar') => {
        setViewMode(mode);
        // Get base path from Vite config (e.g., './' or '/contents/TateguDesignStudio/')
        const basePath = import.meta.env.BASE_URL || '/';
        // Normalize: ensure ends with / and construct full path
        const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
        const urlMap = {
            'stream': 'Focus',
            'panorama': 'Panorama',
            'calendar': 'Calendar'
        };
        // Update URL without reloading
        window.history.pushState({}, '', normalizedBase + urlMap[mode]);
    };

    const handleRefresh = async () => {
        await Promise.all([refreshDashboard(), refreshQueue()]);
    };

    // [NEW] Alt+D Shortcut
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && (e.key === 'd' || e.key === 'D')) {
                e.preventDefault();
                if (lastInteractedItemId) {
                    const found = [...queueItems, ...inboxItems, ...pendingItems, ...waitingItems].find(i => i.id === lastInteractedItemId);
                    if (found) setSelectedItem(found);
                } else if (inboxItems.length > 0) {
                    // Fallback: newest inbox item
                    setSelectedItem(inboxItems[0]);
                }
            }
            // [NEW] Del Key Support for Context Menu logic? 
            // Better implemented via generic keyboard handler if an item is "selected" or "hovered".
            // For now, let's rely on Context Menu actions.
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lastInteractedItemId, queueItems, inboxItems, pendingItems, waitingItems]);

    // Track interaction
    const trackInteraction = (id: string) => {
        setLastInteractedItemId(id);
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItemTitle.trim()) return;
        await createItem(newItemTitle);
        // if (newItem) trackInteraction(newItem.id); // createItem returns void in current VM, skipping track
        setNewItemTitle('');
        handleRefresh();
    };

    const handleSetIntent = async (id: string, isIntent: boolean) => {
        await setIntent(id, isIntent);
        trackInteraction(id);
        handleRefresh();
    };

    const handleComplete = async (id: string) => {
        await completeItem(id);
        handleRefresh();
    };

    const handleDropToInbox = async (id: string) => {
        await moveToInbox(id);
        trackInteraction(id);
        handleRefresh();
    };

    const handleMoveToFocus = async (id: string) => {
        await legacyMoveToFocus(id);
        trackInteraction(id);
        handleRefresh();
    }

    // Context Menu Actions
    const handleContextMenu = (e: React.MouseEvent, itemId: string) => {
        e.preventDefault();
        setContextMenu({ x: e.clientX, y: e.clientY, itemId });
        trackInteraction(itemId);
    };

    const handleCloseContextMenu = () => {
        setContextMenu(null);
    };

    // [REMOVED] Early returns for panorama and calendar moved to conditional rendering in main return

    // Combine all items for calendar view
    const allItemsForCalendar = [...queueItems, ...inboxItems, ...pendingItems, ...waitingItems];

    // [NEW] Prevent flickering on background refresh
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    // Initial Load Effect
    useEffect(() => {
        if (!isDashboardLoading && !isQueueLoading && isInitialLoad) {
            setIsInitialLoad(false);
        }
    }, [isDashboardLoading, isQueueLoading]);

    if ((isDashboardLoading || isQueueLoading) && isInitialLoad) {
        return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-400">JBWOSを読み込み中...</div>;
    }

    const activeFocusItem = queueItems.length > 0 ? queueItems[0] : null;
    const remainingQueue = queueItems.slice(1);

    return (
        <div className="h-screen flex flex-col bg-slate-50 overflow-hidden" onClick={handleCloseContextMenu}>
            {/* Conditional View Rendering */}
            {viewMode === 'panorama' ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <header className="flex-none bg-white border-b border-slate-200 px-4 py-2 flex justify-between items-center shadow-sm z-10">
                        <div className="flex bg-slate-100 p-1 rounded-lg">
                            <button onClick={() => handleViewModeChange('stream')} className="px-3 py-1.5 text-xs font-medium text-slate-500 rounded-md hover:bg-white/50 transition-all">Focus</button>
                            <button onClick={() => handleViewModeChange('panorama')} className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white shadow-sm rounded-md transition-all">Panorama</button>
                            <button onClick={() => handleViewModeChange('calendar')} className="px-3 py-1.5 text-xs font-medium text-slate-500 rounded-md hover:bg-white/50 transition-all">Calendar</button>
                        </div>
                    </header>
                    <JbwosBoard
                        initialLayoutMode="panorama"
                        onClose={() => handleViewModeChange('stream')}
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
                        <QuantityCalendar
                            items={allItemsForCalendar}
                            onItemClick={(item) => { setSelectedItem(item); trackInteraction(item.id); }}
                            capacityConfig={DEFAULT_CAPACITY_CONFIG}
                            onToggleHoliday={() => { }}
                        />
                    </div>
                </div>
            ) : (
                /* Stream/Focus View - Default */
                <div className="flex-1 overflow-y-auto pb-20">
                    {/* Context Menu Overlay */}
                    {contextMenu && (
                        <ContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            itemId={contextMenu.itemId}
                            onClose={handleCloseContextMenu}
                            actions={[
                                {
                                    label: 'プロジェクト化...',
                                    icon: <FolderPlus size={14} />,
                                    onClick: () => {
                                        const item = [...queueItems, ...inboxItems, ...pendingItems, ...waitingItems].find(i => i.id === contextMenu.itemId);
                                        if (item) setSelectedItem(item); // Open Detail to Projectize
                                    }
                                },
                                {
                                    label: '削除',
                                    danger: true,
                                    icon: <Trash2 size={14} />,
                                    onClick: async () => {
                                        if (confirm('本当に削除しますか?')) {
                                            await deleteItem(contextMenu.itemId);
                                            handleRefresh();
                                        }
                                    }
                                }
                            ]}
                        />
                    )}

                    {/* Header / Judgment Zone */}
                    <div className="bg-gradient-to-b from-indigo-50 to-white pb-6 pt-6 px-4 md:px-6 rounded-b-[2.5rem] shadow-sm mb-8 transition-all relative">
                        <div className="max-w-3xl mx-auto">
                            <header className="mb-6 flex justify-between items-center">
                                {/* Segmented Control */}
                                <div className="flex bg-slate-200/60 p-1 rounded-lg">
                                    <button
                                        onClick={() => handleViewModeChange('stream')}
                                        className="px-4 py-1.5 text-xs font-bold text-slate-700 bg-white shadow-sm rounded-md transition-all"
                                    >
                                        Focus
                                    </button>
                                    <button
                                        onClick={() => handleViewModeChange('panorama')}
                                        className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:bg-white/50 hover:text-slate-600 rounded-md transition-all"
                                    >
                                        Panorama
                                    </button>
                                    <button
                                        onClick={() => handleViewModeChange('calendar')}
                                        className="px-4 py-1.5 text-xs font-medium text-slate-500 hover:bg-white/50 hover:text-slate-600 rounded-md transition-all"
                                    >
                                        Calendar
                                    </button>
                                </div>

                                {/* Right Actions */}
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={() => setIsProjectModalOpen(true)}
                                        className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1 transition-colors"
                                    >
                                        <Plus size={14} strokeWidth={3} />
                                        プロジェクト
                                    </button>

                                    {/* SideMemo Toggle or Log Book could go here */}
                                    <button className="text-slate-400 hover:text-slate-600 p-1.5 hover:bg-slate-100 rounded-md transition-colors">
                                        <List size={18} />
                                    </button>
                                </div>
                            </header>

                            {/* Capacity Viz (Moved below header) */}
                            <div className="flex justify-end mb-4">
                                <div className="w-1/3 min-w-[120px]">
                                    <DayProgressBar usedMinutes={capacityUsed} limitMinutes={capacityLimit} />
                                </div>
                            </div>

                            {/* Active Focus Card */}
                            <div className="mb-2">
                                {activeFocusItem ? (
                                    <FocusCard
                                        item={activeFocusItem}
                                        onSetIntent={handleSetIntent}
                                        onComplete={handleComplete}
                                        onDrop={handleDropToInbox}
                                        onClick={() => { setSelectedItem(activeFocusItem); trackInteraction(activeFocusItem.id); }}
                                    />
                                ) : (
                                    <div className="py-16 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 text-slate-400 mb-4">
                                            <BarChart2 size={24} />
                                        </div>
                                        <h3 className="text-lg font-medium text-slate-600">現在タスク無し</h3>
                                        <p className="text-sm text-slate-400 mt-2 max-w-xs mx-auto">
                                            判断キャパシティに余裕があります。<br />下の受信箱からタスクを選んでください。
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Remaining Queue (Next Up) */}
                            {remainingQueue.length > 0 && (
                                <div className="mb-2 pl-4 border-l-2 border-indigo-100/50 ml-4 pb-1">
                                    <h3 className="text-xs font-bold text-indigo-300 uppercase tracking-widest mb-1 pl-2">次に控えているタスク</h3>
                                    <div className="space-y-0.5">
                                        {remainingQueue.map((item, index) => (
                                            <SimpleItemRow
                                                key={item.id}
                                                item={item}
                                                index={index + 1}
                                                onClick={() => { setSelectedItem(item); trackInteraction(item.id); }}
                                                onFocus={handleSetIntent}
                                                onContextMenu={handleContextMenu}
                                            />
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Panorama View: Inbox & Staged */}
                    <div className="max-w-3xl mx-auto px-4 md:px-6">
                        <div className="flex items-center justify-between mb-1">
                            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-widest">受信箱 (Inbox)</h2>
                            <span className="bg-slate-100 text-slate-500 text-xs px-2 py-0.5 rounded-full font-mono">{inboxItems.length}</span>
                        </div>

                        {/* Quick Add */}
                        <form onSubmit={handleCreate} className="mb-0 relative">
                            <input
                                type="text"
                                value={newItemTitle}
                                onChange={(e) => setNewItemTitle(e.target.value)}
                                placeholder="思いついたことを入力..."
                                className="w-full pl-2 pr-10 py-1 bg-white border border-slate-200 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 transition-all text-sm"
                            />
                            <button
                                type="submit"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 disabled:opacity-50 transition-colors"
                                disabled={!newItemTitle.trim()}
                            >
                                <Plus size={16} />
                            </button>
                        </form>

                        {/* Inbox List */}
                        <div className="space-y-0.5 mb-12">
                            {inboxItems.length === 0 ? (
                                <p className="text-sm text-slate-400 italic text-center py-4">受信箱は空です。</p>
                            ) : (
                                inboxItems.map(item => (
                                    <SimpleItemRow
                                        key={item.id}
                                        item={item}
                                        onFocus={handleMoveToFocus}
                                        onClick={() => { setSelectedItem(item); trackInteraction(item.id); }}
                                        onContextMenu={handleContextMenu}
                                    />
                                ))
                            )}
                        </div>

                        {/* Collapsible Sections */}
                        <SectionHeader
                            title="待機中 (Waiting)"
                            count={waitingItems.length}
                            expanded={isWaitingExpanded}
                            onToggle={() => setIsWaitingExpanded(!isWaitingExpanded)}
                            icon={<Users size={14} />}
                        />
                        {isWaitingExpanded && (
                            <div className="space-y-1 mb-8 opacity-75">
                                {waitingItems.map(item => (
                                    <SimpleItemRow
                                        key={item.id}
                                        item={item}
                                        onFocus={handleMoveToFocus}
                                        onClick={() => { setSelectedItem(item); trackInteraction(item.id); }}
                                        onContextMenu={handleContextMenu}
                                    />
                                ))}
                            </div>
                        )}

                        <SectionHeader
                            title="保留 (Pending)"
                            count={pendingItems.length}
                            expanded={isPendingExpanded}
                            onToggle={() => setIsPendingExpanded(!isPendingExpanded)}
                            icon={<Clock size={14} />}
                        />
                        {isPendingExpanded && (
                            <div className="space-y-1 mb-20 opacity-75">
                                {pendingItems.map(item => (
                                    <SimpleItemRow
                                        key={item.id}
                                        item={item}
                                        onFocus={handleMoveToFocus}
                                        onClick={() => { setSelectedItem(item); trackInteraction(item.id); }}
                                        onContextMenu={handleContextMenu}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Detail Modal (Shared) */}
                    {selectedItem && (
                        <DecisionDetailModal
                            item={selectedItem}
                            onClose={() => { setSelectedItem(null); handleRefresh(); }}
                            onDecision={async (id, decision, note, updates) => {
                                let newStatus: Item['status'] = 'inbox';
                                if (decision === 'yes') newStatus = 'focus';
                                else if (decision === 'hold') newStatus = 'pending';
                                else if (decision === 'no') newStatus = 'done';

                                const finalUpdates: any = { ...updates, status: newStatus };
                                if (note) finalUpdates.memo = note;
                                if (decision === 'yes') {
                                    finalUpdates.isIntent = true;
                                    finalUpdates.dueStatus = 'today';
                                }

                                await updateItem(id, finalUpdates);
                                setSelectedItem(null);
                                handleRefresh();
                            }}
                            onDelete={async (id) => {
                                if (confirm('本当に削除しますか?')) {
                                    await deleteItem(id);
                                    setSelectedItem(null);
                                    handleRefresh();
                                }
                            }}
                            onUpdate={async (id, updates) => {
                                await updateItem(id, updates);
                            }}
                            onCreateSubTask={createSubTask} // [NEW]
                            onGetSubTasks={getSubTasks} // [NEW]
                        />
                    )}

                    <SideMemoWidget />

                    {/* Project Creation Dialog */}
                    <ProjectCreationDialog
                        isOpen={isProjectModalOpen}
                        onClose={() => setIsProjectModalOpen(false)}
                        onCreate={async (project, defaultTasks) => {
                            await createProject(project, defaultTasks);
                            setIsProjectModalOpen(false);
                            // Add toast?
                        }}
                    />
                </div>
            )}
        </div>
    );
};
