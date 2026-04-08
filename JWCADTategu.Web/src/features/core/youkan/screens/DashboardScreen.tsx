import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
	BarChart2,
	ChevronDown,
	ChevronRight,
	Clock
} from 'lucide-react';
import { useYoukanViewModel } from '../viewmodels/useYoukanViewModel';
import { Item } from '../types';
import { SmartItemRow } from '../components/Dashboard/SmartItemRow';
import { SortableFocusQueue } from '../components/Dashboard/SortableFocusQueue';
import { QuickInputWidget } from '../components/Inputs/QuickInputWidget';
import { DecisionDetailModal } from '../components/Modal/DecisionDetailModal';
import { useItemContextMenu } from '../hooks/useItemContextMenu';
import { ContextMenu } from '../components/GlobalBoard/ContextMenu';
import { buildItemContextMenuActions } from '../hooks/buildItemContextMenuActions';
import { SideMemoWidget } from '../components/SideMemo/SideMemoWidget';
import { YoukanBoard } from '../components/GlobalBoard/GlobalBoard';
import { FocusCard } from '../components/Dashboard/FocusCard';
import { RyokanCalendar, RyokanCalendarHandle } from '../components/Calendar/RyokanCalendar';
import { GanttHeader } from '../components/Calendar/GanttHeader';
import { Project as LocalProject } from '../../../../db/db';
import { isValid } from 'date-fns';
import { NewspaperBoard } from '../components/NewspaperBoard/NewspaperBoard';
import { YOUKAN_KEYS, YOUKAN_EVENTS } from '../../session/youkanKeys';
import { useFilter } from '../contexts/FilterContext';
import { ApiClient } from '../../../../api/client';

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

