import React, { useState, useEffect } from 'react';
import { Item } from '../types';
import { Project as LocalProject } from '../../../../db/db';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';
import { ProjectCreationDialog } from '../components/Modal/ProjectCreationDialog';
import {
    Plus, ChevronRight, ChevronDown, Clock, Trash2,
    Briefcase, BarChart2, Users, X
} from 'lucide-react';
import { ContextMenu } from '../components/GlobalBoard/ContextMenu';
import { FocusCard } from '../components/Dashboard/FocusCard';
import { HeaderProgressBar } from '../components/Dashboard/HeaderProgressBar';
import { SmartItemRow } from '../components/Dashboard/SmartItemRow';
import { SideMemoWidget } from '../components/SideMemo/SideMemoWidget';
import { JbwosBoard } from '../components/GlobalBoard/GlobalBoard';
import { QuickInputWidget } from '../components/Inputs/QuickInputWidget';
import { RyokanCalendar } from '../components/Calendar/RyokanCalendar';
import { useJBWOSViewModel } from '../viewmodels/useJBWOSViewModel';
import { ManufacturingLoadWidget } from '../../../plugins/manufacturing/components/ManufacturingLoadWidget';
import { useAuth } from '../../auth/providers/AuthProvider';
import { NewspaperBoard } from '../components/NewspaperBoard/NewspaperBoard';
import { useItemContextMenu } from '../hooks/useItemContextMenu';

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
    const [viewMode, setViewMode] = useState<'stream' | 'panorama' | 'calendar' | 'newspaper'>(() => {
        const path = window.location.pathname.toLowerCase();
        if (path.includes('panorama')) return 'panorama';
        if (path.includes('calendar')) return 'calendar';
        if (path.includes('newspaper')) return 'newspaper';
        const saved = localStorage.getItem('jbwos_view_mode');
        return (saved === 'panorama' || saved === 'stream' || saved === 'calendar' || saved === 'newspaper') ? saved : 'stream';
    });

    useEffect(() => {
        localStorage.setItem('jbwos_view_mode', viewMode);
    }, [viewMode]);

    const vm = useJBWOSViewModel(activeProject?.cloudId || (activeProject?.id ? String(activeProject.id) : undefined));

    const {
        gdbActive: inboxItems,
        gdbIntent: pendingItems,
        gdbPreparation: waitingItems,
        todayCandidates,
        todayCommits,
        capacityUsed,
        capacityLimit,
        filterMode,
        setFilterMode,
        ghostGdbCount,
        ghostTodayCount,
        executionItem,
        refreshAll: handleRefresh,
        updateItem,
        deleteItem,
        completeItem,
        createProject,
        createSubTask,
        getSubTasks,
        skipTask,
        setEngaged
    } = vm;

    const { joinedTenants } = useAuth();

    const [ganttRowHeight, setGanttRowHeight] = useState<number>(() => {
        const saved = localStorage.getItem('jbwos_gantt_row_height');
        return saved ? parseInt(saved, 10) : 12;
    });

    useEffect(() => {
        localStorage.setItem('jbwos_gantt_row_height', ganttRowHeight.toString());
    }, [ganttRowHeight]);

    const queueItems = [
        ...(executionItem ? [executionItem] : []),
        ...todayCommits.filter(i => i.id !== executionItem?.id),
        ...todayCandidates.filter(i => i.id !== executionItem?.id)
    ];

    const [selectedItem, setSelectedItem] = useState<Item | null>(null);
    const [isPendingExpanded, setIsPendingExpanded] = useState(false);
    const [isWaitingExpanded, setIsWaitingExpanded] = useState(false);
    const { menuState: contextMenu, handleContextMenu, closeMenu, lastTargetId, setLastTargetId } = useItemContextMenu({
        onDelete: (id) => vm.deleteItem(id)
    });
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

    const handleViewModeChange = (mode: 'stream' | 'panorama' | 'calendar' | 'newspaper') => {
        setViewMode(mode);
        const basePath = import.meta.env.BASE_URL || '/';
        const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
        const urlMap = {
            'stream': '登録と集中',
            'panorama': '全体一覧',
            'calendar': 'カレンダー',
            'newspaper': '全体一覧２'
        };
        window.history.pushState({}, '', normalizedBase + urlMap[mode]);
    };

    const activeFocusItem = queueItems.length > 0 ? queueItems[0] : null;
    const remainingQueue = queueItems.slice(1);
    const allItemsForCalendar = [...queueItems, ...inboxItems, ...pendingItems, ...waitingItems];

    // Global Shortcuts Integration (ALT+D only, Delete is in hook)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.altKey && e.key.toLowerCase() === 'd') {
                if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
                e.preventDefault();
                const targetId = contextMenu?.targetId || lastTargetId || activeFocusItem?.id;
                if (targetId) {
                    const all = [...inboxItems, ...pendingItems, ...waitingItems, ...(queueItems || [])];
                    const item = all.find(i => i.id === targetId);
                    if (item) setSelectedItem(item);
                }
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [contextMenu, lastTargetId, activeFocusItem, inboxItems, pendingItems, waitingItems, queueItems]);

    const handleSetEngaged = async (id: string, isEngaged: boolean) => {
        await setEngaged(id, isEngaged);
        handleRefresh();
    };

    const handleComplete = async (id: string) => {
        await completeItem(id);
        handleRefresh();
    };

    const handleMoveToFocus = async (id: string) => {
        await updateItem(id, { status: 'focus' });
        handleRefresh();
    };

    // handleContextMenu moved to hook



    return (
        <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden relative">
            <HeaderProgressBar
                usedMinutes={capacityUsed}
                limitMinutes={capacityLimit}
                filterMode={filterMode}
                onFilterChange={setFilterMode}
                ghostCount={ghostGdbCount + ghostTodayCount}
                isProjectContext={!!activeProject}
            />

            <header className="flex-none bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-2 flex justify-between items-center shadow-sm z-10">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
                    <button onClick={() => handleViewModeChange('stream')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'stream' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-700 dark:text-white font-bold' : 'text-slate-500 hover:bg-white/50'}`}>登録と集中</button>
                    <button onClick={() => handleViewModeChange('panorama')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'panorama' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-700 dark:text-white font-bold' : 'text-slate-500 hover:bg-white/50'}`}>全体一覧</button>
                    <button onClick={() => handleViewModeChange('newspaper')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'newspaper' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-700 dark:text-white font-bold' : 'text-slate-500 hover:bg-white/50'}`}>全体一覧２</button>
                    <button onClick={() => handleViewModeChange('calendar')} className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'calendar' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-700 dark:text-white font-bold' : 'text-slate-500 hover:bg-white/50'}`}>カレンダー</button>
                </div>

                <div className="flex items-center gap-3">
                    {(viewMode === 'calendar' || viewMode === 'panorama') && (
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 bg-slate-100 dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 animate-in fade-in slide-in-from-right-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">密度</span>
                            <input
                                type="range"
                                min="12"
                                max="32"
                                value={ganttRowHeight}
                                onChange={(e) => setGanttRowHeight(parseInt(e.target.value))}
                                className="w-16 h-1 accent-blue-500 cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-slate-500 w-4">{ganttRowHeight}</span>
                        </div>
                    )}

                    {activeProject && (
                        <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-full border border-blue-100 dark:border-blue-800 shadow-sm animate-in fade-in slide-in-from-right-4 duration-500">
                            <Briefcase size={12} className="text-blue-500" />
                            <span className="text-[11px] font-bold text-blue-700 dark:text-blue-300">Project: {activeProject.title || activeProject.name}</span>
                            <button
                                onClick={() => {
                                    window.location.href = '/contents/TateguDesignStudio/';
                                }}
                                className="ml-1 p-0.5 hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full transition-colors"
                            >
                                <X size={12} className="text-blue-400" />
                            </button>
                        </div>
                    )}

                    <button onClick={() => setIsProjectModalOpen(true)} className="bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold px-3 py-1.5 rounded-md shadow-sm flex items-center gap-1 transition-colors">
                        <Plus size={14} strokeWidth={3} />プロジェクト
                    </button>
                </div>
            </header>

            {(viewMode === 'calendar' || viewMode === 'panorama' || viewMode === 'newspaper') ? (
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="flex-1 overflow-hidden">
                        {viewMode === 'calendar' ? (
                            <RyokanCalendar
                                items={allItemsForCalendar}
                                projects={allItemsForCalendar.filter(i => i.isProject)}
                                onItemClick={setSelectedItem}
                                filterMode={filterMode}
                                displayMode="timeline"
                                rowHeight={ganttRowHeight}
                            />
                        ) : viewMode === 'newspaper' ? (
                            <NewspaperBoard viewModel={vm} activeProject={activeProject} onOpenItem={setSelectedItem} />
                        ) : (
                            <JbwosBoard
                                initialLayoutMode="panorama"
                                onClose={() => handleViewModeChange('stream')}
                                projectId={activeProject?.cloudId}
                                rowHeight={ganttRowHeight}
                                hideHeader={true}
                            />
                        )}
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto pb-20">
                    <div className="bg-gradient-to-b from-indigo-50/50 to-white pb-6 pt-6 px-4 md:px-6 rounded-b-[2.5rem] shadow-sm mb-8 relative border-b border-indigo-100/30">
                        {activeProject && (
                            <div className="absolute top-0 left-0 right-0 py-1.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 text-white text-[9px] font-bold text-center uppercase tracking-[0.2em] rounded-t-none shadow-md overflow-hidden">
                                <span className="relative z-10">Project Dashboard Mode: {activeProject.title || activeProject.name}</span>
                                <div className="absolute inset-0 bg-white/10 animate-pulse" />
                            </div>
                        )}
                        <div className="max-w-3xl mx-auto pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                                <ManufacturingLoadWidget />
                            </div>

                            <div className="mb-2">
                                {activeFocusItem ? (
                                    <FocusCard
                                        item={(() => {
                                            // [Refinement] Enrich with Project/Tenant Info for Display
                                            const p = vm.allProjects.find(pro => pro.id === activeFocusItem.projectId);
                                            const t = vm.joinedTenants.find(ten => ten.id === activeFocusItem.tenantId || (p && ten.id === p.tenantId));
                                            return {
                                                ...activeFocusItem,
                                                projectTitle: activeFocusItem.projectTitle || p?.title,
                                                tenantName: activeFocusItem.tenantName || t?.name
                                            };
                                        })()}
                                        onSetEngaged={handleSetEngaged}
                                        onComplete={handleComplete}
                                        onDrop={async (id) => { await updateItem(id, { status: 'inbox' }); handleRefresh(); }}
                                        onSkip={async (id) => { await skipTask(id); }}
                                        onClick={() => { setSelectedItem(activeFocusItem); setLastTargetId(activeFocusItem.id); }}
                                        onContextMenu={handleContextMenu}
                                    />
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
                                            <SmartItemRow key={item.id} item={item} index={index + 1} onClick={() => { setSelectedItem(item); setLastTargetId(item.id); }} onFocus={handleSetEngaged} onContextMenu={handleContextMenu} />
                                        ))}
                                        {ghostTodayCount > 0 && (
                                            <div className="px-4 py-2 text-[10px] text-slate-300 font-mono italic">
                                                + {ghostTodayCount} hidden items
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="max-w-3xl mx-auto px-4 md:px-6">
                        <SectionHeader title="受信箱 (Inbox)" count={inboxItems.length} icon={<BarChart2 size={14} />} />

                        <QuickInputWidget
                            className="mb-4"
                            viewModel={vm}
                            projectContext={activeProject ? {
                                id: activeProject.cloudId || String(activeProject.id), // [UUID v7] Use cloudId (UUID) for backend
                                title: activeProject.title,
                                name: activeProject.name,
                                tenantId: activeProject.tenantId
                            } : null}
                            onOpenItem={(item) => setSelectedItem(item)}
                            onRequestFallbackOpen={() => {
                                const targetId = lastTargetId || activeFocusItem?.id;
                                if (targetId) {
                                    const all = [...inboxItems, ...pendingItems, ...waitingItems, ...(queueItems || [])];
                                    const item = all.find(i => i.id === targetId);
                                    if (item) setSelectedItem(item);
                                }
                            }}
                            placeholder={activeProject ? `${activeProject.title || activeProject.name} にタスクを追加...` : "思いついたことを入力..."}
                        />

                        <div className="flex flex-col mb-4">
                            {inboxItems.map(item => (
                                <SmartItemRow
                                    key={item.id}
                                    item={item}
                                    onFocus={(id) => handleSetEngaged(id, true)}
                                    onClick={() => { setSelectedItem(item); setLastTargetId(item.id); }}
                                    onContextMenu={handleContextMenu}
                                />
                            ))}
                        </div>

                        {ghostGdbCount > 0 && (
                            <div className="px-4 py-3 mb-12 text-center border-t border-slate-100 italic">
                                <span className="text-[10px] text-slate-300 font-mono">
                                    他方のリストに {ghostGdbCount} 件のタスクがあります
                                </span>
                            </div>
                        )}

                        <SectionHeader title="待機中 (Waiting)" count={waitingItems.length} expanded={isWaitingExpanded} onToggle={() => setIsWaitingExpanded(!isWaitingExpanded)} icon={<Users size={14} />} />
                        {isWaitingExpanded && <div className="flex flex-col">{waitingItems.map(item => <SmartItemRow key={item.id} item={item} onFocus={handleMoveToFocus} onClick={() => setSelectedItem(item)} onContextMenu={handleContextMenu} />)}</div>}

                        <SectionHeader title="保留 (Pending)" count={pendingItems.length} expanded={isPendingExpanded} onToggle={() => setIsPendingExpanded(!isPendingExpanded)} icon={<Clock size={14} />} />
                        {isPendingExpanded && <div className="flex flex-col">{pendingItems.map(item => <SmartItemRow key={item.id} item={item} onFocus={handleMoveToFocus} onClick={() => setSelectedItem(item)} onContextMenu={handleContextMenu} />)}</div>}
                    </div>

                    {contextMenu && (
                        <ContextMenu
                            x={contextMenu.x}
                            y={contextMenu.y}
                            itemId={contextMenu.targetId!}
                            onClose={closeMenu}
                            actions={[
                                {
                                    label: 'プロジェクト化',
                                    icon: <ChevronRight size={14} className="text-blue-500" />,
                                    onClick: () => { updateItem(contextMenu.targetId!, { isProject: true }); handleRefresh(); }
                                },
                                {
                                    label: '実行中 (Engage)',
                                    icon: <Clock size={14} className="text-amber-500" />,
                                    onClick: () => handleSetEngaged(contextMenu.targetId!, true)
                                },
                                {
                                    label: 'アーカイブ (History)',
                                    icon: <Briefcase size={14} className="text-slate-500" />,
                                    onClick: () => { vm.archiveItem(contextMenu.targetId!); handleRefresh(); }
                                },
                                {
                                    label: 'ゴミ箱 (Trash)',
                                    icon: <Trash2 size={14} className="text-red-500" />,
                                    danger: true,
                                    onClick: () => deleteItem(contextMenu.targetId!) // [FIX] Remove handleRefresh to preserve optimistic update
                                }
                            ]}
                        />
                    )}

                </div>
            )}

            {/* Global Modals - Available in ALL views */}
            <DecisionDetailModal
                item={selectedItem}
                onClose={() => setSelectedItem(null)}
                onDecision={async (id, decision, note, updates) => { await vm.resolveDecision(id, decision, note, updates); setSelectedItem(null); handleRefresh(); }}
                onDelete={async (id) => { await deleteItem(id); setSelectedItem(null); }} // [FIX] Remove handleRefresh to preserve optimistic update
                onUpdate={async (id, updates) => { await updateItem(id, updates); handleRefresh(); }}
                onCreateSubTask={createSubTask}
                onGetSubTasks={getSubTasks}
                members={vm.members}
                allProjects={vm.allProjects}
                joinedTenants={joinedTenants}
                onOpenItem={setSelectedItem}
            />

            <SideMemoWidget />

            <ProjectCreationDialog
                isOpen={isProjectModalOpen}
                onClose={() => setIsProjectModalOpen(false)}
                onCreate={async (project, tasks) => {
                    await createProject(project as any, tasks);
                    setIsProjectModalOpen(false);
                    handleRefresh();
                }}
                parentProject={activeProject as any}
                activeScope={(activeProject as any)?.tenantId ? 'company' : 'personal'}
                tenants={joinedTenants}
            />
        </div>
    );
};
