import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Item, Dependency, CapacityConfig, JoinedTenant } from '../../types';
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { QuantityEngine, QuantityContext } from '../../logic/QuantityEngine';
import { formatMinutes, parseTimeInput } from '../../logic/timeParser';
import { normalizeDateKey } from '../../logic/dateUtils';
import { buildHierarchicalList } from '../../logic/hierarchy';
import { DependencyRepository } from '../../repositories/DependencyRepository';
import { validateDependencyConstraint, calculateCascadeAdjustments } from '../../logic/dependencyConstraint';
import { ContextMenu } from '../Common/ContextMenu';
import { buildItemContextMenuActions } from '../../hooks/buildItemContextMenuActions';
import { useToast } from '../../../../../contexts/ToastContext';

const isSameDate = (d1: Date, d2: Date) => {
	return d1.getFullYear() === d2.getFullYear() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getDate() === d2.getDate();
};

interface GanttViewProps {
	allDays: Date[];
	items: Item[];
	heatMap: Map<string, number>;
	today: Date;
	onItemClick?: (item: Item) => void;
	safeConfig: any;
	rowHeight: number;
	projects: any[];
	onJumpToDate?: (date: Date) => void;
	onUpdateItem?: (id: string, updates: Partial<Item>) => Promise<void> | void;
	onDeleteItem?: (id: string) => Promise<void> | void;
	renderItemTitle: (item: Item) => string;
	// Context Props for QuantityEngine
	capacityConfig?: CapacityConfig;
	currentUserId?: string | null;
	joinedTenants?: JoinedTenant[];
	focusedTenantId?: string | null;
	focusedProjectId?: string | null;
	showGroups: boolean;
	onVisibleMonthChange?: (date: Date) => void;
	focusDate?: Date | null;
	scrollRef?: React.RefObject<HTMLDivElement>;
	onDateClick?: (date: Date) => void;
}

