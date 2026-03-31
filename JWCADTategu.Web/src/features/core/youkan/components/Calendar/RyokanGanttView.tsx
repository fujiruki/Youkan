import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Item, CapacityConfig, JoinedTenant } from '../../types';
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { QuantityEngine, QuantityContext } from '../../logic/QuantityEngine';
import { normalizeDateKey } from '../../logic/dateUtils';
import { buildHierarchicalList } from '../../logic/hierarchy';

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
	onUpdateItem,
	capacityConfig, currentUserId, joinedTenants, focusedTenantId, focusedProjectId,
	showGroups, onVisibleMonthChange, focusDate, scrollRef, onDateClick
}) => {
	const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const headerContainerRef = useRef<HTMLDivElement>(null);
	const isSyncing = useRef(false);

	// scrollRefが渡された場合はそちらを優先する実効ref
	const effectiveScrollRef = scrollRef || scrollContainerRef;


	const colWidth = 24; // w-6 = 1.5rem = 24px

	// Drag & Drop State
	const [dragState, setDragState] = useState<{
		itemId: string;
		startX: number;
		currentX: number;
		originalDate: Date;
	} | null>(null);

	// Update item handler
	const handleDragEnd = async (itemId: string, daysDiff: number) => {
		const item = items.find(i => i.id === itemId);
		if (!item || !item.prep_date || daysDiff === 0) return;

		const newDate = new Date(item.prep_date * 1000); // Convert Unix timestamp to Date object
		newDate.setDate(newDate.getDate() + daysDiff);

		// Call parent update handler
		onUpdateItem?.(itemId, { prep_date: newDate.getTime() / 1000 }); // Convert back to Unix timestamp
	};

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
			showGroups: showGroups
		});

		return hierarchicalWrappers;
	}, [items, projects, showGroups, focusedProjectId]);

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
				className="flex-none overflow-x-hidden border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 z-20"
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
							return (
								<div
									key={i}
									data-gantt-date={normalizeDateKey(day)}
									className={cn(
										`flex-none w-6 flex flex-col items-center justify-end pb-2 border-r border-slate-100 dark:border-slate-800 transition-colors cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-900/30`,
										isFirst ? 'border-l border-l-slate-300' : ''
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
									<span className={`text-[10px] font-bold leading-none mt-1 ${isSun ? 'text-red-500' : isSat ? 'text-blue-500' : 'text-slate-600 dark:text-slate-400'}`}>
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
							return (
								<div
									key={`bg-${date.getTime()}`}
									data-gantt-date={normalizeDateKey(date)}
									className={cn(
										"w-6 flex-shrink-0 border-r border-slate-50 dark:border-slate-800/50",
										isSun ? "bg-red-50/20 dark:bg-red-900/5" : isSat ? "bg-blue-50/10 dark:bg-blue-900/5" : ""
									)}
								/>
							);
						})}
					</div>

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
									className="flex h-10 border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
									onMouseEnter={() => setHoveredItemId(item.id)}
									onMouseLeave={() => setHoveredItemId(null)}
								>
									{/* Sticky Title Column */}
									<div className="sticky left-0 z-10 w-64 shrink-0 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex items-center px-4 shadow-[4px_0_8px_-4px_rgba(0,0,0,0.1)]">
										<div
											className="truncate text-sm font-medium flex-1 text-slate-700 dark:text-slate-200 cursor-pointer hover:text-indigo-600 hover:underline flex items-center"
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
											<span className="truncate">{renderItemTitle(item)}</span>
										</div>
										{hoveredItemId === item.id && (
											<button onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }} className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-indigo-500 transition-colors">
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

											// Real Allocation Logic
											const allocationSteps = allocationMap.get(item.id);
											const step = allocationSteps?.find((s: any) => isSameDate(s.date, date));

											return (
												<div
													key={date.toDateString()}
													data-gantt-date={normalizeDateKey(date)}
													className={cn(
														"w-6 flex-shrink-0 border-r border-slate-50 dark:border-slate-800/50 relative flex items-center justify-center h-full",
														isSun ? "bg-red-50/50 dark:bg-red-900/10" : isSat ? "bg-blue-50/30 dark:bg-blue-900/10" : ""
													)}
												>
													{/* Real Allocation Chip (Blue) */}
													{step && (
														<div
															className={cn(
																"absolute w-5 h-5 rounded-sm flex items-center justify-center text-[9px] font-bold text-white shadow-sm transition-all hover:scale-110 z-10",
																"bg-indigo-500 hover:bg-indigo-600 dark:bg-indigo-600"
															)}
															title={`割当: ${step.allocatedMinutes} 分 / Cap: ${step.capacityMinutes} 分\n残: ${step.capacityMinutes - step.allocatedMinutes} 分`}
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
		</div>
	);
};