export const DashboardScreen = ({ activeProject, onNavigateToFlow }: { activeProject?: LocalProject | null; onNavigateToFlow?: (projectId: string) => void }) => {
	const [viewMode, setViewMode] = useState<'stream' | 'panorama' | 'calendar' | 'newspaper'>(() => {
		const path = window.location.pathname.toLowerCase();
		if (path.includes('panorama')) return 'panorama';
		if (path.includes('calendar')) return 'calendar';
		if (path.includes('newspaper')) return 'newspaper';
		const saved = localStorage.getItem(YOUKAN_KEYS.VIEW_MODE);
		return (saved === 'panorama' || saved === 'stream' || saved === 'calendar' || saved === 'newspaper') ? saved : 'stream';
	});

	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.VIEW_MODE, viewMode);
	}, [viewMode]);

	useEffect(() => {
		const handleViewModeChange = (e: CustomEvent<{ mode: string }>) => {
			const mode = e.detail?.mode;
			if (mode === 'stream' || mode === 'board' || mode === 'newspaper') {
				setViewMode(mode === 'board' ? 'panorama' : mode as any);
			}
		};
		window.addEventListener(YOUKAN_EVENTS.VIEW_MODE_CHANGE, handleViewModeChange as EventListener);
		return () => window.removeEventListener(YOUKAN_EVENTS.VIEW_MODE_CHANGE, handleViewModeChange as EventListener);
	}, []);

	// [REFACTORED] FilterContextから完了表示状態を取得
	const { hideCompleted, setFilterMode: setGlobalFilterMode } = useFilter();

	// [R-005] Newspaper View切替時にフィルタを「全て」にリセット
	useEffect(() => {
		if (viewMode === 'newspaper') {
			setGlobalFilterMode('all');
		}
	}, [viewMode, setGlobalFilterMode]);


	const vm = useYoukanViewModel(activeProject?.cloudId || (activeProject?.id ? String(activeProject.id) : undefined));

	const {
		gdbActive: inboxItems,
		gdbIntent: pendingItems,
		gdbPreparation: waitingItems,
		todayCandidates,
		todayCommits,
		gdbLog,
		capacityUsed,
		capacityLimit,
		filterMode,
		ghostGdbCount,
		executionItem: activeExecutionItem, // Use VM's filtered executionItem
		refreshAll: handleRefresh,
		updateItem,
		deleteItem,
		completeItem,
		createSubTask,
		getSubTasks,
		skipTask,
		setEngaged,
		currentUserId,
		joinedTenants,
		members,
		capacityConfig,
		allProjects
	} = vm;

	// [REFINED] All filtering (including filterMode) is now handled declaratively in ViewModel.


	useEffect(() => {
		window.dispatchEvent(new CustomEvent(YOUKAN_EVENTS.CAPACITY_UPDATE, {
			detail: { used: capacityUsed, limit: capacityLimit }
		}));
	}, [capacityUsed, capacityLimit]);

	const filteredProjects = useMemo(() => {
		return allProjects.filter(p => {
			if (filterMode === 'all') return true;
			if (filterMode === 'personal') return !p.tenantId || p.tenantId === '';
			if (filterMode === 'company') return !!p.tenantId;
			return p.tenantId === filterMode;
		});
	}, [allProjects, filterMode]);

	// [REFINED] vm already contains filtered data and allProjects.
	const filteredVM = vm;

	const [ganttRowHeight, setGanttRowHeight] = useState<number>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.GANTT_ROW_HEIGHT);
		return saved ? parseInt(saved, 10) : 12;
	});

	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.GANTT_ROW_HEIGHT, ganttRowHeight.toString());
	}, [ganttRowHeight]);

	const [showGanttGroups, setShowGanttGroups] = useState<boolean>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.GANTT_SHOW_GROUPS);
		return saved !== 'false';
	});

	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.GANTT_SHOW_GROUPS, showGanttGroups.toString());
	}, [showGanttGroups]);

	const calendarRef = useRef<RyokanCalendarHandle>(null);
	const [visibleMonth, setVisibleMonth] = useState<Date>(() => new Date());

	const queueItems = [
		...(activeExecutionItem ? [activeExecutionItem] : []),
		...todayCommits.filter(i => i.id !== activeExecutionItem?.id),
		...todayCandidates.filter(i => i.id !== activeExecutionItem?.id)
	].filter(i => i != null && !!i.id);

	const [selectedItem, setSelectedItem] = useState<Item | null>(null);
	const [isPendingExpanded, setIsPendingExpanded] = useState(false);
	const [isWaitingExpanded, setIsWaitingExpanded] = useState(false);
	const { menuState: contextMenu, handleContextMenu, closeMenu, lastTargetId } = useItemContextMenu({
		onDelete: (id) => vm.deleteItem(id)
	});

	const handleViewModeChangeInternal = (mode: 'stream' | 'panorama' | 'calendar' | 'newspaper') => {
		setViewMode(mode);
	};

	const activeFocusItem = queueItems.length > 0 ? queueItems[0] : null;
	const remainingQueue = queueItems.slice(1);
	const unifiedAllItems = useMemo(() => {
		return [
			...(activeExecutionItem ? [activeExecutionItem] : []),
			...todayCommits.filter(i => i.id !== activeExecutionItem?.id),
			...todayCandidates.filter(i => i.id !== activeExecutionItem?.id),
			...inboxItems,
			...pendingItems,
			...waitingItems,
			...(gdbLog || [])
		].filter(item => item != null);
	}, [activeExecutionItem, todayCommits, todayCandidates, inboxItems, pendingItems, waitingItems, gdbLog]);


	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.altKey && e.key.toLowerCase() === 'd') {
				if (document.activeElement instanceof HTMLInputElement || document.activeElement instanceof HTMLTextAreaElement) return;
				e.preventDefault();
				const targetId = contextMenu?.targetId || lastTargetId || activeFocusItem?.id;
				if (targetId) {
					const item = unifiedAllItems.find(i => i.id === targetId);
					if (item) setSelectedItem(item);
				}
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [contextMenu, lastTargetId, activeFocusItem, unifiedAllItems]);

	const handleSetEngaged = async (id: string, isEngaged: boolean) => {
		await setEngaged(id, isEngaged);
		handleRefresh();
	};

	const handleComplete = async (id: string) => {
		await completeItem(id);
		handleRefresh();
	};

	const handleReorder = useCallback(async (newOrder: Item[]) => {
		const payload = {
			items: newOrder.map((item, index) => ({
				id: item.id,
				order: index + 1,
			})),
		};
		try {
			await ApiClient.request('POST', '/items?action=reorder_focus', payload);
			handleRefresh();
		} catch (err) {
			console.error('並べ替え失敗', err);
			handleRefresh();
		}
	}, [handleRefresh]);

	return (
		<div className="h-full bg-slate-50 dark:bg-slate-900 flex flex-col overflow-hidden relative">
			{viewMode === 'calendar' && (
				<GanttHeader
					visibleDate={visibleMonth}
					onPrevMonth={() => {
						const prev = new Date(visibleMonth);
						prev.setDate(1);
						prev.setMonth(prev.getMonth() - 1);
						setVisibleMonth(prev);
						calendarRef.current?.scrollToMonth(prev.getFullYear(), prev.getMonth());
					}}
					onNextMonth={() => {
						const next = new Date(visibleMonth);
						next.setDate(1);
						next.setMonth(next.getMonth() + 1);
						setVisibleMonth(next);
						calendarRef.current?.scrollToMonth(next.getFullYear(), next.getMonth());
					}}
					onGoToCurrentMonth={() => {
						const now = new Date();
						setVisibleMonth(now);
						calendarRef.current?.scrollToToday();
					}}
					onOpenDailySettings={() => {
						calendarRef.current?.openDailySettings();
					}}
					rowHeight={ganttRowHeight}
					onRowHeightChange={setGanttRowHeight}
					showGroups={showGanttGroups}
					onShowGroupsChange={setShowGanttGroups}
				/>
			)}

			<div className="flex-1 min-h-0 flex flex-col relative">
				{(viewMode === 'calendar' || viewMode === 'panorama' || viewMode === 'newspaper') ? (
					<div className="flex-1 flex flex-col overflow-hidden">
						<div className="flex-1 overflow-hidden">
							{viewMode === 'calendar' && (
								<RyokanCalendar
									ref={calendarRef}
									items={unifiedAllItems}
									members={members}
									capacityConfig={capacityConfig}
									projects={filteredProjects}
									joinedTenants={joinedTenants}
									currentUserId={currentUserId}
									displayMode="gantt"
									filterMode={filterMode}
									hideHeader={true}
									onItemClick={(item) => setSelectedItem(item)}
									onVisibleMonthChange={(date: Date) => {
										if (isValid(date) && (date.getMonth() !== visibleMonth.getMonth() || date.getFullYear() !== visibleMonth.getFullYear())) {
											setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
										}
									}}
									showGroups={showGanttGroups}
								/>
							)}
							{viewMode === 'newspaper' && (
								<NewspaperBoard viewModel={filteredVM as any} activeProject={activeProject} onOpenItem={setSelectedItem} hideCompleted={hideCompleted} onNavigateToFlow={onNavigateToFlow} />
							)}
							{viewMode === 'panorama' && (
								<YoukanBoard
									initialLayoutMode="panorama"
									onClose={() => handleViewModeChangeInternal('stream')}
									projectId={activeProject?.cloudId}
									rowHeight={ganttRowHeight}
									hideHeader={false}
									showGroups={showGanttGroups}
									onShowGroupsChange={setShowGanttGroups}
								/>
							)}

						</div>
					</div>
				) : (
					<div className="flex-1 overflow-y-auto pb-20">
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
										<SortableFocusQueue
											items={remainingQueue}
											onReorder={handleReorder}
											onItemClick={(item) => setSelectedItem(item)}
											onContextMenu={handleContextMenu}
											onFocus={handleSetEngaged}
										/>
									</div>
								)}
							</div>
						</div>

						<div className="max-w-4xl mx-auto px-4 md:px-6 space-y-4">
							<div className="space-y-2">
								<SectionHeader
									title="Inbox (Registration)"
									count={inboxItems.length + (ghostGdbCount || 0)}
									icon={<BarChart2 size={14} />}
								/>
								<QuickInputWidget
									viewModel={filteredVM as any}
									projectContext={activeProject ? {
										id: activeProject.cloudId || String(activeProject.id),
										title: activeProject.title || activeProject.name || 'Untitled',
										name: activeProject.title || activeProject.name || 'Untitled',
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
					actions={buildItemContextMenuActions(contextMenu.targetId!, {
						onOpenDetail: (id) => {
							const all = [...inboxItems, ...pendingItems, ...waitingItems, ...queueItems];
							const item = all.find(i => i.id === id);
							if (item) setSelectedItem(item);
						},
						onMakeProject: async (id) => {
							await vm.updateItem(id, { isProject: true });
						},
						onResolveYes: async (id) => {
							await vm.resolveDecision(id, 'yes');
						},
						onResolveNo: async (id) => {
							await vm.resolveDecision(id, 'no', 'history');
						},
						onDelete: async (id) => {
							await vm.deleteItem(id);
						},
					})}
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
					onOpenItem={setSelectedItem}
					members={vm.members}
					allProjects={vm.allProjects}
					joinedTenants={joinedTenants}
					quantityItems={unifiedAllItems}
					filterMode={filterMode}
					capacityConfig={capacityConfig}
					currentUserId={vm.currentUserId}
					updateItemMetrics={vm.updateItemMetrics}
				/>
			)}
		</div>
	);
};
