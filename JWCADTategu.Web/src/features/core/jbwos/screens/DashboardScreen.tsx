import React, { useState, useEffect } from 'react';
import { Item } from '../types';
import { Project as LocalProject } from '../../../../db/db';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';

import {
    ChevronRight, ChevronDown, Clock,
    BarChart2
} from 'lucide-react';
import { ContextMenu } from '../components/GlobalBoard/ContextMenu';
import { FocusCard } from '../components/Dashboard/FocusCard';
import { SmartItemRow } from '../components/Dashboard/SmartItemRow';
import { SideMemoWidget } from '../components/SideMemo/SideMemoWidget';
import { JbwosBoard } from '../components/GlobalBoard/GlobalBoard';
import { QuickInputWidget } from '../components/Inputs/QuickInputWidget';
import { useJBWOSViewModel } from '../viewmodels/useJBWOSViewModel';
import { useAuth } from '../../auth/providers/AuthProvider';
import { NewspaperBoard } from '../components/NewspaperBoard/NewspaperBoard';
import { useItemContextMenu } from '../hooks/useItemContextMenu';
import { VolumeCalendarGrid } from '../components/Layout/VolumeCalendarGrid';


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

    // Listen for header sub-navigation changes
    useEffect(() => {
        const handleViewModeChange = (e: CustomEvent<{ mode: string }>) => {
            const mode = e.detail?.mode;
            if (mode === 'stream' || mode === 'board' || mode === 'newspaper') {
                // Map 'board' to 'panorama' for internal state
                setViewMode(mode === 'board' ? 'panorama' : mode as any);
            }
        };
        window.addEventListener('jbwos-view-mode-change', handleViewModeChange as EventListener);
        return () => window.removeEventListener('jbwos-view-mode-change', handleViewModeChange as EventListener);
    }, []);


    const vm = useJBWOSViewModel(activeProject?.cloudId || (activeProject?.id ? String(activeProject.id) : undefined));

    const {
        gdbActive: inboxItems,
        gdbIntent: pendingItems,
        gdbPreparation: waitingItems,
        gdbLog: doneItems,
        todayCandidates,
        todayCommits,
        capacityUsed,
        capacityLimit,
        ghostGdbCount,
        executionItem,
        refreshAll: handleRefresh,
        updateItem,
        deleteItem,
        completeItem,
        createSubTask,
        getSubTasks,
        skipTask,
        setEngaged,
        allProjects
    } = vm;

    // Dispatch capacity updates to header (Must be after destructuring capacityUsed/limit)
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('jbwos-capacity-update', {
            detail: { used: capacityUsed, limit: capacityLimit }
        }));
    }, [capacityUsed, capacityLimit]);





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
    const { menuState: contextMenu, handleContextMenu, closeMenu, lastTargetId } = useItemContextMenu({
        onDelete: (id) => vm.deleteItem(id)
    });


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



    return (
        <div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden relative">
            {/* 密度調整等のコントロール (必要な場合のみ表示) */}
            {(viewMode === 'calendar' || viewMode === 'panorama') && (
                <div className="shrink-0 bg-white/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 px-6 py-1 flex items-center justify-end gap-2 z-10">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">密度</span>
                    <input
                        type="range"
                        min="12"
                        max="32"
                        value={ganttRowHeight}
                        onChange={(e) => setGanttRowHeight(parseInt(e.target.value))}
                        className="w-20 accent-indigo-600 h-1.5 cursor-pointer"
                    />
                    <span className="text-[10px] font-mono text-slate-500 w-4">{ganttRowHeight}</span>
                </div>
            )}

            {/* Dashboard Content */}
            <div className="flex-1 min-h-0 flex flex-col relative">
                {(viewMode === 'calendar' || viewMode === 'panorama' || viewMode === 'newspaper') ? (
                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex-1 overflow-hidden">
                            {viewMode === 'calendar' ? (
                                <div className="p-6 h-full overflow-hidden">
                                    <VolumeCalendarGrid
                                        tasks={allItemsForCalendar
                                            .filter(item => item.due_date) // 期限があるもののみ
                                            .map(item => ({
                                                id: item.id,
                                                title: item.title,
                                                projectId: item.projectId || 'personal',
                                                projectTitle: item.projectTitle || (item.tenantId ? item.tenantName || '会社' : '個人'),
                                                estimatedTime: (item.estimatedMinutes || 60) / 60,
                                                dueDate: item.due_date!,
                                                // prep_date があれば使用、なければ due_date
                                                myDueDate: (() => {
                                                    if (!item.prep_date) return item.due_date!;
                                                    const d = new Date(item.prep_date);
                                                    return !isNaN(d.getTime()) ? d.toISOString().split('T')[0] : item.due_date!;
                                                })(),
                                                contextId: item.tenantId || 'personal'
                                            }))}
                                        settings={{
                                            contexts: [
                                                {
                                                    contextId: 'personal',
                                                    weeklySchedule: [0, 4, 4, 4, 4, 4, 0] // 毎日4h (平日)
                                                },
                                                // 参加しているテナント（会社）のスケジュールを動的に構築
                                                ...joinedTenants.map((t, idx) => ({
                                                    contextId: t.id,
                                                    // 例: 会社A(月火4h)、会社B(水木金8h) のユーザー入力を反映
                                                    // ここでは簡易的に 偶数番目のテナントをA、奇数をBと見なす等のモック
                                                    weeklySchedule: idx % 2 === 0
                                                        ? [0, 4, 4, 0, 0, 0, 0] // 月火4h
                                                        : [0, 0, 0, 8, 8, 8, 0] // 水木金8h
                                                }))
                                            ],
                                            nothingDays: [],
                                            managementMode: 'Separation'
                                        }}
                                        onOpenItem={(id) => {
                                            console.log('[Dashboard] onOpenItem called with ID:', id, 'Type:', typeof id);
                                            const all = [...queueItems, ...inboxItems, ...pendingItems, ...waitingItems, ...doneItems, ...allProjects];
                                            console.log('[Dashboard] Total search pool size:', all.length);
                                            console.log('[Dashboard] Search pool sample (IDs):', all.slice(0, 10).map(i => i.id));

                                            const item = all.find(i => String(i.id) === String(id));
                                            if (item) {
                                                console.log('[Dashboard] SUCCESS: Found item in pool:', item.title, 'ID Match:', item.id);
                                                setSelectedItem(item);
                                            } else {
                                                console.error('[Dashboard] FAILURE: Item NOT FOUND in search pool. Item ID to find:', id);
                                                console.log('[Dashboard] First 50 IDs in pool:', all.map(i => i.id).slice(0, 50));
                                            }
                                        }}
                                    />
                                </div>
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
                        {/* Immersive Dashboard Header (Stream view only) */}
                        <div className="bg-gradient-to-b from-indigo-50/50 to-white pb-6 pt-8 px-4 md:px-6 rounded-b-[2.5rem] shadow-sm mb-8 relative border-b border-indigo-100/30">
                            {activeProject && (
                                <div className="absolute top-0 left-0 right-0 py-1.5 bg-gradient-to-r from-indigo-600 via-violet-600 to-indigo-600 text-white text-[9px] font-bold text-center uppercase tracking-[0.2em] rounded-t-none shadow-md overflow-hidden">
                                    <span className="relative z-10">Project Context: {activeProject.title || activeProject.name}</span>
                                    <div className="absolute inset-0 bg-white/10 animate-pulse" />
                                </div>
                            )}

                            <div className="max-w-4xl mx-auto">
                                {activeFocusItem ? (
                                    <FocusCard
                                        item={activeFocusItem}
                                        onSetEngaged={(id: string, engaged: boolean) => handleSetEngaged(id, engaged)}
                                        onComplete={(id: string) => handleComplete(id)}
                                        onDrop={() => activeFocusItem && vm.resolveDecision(activeFocusItem.id, 'hold', 'Returned to Inbox')}
                                        onSkip={(id: string) => skipTask(id)}
                                        onClick={() => setSelectedItem(activeFocusItem)}
                                        onContextMenu={(e) => activeFocusItem && handleContextMenu(e, activeFocusItem.id)}
                                    />
                                ) : (
                                    <div className="bg-white/50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-2xl p-8 text-center">
                                        <p className="text-slate-400 text-sm font-medium">現在、集中すべきタスクはありません</p>
                                        <p className="text-slate-300 text-xs mt-1">下の Inbox からタスクを選んで「今日やる」に追加してください</p>
                                    </div>
                                )}

                                {remainingQueue.length > 0 && (
                                    <div className="mt-4 space-y-1">
                                        <SectionHeader title="Next Strategy" count={remainingQueue.length} icon={<Clock size={14} />} />
                                        <div className="grid grid-cols-1 gap-[2px]">
                                            {remainingQueue.map((item, index) => (
                                                <SmartItemRow
                                                    key={item.id}
                                                    item={item}
                                                    onClick={() => setSelectedItem(item)}
                                                    onContextMenu={handleContextMenu}
                                                    onFocus={handleSetEngaged}
                                                    index={index}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="max-w-4xl mx-auto px-4 md:px-6 space-y-4">
                            {/* Inbox Section */}
                            <div className="space-y-2">
                                <SectionHeader
                                    title="Inbox (Registration)"
                                    count={inboxItems.length + (ghostGdbCount || 0)}
                                    icon={<BarChart2 size={14} />}
                                />
                                <QuickInputWidget
                                    viewModel={vm}
                                    projectContext={activeProject ? {
                                        id: activeProject.cloudId || String(activeProject.id),
                                        title: activeProject.title,
                                        name: activeProject.name,
                                        tenantId: activeProject.tenantId
                                    } : null}
                                    onOpenItem={setSelectedItem}
                                    onRequestFallbackOpen={() => {
                                        const targetId = lastTargetId || activeFocusItem?.id;
                                        if (targetId) {
                                            const all = [...inboxItems, ...pendingItems, ...waitingItems, ...queueItems];
                                            const item = all.find(i => i.id === targetId);
                                            if (item) setSelectedItem(item);
                                        }
                                    }}
                                />
                                <div className="space-y-1">
                                    {inboxItems.map(item => (
                                        <SmartItemRow
                                            key={item.id}
                                            item={item}
                                            onClick={() => setSelectedItem(item)}
                                            onFocus={handleSetEngaged}
                                            onContextMenu={handleContextMenu}
                                        />
                                    ))}
                                    {ghostGdbCount > 0 && (
                                        <div className="h-8 bg-slate-100/50 rounded flex items-center justify-center border border-dashed border-slate-200">
                                            <span className="text-[10px] text-slate-400 font-bold italic">+{ghostGdbCount} other items in cloud</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Pending & Waiting Sections */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <SectionHeader
                                        title="Pending"
                                        count={pendingItems.length}
                                        expanded={isPendingExpanded}
                                        onToggle={() => setIsPendingExpanded(!isPendingExpanded)}
                                    />
                                    {isPendingExpanded && (
                                        <div className="space-y-1">
                                            {pendingItems.map(item => (
                                                <SmartItemRow
                                                    key={item.id}
                                                    item={item}
                                                    onClick={() => setSelectedItem(item)}
                                                    onFocus={handleSetEngaged}
                                                    onContextMenu={handleContextMenu}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-2">
                                    <SectionHeader
                                        title="Waiting"
                                        count={waitingItems.length}
                                        expanded={isWaitingExpanded}
                                        onToggle={() => setIsWaitingExpanded(!isWaitingExpanded)}
                                    />
                                    {isWaitingExpanded && (
                                        <div className="space-y-1">
                                            {waitingItems.map(item => (
                                                <SmartItemRow
                                                    key={item.id}
                                                    item={item}
                                                    onClick={() => setSelectedItem(item)}
                                                    onFocus={handleSetEngaged}
                                                    onContextMenu={handleContextMenu}
                                                />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <SideMemoWidget />

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    itemId={contextMenu.targetId!}
                    onClose={closeMenu}
                    onDelete={deleteItem}
                    onEdit={(id) => {
                        const all = [...inboxItems, ...pendingItems, ...waitingItems, ...queueItems];
                        const item = all.find(i => i.id === id);
                        if (item) setSelectedItem(item);
                    }}
                />
            )}

            {selectedItem && (
                <DecisionDetailModal
                    item={selectedItem}
                    onClose={() => {
                        setSelectedItem(null);
                        handleRefresh();
                    }}
                    onDelete={async (id: string) => {
                        await deleteItem(id);
                        setSelectedItem(null);
                        handleRefresh();
                    }}
                    onDecision={async (id: string, decision: 'yes' | 'hold' | 'no', note?: string, updates?: Partial<Item>) => {
                        await vm.resolveDecision(id, decision, note, updates);
                        setSelectedItem(null);
                        handleRefresh();
                    }}
                    onUpdate={async (id: string, updates: Partial<Item>) => {
                        await updateItem(id, updates);
                        handleRefresh();
                    }}
                    onCreateSubTask={createSubTask}
                    onGetSubTasks={getSubTasks}
                    members={vm.members}
                    allProjects={vm.allProjects}
                    joinedTenants={joinedTenants}
                    onOpenItem={setSelectedItem}
                />
            )}

            {/* Global Dialog handled by App.tsx */}
        </div>
    );
};