export const RyokanGanttView: React.FC<GanttViewProps> = ({
	allDays, items, heatMap: _heatMap, today: _today, onItemClick, safeConfig: _safeConfig, rowHeight: _rowHeight, projects, onJumpToDate: _onJumpToDate, renderItemTitle,
	onUpdateItem, onDeleteItem,
	capacityConfig, currentUserId, joinedTenants, focusedTenantId, focusedProjectId,
	showGroups, onVisibleMonthChange, focusDate, scrollRef, onDateClick
}) => {
	const { showToast } = useToast();
	const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const headerContainerRef = useRef<HTMLDivElement>(null);
	const isSyncing = useRef(false);
	const [dependencies, setDependencies] = useState<Dependency[]>([]);
	const [constraintError, setConstraintError] = useState<string | null>(null);
	const [editingTimeItemId, setEditingTimeItemId] = useState<string | null>(null);
	const [timeInputValue, setTimeInputValue] = useState('');
	const timeInputRef = useRef<HTMLInputElement>(null);
	const [itemContextMenu, setItemContextMenu] = useState<{ x: number; y: number; itemId: string } | null>(null);

	// scrollRefが渡された場合はそちらを優先する実効ref
	const effectiveScrollRef = scrollRef || scrollContainerRef;

	const colWidth = 24; // w-6 = 1.5rem = 24px

	// 依存関係データの取得
	useEffect(() => {
		const repo = new DependencyRepository();
		repo.getDependencies().then(deps => {
			setDependencies(deps);
		}).catch(() => {
			// 取得失敗時は空配列のまま
		});
	}, [items]);

	// 表示中のアイテムに関連する依存関係のみフィルタ
	const visibleDependencies = useMemo(() => {
		const itemIds = new Set(items.map(i => i.id));
		return dependencies.filter(d =>
			itemIds.has(d.sourceItemId) && itemIds.has(d.targetItemId)
		);
	}, [dependencies, items]);

	// Drag & Drop State
	const [dragState, setDragState] = useState<{
		itemId: string;
		startX: number;
		currentX: number;
		originalDate: Date;
	} | null>(null);

	useEffect(() => {
		if (editingTimeItemId && timeInputRef.current) {
			timeInputRef.current.focus();
			timeInputRef.current.select();
		}
	}, [editingTimeItemId]);

	const handleTimeEditConfirm = useCallback(async (itemId: string) => {
		const minutes = parseTimeInput(timeInputValue);
		if (minutes !== null) {
			await onUpdateItem?.(itemId, { estimatedMinutes: minutes } as any);
		}
		setEditingTimeItemId(null);
	}, [timeInputValue, onUpdateItem]);

	const handleItemContextMenu = useCallback((e: React.MouseEvent, itemId: string) => {
		e.preventDefault();
		e.stopPropagation();
		setItemContextMenu({ x: e.clientX, y: e.clientY, itemId });
	}, []);

	const closeItemContextMenu = useCallback(() => setItemContextMenu(null), []);

	const handleContextMenuDelete = useCallback(async (itemId: string) => {
		try {
			await onDeleteItem?.(itemId);
			showToast({ type: 'success', title: 'ゴミ箱へ移動', message: 'アイテムをゴミ箱へ移動しました', duration: 3000 });
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			showToast({ type: 'error', title: '削除失敗', message: msg, duration: 5000 });
		}
	}, [onDeleteItem, showToast]);

	useEffect(() => {
		if (!itemContextMenu) return;
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === 'Delete') {
				e.preventDefault();
				handleContextMenuDelete(itemContextMenu.itemId);
				closeItemContextMenu();
			} else if (e.key === 'Escape') {
				closeItemContextMenu();
			}
		};
		window.addEventListener('keydown', handleKeyDown);
		return () => window.removeEventListener('keydown', handleKeyDown);
	}, [itemContextMenu, handleContextMenuDelete, closeItemContextMenu]);

	// 依存関係制約チェック付きのドラッグ終了処理
	const handleDragEnd = useCallback(async (itemId: string, daysDiff: number) => {
		const item = items.find(i => i.id === itemId);
		if (!item || !item.prep_date || daysDiff === 0) return;

		const newPrepUnix = (item.prep_date as number) + daysDiff * 86400;

		// 制約チェック
		const simpleItems = items.map(i => ({
			id: i.id,
			prep_date: i.prep_date ? (i.prep_date as number) : null,
			due_date: i.due_date || null,
		}));
		const validation = validateDependencyConstraint(
			itemId,
			{ prep_date: newPrepUnix },
			simpleItems,
			visibleDependencies
		);

		if (!validation.valid) {
			setConstraintError(validation.reason || '依存関係の制約に違反しています');
			setTimeout(() => setConstraintError(null), 3000);
			return;
		}

		// カスケード調整の計算
		const cascadeUpdates = calculateCascadeAdjustments(
			itemId,
			{ prep_date: newPrepUnix },
			simpleItems,
			visibleDependencies
		);

		// 本体の更新
		await onUpdateItem?.(itemId, { prep_date: newPrepUnix });

		// カスケード更新
		for (const adj of cascadeUpdates) {
			const updates: Partial<Item> = {};
			if (adj.prep_date !== undefined) updates.prep_date = adj.prep_date;
			if (adj.due_date !== undefined) updates.due_date = adj.due_date;
			await onUpdateItem?.(adj.itemId, updates);
		}
	}, [items, visibleDependencies, onUpdateItem]);

	useEffect(() => {
		if (!dragState) return;

		const handleMouseMove = (e: MouseEvent) => {
			setDragState(prev => prev ? { ...prev, currentX: e.clientX } : null);
		};

		const handleMouseUp = (e: MouseEvent) => {
			if (dragState) {
				const diffX = e.clientX - dragState.startX;
				const daysDiff = Math.round(diffX / colWidth); // 1 day = colWidth
				handleDragEnd(dragState.itemId, daysDiff);
			}
			setDragState(null);
		};

		window.addEventListener('mousemove', handleMouseMove);
		window.addEventListener('mouseup', handleMouseUp);

		return () => {
			window.removeEventListener('mousemove', handleMouseMove);
			window.removeEventListener('mouseup', handleMouseUp);
		};
	}, [dragState, items, colWidth, onUpdateItem]);

	// Sync Scroll Logic: Use native event listeners for better control
	useEffect(() => {
		const header = headerContainerRef.current;
		const body = effectiveScrollRef.current;

		if (!header || !body) return;

		const handleHeaderScroll = () => {
			if (isSyncing.current) return;
			isSyncing.current = true;
			body.scrollLeft = header.scrollLeft;
			requestAnimationFrame(() => {
				isSyncing.current = false;
			});
		};

		const handleBodyScroll = () => {
			if (isSyncing.current) return;
			isSyncing.current = true;
			header.scrollLeft = body.scrollLeft;

			requestAnimationFrame(() => {
				isSyncing.current = false;
			});
		};

		header.addEventListener('scroll', handleHeaderScroll, { passive: true });
		body.addEventListener('scroll', handleBodyScroll, { passive: true });

		return () => {
			header.removeEventListener('scroll', handleHeaderScroll);
			body.removeEventListener('scroll', handleBodyScroll);
		};
	}, []);

	// [PHASE 24] Handle external focusDate change
	// [FIX] focusDateによる強制スクロールを削除し、RyokanCalendar側のpendingScrollTargetによる同期管理へ移行（スクロールの競合防止）

	// Initial Scroll to Today (if no focusDate)
	useEffect(() => {
		if (!focusDate && _today) {
			// Wait for mounting to finish
			const timer = setTimeout(() => {
				scrollToDate(_today);
			}, 100);
			return () => clearTimeout(timer);
		}
	}, [_today, focusDate]);

	// Scroll to date logic
	const scrollToDate = (date: Date) => {
		if (!effectiveScrollRef.current) return;

		// Find index of date in allDays
		const index = allDays.findIndex(d => isSameDate(d, date));
		if (index === -1) return;

		const scrollPos = index * colWidth;
		const containerWidth = effectiveScrollRef.current.clientWidth;
		// Center the date: (scrollPos) - (containerWidth / 2) + (colWidth / 2)
		const centerOffset = containerWidth / 2 - colWidth / 2;

		effectiveScrollRef.current.scrollTo({
			left: Math.max(0, scrollPos - centerOffset),
			behavior: 'smooth'
		});
	};

	// [PHASE 24] Handle scroll to update visible month in header
	useEffect(() => {
		const container = effectiveScrollRef.current;
		if (!container || !onVisibleMonthChange) return;

		const handleScroll = () => {
			// Calculate date at the center of the viewport
			const centerOffset = container.scrollLeft + (container.clientWidth / 2);
			const dayIndex = Math.floor(centerOffset / colWidth);
			const centerDate = allDays[Math.max(0, Math.min(dayIndex, allDays.length - 1))];

			if (centerDate) {
				onVisibleMonthChange(centerDate);
			}
		};

		container.addEventListener('scroll', handleScroll, { passive: true });
		// Trigger once to sync header initially
		handleScroll();

		return () => container.removeEventListener('scroll', handleScroll);
	}, [allDays, onVisibleMonthChange, colWidth]);

	// --- Hierarchy & Sorting Logic ---
	const transformedItems = useMemo(() => {
		// Build Hierarchy using Common Logic
		const hierarchicalWrappers = buildHierarchicalList({
			activeProjectId: focusedProjectId,
			allProjects: projects,
			allItems: items,
			showGroups: showGroups,
			dependencies: visibleDependencies
		});

		return hierarchicalWrappers;
	}, [items, projects, showGroups, focusedProjectId, visibleDependencies]);

	// Calculate detailed allocations using QuantityEngine
	const allocationMap = useMemo(() => {
		if (!capacityConfig || !currentUserId) return new Map();

		const context: QuantityContext = {
			items,
			members: [],
			capacityConfig,
			// filterMode removed: QuantityEngine no longer needs it
			focusedTenantId,
			focusedProjectId,
			currentUser: {
				id: currentUserId,
				isCompanyAccount: false,
				joinedTenants: joinedTenants?.map(t => ({ id: t.id, name: t.name })) || []
			}
		};

		const map = new Map();

		items.forEach(item => {
			const endDate = item.prep_date ? new Date((item.prep_date as number) * 1000) : null;
			if (endDate) {
				const estMinutes = item.estimatedMinutes || (item.work_days ? item.work_days * 480 : 60);
				const steps = QuantityEngine.calculateAllocationDetails(endDate, estMinutes, context, item.tenantId);
				map.set(item.id, steps);
			}
		});

		return map;
	}, [items, capacityConfig, currentUserId, joinedTenants, focusedTenantId, focusedProjectId]);

	// Helper to calculate bar style with drag offset
	const getBarStyle = (item: Item, type: 'prep', baseStyle: React.CSSProperties) => {
		if (dragState && dragState.itemId === item.id && type === 'prep') {
			const diffX = dragState.currentX - dragState.startX;
			return {
				...baseStyle,
				transform: `translateX(${diffX}px)`,
				zIndex: 50,
				cursor: 'grabbing',
				boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
			};
		}
		return baseStyle;
	};

	return (
		<div className="ryokan-gantt-view-container flex flex-col h-full overflow-hidden select-none bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100">
			{/* Header */}
			<div
				ref={headerContainerRef}
				className="flex-none overflow-x-scroll border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 z-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
			>
				<div className="flex">
					{/* Sticky Corner */}
					<div className="sticky left-0 z-30 w-64 shrink-0 bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex items-end pb-2 pl-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
						<span className="text-xs font-bold text-slate-400">Project / Task</span>
					</div>

					{/* Date Headers */}
					<div className="flex">
						{allDays.map((day, i) => {
							const isSun = day.getDay() === 0;
							const isSat = day.getDay() === 6;
							const isFirst = day.getDate() === 1;
							const isToday = isSameDate(day, _today);
							return (
								<div
									key={i}
									data-gantt-date={normalizeDateKey(day)}
									className={cn(
										`flex-none w-6 flex flex-col items-center justify-end pb-2 border-r border-slate-100 dark:border-slate-800 transition-colors cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30`,
										isFirst ? 'border-l-2 border-l-slate-400/80 dark:border-l-slate-500/80' : '',
										isToday && 'border-l border-r border-amber-300/50 bg-amber-50/40 dark:bg-amber-900/20'
									)}
									onClick={() => onDateClick?.(day)}
								>
									{isFirst && (
										<div className="absolute top-2 text-[10px] font-bold text-slate-500 whitespace-nowrap ml-1 pointer-events-none">
											{format(day, 'M月')}
										</div>
									)}
									<span className={`text-[9px] font-mono leading-none ${isSun ? 'text-red-400 font-bold' : isSat ? 'text-blue-400' : 'text-slate-400'}`}>
										{['日', '月', '火', '水', '木', '金', '土'][day.getDay()]}
									</span>
									<span className={`text-[10px] font-bold leading-none mt-1 ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : isToday ? 'text-amber-600 dark:text-amber-400' : 'text-slate-600 dark:text-slate-400'}`}>
										{day.getDate()}
									</span>
								</div>
							);
						})}
					</div>
				</div>
			</div>

			{/* Body */}
			<div
				ref={effectiveScrollRef}
				className="flex-1 overflow-auto overflow-x-auto relative min-h-0"
			>
				<div className="min-w-max pb-32 relative">
					{/* [FIX] Background Grid & Scroll Targets (Always present even if no items) */}
					<div className="absolute top-0 bottom-0 left-[16rem] flex pointer-events-none z-0">
						{allDays.map(date => {
							const isSun = date.getDay() === 0;
							const isSat = date.getDay() === 6;
							const isFirstOfMonth = date.getDate() === 1;
							const isToday = isSameDate(date, _today);
							return (
								<div
									key={`bg-${date.getTime()}`}
									data-gantt-date={normalizeDateKey(date)}
									className={cn(
										"w-6 flex-shrink-0 border-r border-slate-50 dark:border-slate-800/50",
										isToday
											? "bg-amber-50/40 dark:bg-amber-900/20"
											: isSun ? "bg-red-50/20 dark:bg-red-900/5" : isSat ? "bg-blue-50/10 dark:bg-blue-900/5" : "",
										isFirstOfMonth ? "border-l-2 border-l-slate-300/80 dark:border-l-slate-600/80" : ""
									)}
								/>
							);
						})}
					</div>

					{/* 依存関係の矢印線（SVGオーバーレイ） */}
					<GanttDependencyArrows
						dependencies={visibleDependencies}
						transformedItems={transformedItems}
						allDays={allDays}
						colWidth={colWidth}
						rowHeight={28}
						stickyColWidth={256}
					/>

					<div className="relative z-10">
						{transformedItems.map(wrapper => {
							if (wrapper.type === 'header') {
								const groupTitle = wrapper.item.title || (wrapper.item as any).name || `Project (${wrapper.item.id})`;
								return (
									<div
										key={wrapper.id}
										className="sticky left-0 z-20 w-64 min-w-[16rem] bg-slate-100 dark:bg-slate-800 px-4 py-1.5 text-xs font-bold text-slate-500 border-y border-white dark:border-slate-700 shadow-sm flex items-center"
										style={{ paddingLeft: `${wrapper.depth * 16 + 16}px` }}
									>
										{wrapper.depth > 0 && <span className="text-slate-400 mr-2">└</span>}
										{groupTitle}
									</div>
								);
							}

							const item = wrapper.item;
							const prepDateObj = item.prep_date ? new Date((item.prep_date as number) * 1000) : null;
							const dueDateObj = item.due_date ? new Date(item.due_date) : null;
							const depth = wrapper.depth || 0;

							return (
								<div
									key={item.id}
									data-item-id={item.id}
									className="flex h-7 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
									onMouseEnter={() => setHoveredItemId(item.id)}
									onMouseLeave={() => setHoveredItemId(null)}
								>
									{/* Sticky Title Column */}
									<div
										className="sticky left-0 z-10 w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex items-center px-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)] gap-1"
										onContextMenu={(e) => handleItemContextMenu(e, item.id)}
									>
										<div
											className="truncate text-sm font-medium flex-1 text-slate-700 dark:text-slate-200 cursor-pointer hover:text-indigo-600 hover:underline flex items-center min-w-0"
											style={{ paddingLeft: `${depth * 16}px` }}
											onClick={(e) => {
												e.stopPropagation();
												const targetDate = item.prep_date ? new Date((item.prep_date as number) * 1000) : (item.due_date ? new Date(item.due_date) : null);
												if (targetDate) {
													scrollToDate(targetDate);
												}
											}}
											title="クリックで納期へスクロール"
										>
											{depth > 0 && <span className="text-slate-400 mr-1">└</span>}
											<span className="truncate">
												{renderItemTitle(item)}
												{!showGroups && item.projectTitle && (
													<span
														data-testid={`project-label-${item.id}`}
														className="ml-1 text-[10px] text-slate-400 dark:text-slate-500 font-normal whitespace-nowrap"
													>
														[{item.projectTitle}]
													</span>
												)}
											</span>
										</div>
										{/* 目安時間バッジ（インライン編集） */}
										{editingTimeItemId === item.id ? (
											<input
												ref={timeInputRef}
												type="text"
												value={timeInputValue}
												onChange={(e) => setTimeInputValue(e.target.value)}
												onKeyDown={(e) => {
													e.stopPropagation();
													if (e.key === 'Enter') { e.preventDefault(); handleTimeEditConfirm(item.id); }
													else if (e.key === 'Escape') setEditingTimeItemId(null);
												}}
												onBlur={() => handleTimeEditConfirm(item.id)}
												onClick={(e) => e.stopPropagation()}
												placeholder="1h"
												className="w-10 text-[9px] px-1 py-0 border border-amber-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-amber-500 text-center shrink-0"
											/>
										) : (
											<span
												className={cn(
													"text-[9px] px-1 rounded font-mono cursor-pointer shrink-0",
													formatMinutes(item.estimatedMinutes)
														? "bg-amber-100 text-amber-600 hover:bg-amber-200"
														: "text-slate-300 hover:text-slate-400"
												)}
												onClick={(e) => {
													e.stopPropagation();
													setTimeInputValue(formatMinutes(item.estimatedMinutes) || '');
													setEditingTimeItemId(item.id);
												}}
												title="目安時間（クリックして編集）"
											>
												{formatMinutes(item.estimatedMinutes) || '--'}
											</span>
										)}
										{hoveredItemId === item.id && editingTimeItemId !== item.id && (
											<button onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 transition-colors shrink-0">
												<ChevronRight size={14} />
											</button>
										)}
									</div>

									{/* Timeline Cells */}
									<div className="flex relative">
										{allDays.map(date => {
											const isSun = date.getDay() === 0;
											const isSat = date.getDay() === 6;
											const isPrep = prepDateObj && isSameDate(date, prepDateObj);
											const isDue = dueDateObj && isSameDate(date, dueDateObj);
											const isTodayCell = isSameDate(date, _today);

											// Real Allocation Logic
											const allocationSteps = allocationMap.get(item.id);
											const step = allocationSteps?.find((s: any) => isSameDate(s.date, date));

											return (
												<div
													key={date.toDateString()}
													data-gantt-date={normalizeDateKey(date)}
													className={cn(
														"w-6 flex-shrink-0 border-r border-slate-50 dark:border-slate-800/50 relative flex items-center justify-center h-full",
														isTodayCell
															? "bg-amber-50/40 dark:bg-amber-900/20"
															: isSun ? "bg-red-50/50 dark:bg-red-900/10" : isSat ? "bg-blue-50/30 dark:bg-blue-900/10" : "",
														!prepDateObj && onUpdateItem ? "cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-indigo-900/20" : ""
													)}
													onClick={() => {
														if (!prepDateObj && onUpdateItem) {
															const unix = Math.floor(date.getTime() / 1000);
															onUpdateItem(item.id, { prep_date: unix } as any);
														}
													}}
												>
													{/* Real Allocation Chip (Blue) */}
													{step && (
														<div
															className={cn(
																"absolute w-4 h-4 rounded-sm flex items-center justify-center text-[8px] font-bold text-white shadow-sm transition-all hover:scale-110 z-10",
																"bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600"
															)}
															title={`割当: ${step.allocatedMinutes} 分 / Cap: ${step.capacityMinutes} 分\n残: ${step.capacityMinutes - step.allocatedMinutes} 分`}
															onContextMenu={(e) => handleItemContextMenu(e, item.id)}
														>
															{step.allocatedMinutes >= 60 ? Math.round(step.allocatedMinutes / 60) + 'h' : ''}
														</div>
													)}

													{/* My Deadline Handle (Draggable) */}
													{isPrep && (
														<div
															onMouseDown={(e) => {
																if (onUpdateItem) {
																	e.preventDefault();
																	setDragState({
																		itemId: item.id,
																		startX: e.clientX,
																		currentX: e.clientX,
																		originalDate: prepDateObj!
																	});
																}
															}}
															style={getBarStyle(item, 'prep', {})}
															className={cn(
																"absolute top-0.5 bottom-0.5 right-0 w-1.5 rounded-full z-20 cursor-grab active:cursor-grabbing",
																"bg-indigo-400 border border-white dark:border-slate-900 shadow-md",
																"hover:w-3 hover:bg-indigo-500 transition-all",
																onUpdateItem ? "" : "hidden"
															)}
															title={`目安納期: ${format(prepDateObj!, 'M/d')} (ドラッグして移動)`}
														/>
													)}

													{/* Due Date Marker (Fixed) */}
													{isDue && (
														<div className="absolute top-0 bottom-0 left-1/2 w-0.5 bg-red-500/80 z-10" title={`顧客納期: ${format(dueDateObj!, 'M/d')} `} />
													)}
												</div>
											);
										})}
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
			{itemContextMenu && (
			<ContextMenu
				x={itemContextMenu.x}
				y={itemContextMenu.y}
				itemId={itemContextMenu.itemId}
				onClose={closeItemContextMenu}
				actions={buildItemContextMenuActions(itemContextMenu.itemId, {
					onOpenDetail: (id) => { onItemClick?.(items.find(i => i.id === id)!); closeItemContextMenu(); },
					onMakeProject: async (id) => { await onUpdateItem?.(id, { isProject: true } as any); closeItemContextMenu(); },
					onResolveYes: async (id) => { await onUpdateItem?.(id, { status: 'focus' } as any); closeItemContextMenu(); },
					onMarkDone: async (id) => { await onUpdateItem?.(id, { status: 'done' } as any); closeItemContextMenu(); },
					onResolveNo: async (id) => { await onUpdateItem?.(id, { status: 'done' } as any); closeItemContextMenu(); },
					onDelete: (id) => { handleContextMenuDelete(id); closeItemContextMenu(); },
				})}
			/>
		)}
		{/* 依存関係制約エラートースト */}
		{constraintError && (
			<div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] bg-red-600 text-white px-6 py-3 rounded-xl shadow-2xl text-sm font-bold animate-in fade-in slide-in-from-bottom-4 duration-300">
				{constraintError}
			</div>
		)}
		</div>
	);
};

/**
 * ガントチャート上に依存関係の矢印線を描画するSVGオーバーレイ
 */
const GanttDependencyArrows: React.FC<{
	dependencies: Dependency[];
	transformedItems: { id: string; type: string; item: Item }[];
	allDays: Date[];
	colWidth: number;
	rowHeight: number;
	stickyColWidth: number;
}> = ({ dependencies, transformedItems, allDays, colWidth, rowHeight, stickyColWidth }) => {
	if (dependencies.length === 0 || allDays.length === 0) return null;

	const itemRowIndex = useMemo(() => {
		const map = new Map<string, number>();
		transformedItems.forEach((w, i) => {
			if (w.type === 'item') {
				map.set(w.item.id, i);
			}
		});
		return map;
	}, [transformedItems]);

	const dayIndexMap = useMemo(() => {
		const map = new Map<string, number>();
		allDays.forEach((d, i) => {
			const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
			map.set(key, i);
		});
		return map;
	}, [allDays]);

	const getDateIndex = (item: Item): number | null => {
		// prep_date（目安納期）をソースの末尾、due_dateをフォールバックとして使用
		let dateObj: Date | null = null;
		if (item.prep_date) {
			dateObj = new Date((item.prep_date as number) * 1000);
		} else if (item.due_date) {
			dateObj = new Date(item.due_date);
		}
		if (!dateObj) return null;
		const key = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
		return dayIndexMap.get(key) ?? null;
	};

	const arrows = useMemo(() => {
		return dependencies.map(dep => {
			const sourceItem = transformedItems.find(w => w.type === 'item' && w.item.id === dep.sourceItemId)?.item;
			const targetItem = transformedItems.find(w => w.type === 'item' && w.item.id === dep.targetItemId)?.item;
			if (!sourceItem || !targetItem) return null;

			const sourceRow = itemRowIndex.get(dep.sourceItemId);
			const targetRow = itemRowIndex.get(dep.targetItemId);
			if (sourceRow === undefined || targetRow === undefined) return null;

			const sourceDayIdx = getDateIndex(sourceItem);
			const targetDayIdx = getDateIndex(targetItem);
			if (sourceDayIdx === null || targetDayIdx === null) return null;

			// ソースの末尾（日付セルの右端）からターゲットの先頭（日付セルの左端）へ
			const x1 = stickyColWidth + (sourceDayIdx + 1) * colWidth;
			const y1 = sourceRow * rowHeight + rowHeight / 2;
			const x2 = stickyColWidth + targetDayIdx * colWidth;
			const y2 = targetRow * rowHeight + rowHeight / 2;

			return { key: dep.id, x1, y1, x2, y2 };
		}).filter(Boolean) as { key: string; x1: number; y1: number; x2: number; y2: number }[];
	}, [dependencies, transformedItems, itemRowIndex, dayIndexMap, colWidth, rowHeight, stickyColWidth]);

	if (arrows.length === 0) return null;

	const maxX = Math.max(...arrows.map(a => Math.max(a.x1, a.x2))) + 20;
	const maxY = Math.max(...arrows.map(a => Math.max(a.y1, a.y2))) + 20;

	return (
		<svg
			className="absolute top-0 left-0 pointer-events-none z-[15]"
			width={maxX}
			height={maxY}
			style={{ overflow: 'visible' }}
		>
			<defs>
				<marker
					id="gantt-dep-arrowhead"
					markerWidth="8"
					markerHeight="6"
					refX="8"
					refY="3"
					orient="auto"
				>
					<polygon points="0 0, 8 3, 0 6" fill="#6366f1" />
				</marker>
			</defs>
			{arrows.map(({ key, x1, y1, x2, y2 }) => {
				const path = `M ${x1} ${y1} C ${x1 + 20} ${y1}, ${x2 - 20} ${y2}, ${x2} ${y2}`;

				return (
					<path
						key={key}
						d={y1 === y2
							? `M ${x1} ${y1} L ${x2} ${y2}`
							: path
						}
						stroke="#6366f1"
						strokeWidth="1.5"
						fill="none"
						opacity="0.75"
						markerEnd="url(#gantt-dep-arrowhead)"
					/>
				);
			})}
		</svg>
	);
};
