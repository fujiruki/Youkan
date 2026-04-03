import React, { useMemo, useState, useRef, useImperativeHandle, forwardRef, useCallback } from 'react';
import { Item } from '../../types';
import { QuantityEngine } from '../../logic/QuantityEngine';
import { X, Settings } from 'lucide-react';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { RyokanCalendarProps, PressureConnection } from './RyokanCalendarTypes';
import { safeParseDate, normalizeDateKey, safeFormat } from '../../logic/dateUtils';
import { RyokanGridView } from './RyokanGridView';
import { RyokanTimelineView } from './RyokanTimelineView';
import { RyokanGanttView } from './RyokanGanttView';
import { cn } from '../../../../../lib/utils';
import { ChevronRight } from 'lucide-react';
import { SimpleModal } from '../Modal/SimpleModal';
import { DailyCapacityEditor } from '../Settings/DailyCapacityEditor';
import { YOUKAN_KEYS } from '../../../session/youkanKeys';

export interface RyokanCalendarHandle {
	scrollToMonth: (year: number, month: number) => void;
	scrollToToday: () => void;
	openDailySettings: (date?: Date) => void;
}

const getStartOfToday = () => {
	const d = new Date();
	d.setHours(0, 0, 0, 0);
	return d;
};


export const RyokanCalendar = forwardRef<RyokanCalendarHandle, RyokanCalendarProps>(({
	items, completedItems = [], onItemClick, capacityConfig, members,
	layoutMode = 'panorama', displayMode: propDisplayMode, filterMode: _filterMode = 'all',
	onSelectDate, selectedDate, prepDate, focusDate,
	workDays = 1,
	rowHeight: propRowHeight,
	projects = [],
	focusedTenantId, focusedProjectId, currentUserId, joinedTenants = [],
	onUpdateCapacityException,
	volumeOnly = false,
	targetItemId,
	commitPeriod, // [NEW]
	hideHeader = false,
	onDateClick,
	disablePressureLines = false,
	onUpdateItem, // [NEW]
	onVisibleMonthChange, // [NEW Phase 24]
	onOpenDailySettings, // [NEW Phase 24]
	showGroups = true // [NEW]
}, calendarRef) => {
	const [displayMode, setDisplayMode] = useState<'grid' | 'timeline' | 'gantt'>(propDisplayMode || 'grid');

	// [FIX] Sync displayMode with prop
	React.useEffect(() => {
		if (propDisplayMode) setDisplayMode(propDisplayMode);
	}, [propDisplayMode]);

	const today = useMemo(() => getStartOfToday(), []);
	const isMini = layoutMode === 'mini';

	// Default Row Height logic
	const rowHeight = React.useMemo(() => {
		if (propRowHeight) return propRowHeight;
		if (volumeOnly && layoutMode === 'mini') return 50; // New requirement for Detail Modal
		return layoutMode === 'mini' ? 24 : 80;
	}, [propRowHeight, layoutMode, volumeOnly]);

	const [editingDate, setEditingDate] = useState<Date | null>(null); // [NEW]
	const [pendingScrollTarget, setPendingScrollTarget] = useState<Date | null>(null); // [FIX] Reactのライフサイクルに同期したスクロール用

	const [selectedSigns, setSelectedSigns] = useState<Item[]>([]);
	const [selectedDateCompleted, setSelectedDateCompleted] = useState<{ date: Date; items: Item[] } | null>(null);
	const [pressureConnections, setPressureConnections] = useState<PressureConnection[]>([]);
	const [flashingItemIds, setFlashingItemIds] = useState<Set<string>>(new Set());

	const scrollContainerRef = useRef<HTMLDivElement>(null);

	const [allDays, setAllDays] = useState<Date[]>([]);
	const [range, setRange] = useState<{ start: Date; end: Date } | null>(null);

	// [NEW Phase 24] Expose imperative scroll control
	const scrollToDateElement = useCallback((targetDate: Date, instant: boolean = false) => {
		if (!scrollContainerRef.current) return;
		const container = scrollContainerRef.current;
		const scrollBehavior = instant ? 'instant' as ScrollBehavior : 'smooth' as ScrollBehavior;

		if (displayMode === 'gantt') {
			const targetEl = container.querySelector(`[data-gantt-date="${normalizeDateKey(targetDate)}"]`);
			if (targetEl) {
				const rect = targetEl.getBoundingClientRect();
				const containerRect = container.getBoundingClientRect();
				const scrollOffset = container.scrollLeft + rect.left - containerRect.left - (containerRect.width / 2) + (rect.width / 2);
				container.scrollTo({ left: scrollOffset, behavior: scrollBehavior });
			}
		} else {
			// Vertical scrolling logic for Grid/Timeline
			const targetKey = normalizeDateKey(targetDate);
			const targetEl = container.querySelector(`[data-date="${targetKey}"]`);
			if (targetEl) {
				const containerRect = container.getBoundingClientRect();
				const targetRect = targetEl.getBoundingClientRect();
				const scrollOffset = (targetEl as HTMLElement).offsetTop - (containerRect.height / 2) + (targetRect.height / 2);
				container.scrollTo({ top: scrollOffset, behavior: scrollBehavior });
			}
		}
	}, [displayMode]);

	// [R-007] 今月を中央にスクロール（横: 月全体を中央、縦: 関連アイテム群を中央）
	const scrollToCurrentMonthCenter = useCallback(() => {
		if (!scrollContainerRef.current) return;
		const container = scrollContainerRef.current;
		const now = new Date();

		if (displayMode === 'gantt') {
			// 横方向: 今月の1日〜末日の中央をビューポート中央に
			const monthFirstDay = new Date(now.getFullYear(), now.getMonth(), 1);
			const monthLastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
			const firstKey = normalizeDateKey(monthFirstDay);
			const lastKey = normalizeDateKey(monthLastDay);

			const firstEl = container.querySelector(`[data-gantt-date="${firstKey}"]`);
			const lastEl = container.querySelector(`[data-gantt-date="${lastKey}"]`);

			if (firstEl) {
				const containerRect = container.getBoundingClientRect();
				const firstRect = firstEl.getBoundingClientRect();
				const lastRect = lastEl ? lastEl.getBoundingClientRect() : firstRect;

				const monthCenterX = (firstRect.left + lastRect.right) / 2;
				const viewportCenterX = containerRect.left + containerRect.width / 2;
				const horizontalScroll = container.scrollLeft + (monthCenterX - viewportCenterX);
				container.scrollTo({ left: Math.max(0, horizontalScroll), behavior: 'smooth' });
			}

			// 縦方向: 今月が目安期間（prep_date〜due_date）に含まれるアイテム群の中央を表示
			const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
			const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
			const monthStartUnix = Math.floor(monthStart.getTime() / 1000);
			const monthEndUnix = Math.floor(monthEnd.getTime() / 1000);

			// 今月が目安期間に含まれるアイテムのIDを収集
			const matchingItemIds = new Set<string>();
			items.forEach(item => {
				const prepUnix = item.prep_date ? (item.prep_date as number) : null;
				const dueUnix = item.due_date ? Math.floor(new Date(item.due_date).getTime() / 1000) : null;
				if (!prepUnix && !dueUnix) return;
				// 期間: prep_date〜due_date（片方しかない場合はその日のみ）
				const rangeStart = Math.min(...[prepUnix, dueUnix].filter((v): v is number => v !== null));
				const rangeEnd = Math.max(...[prepUnix, dueUnix].filter((v): v is number => v !== null));
				// 今月と期間が重なるか判定
				if (rangeStart <= monthEndUnix && rangeEnd >= monthStartUnix) {
					matchingItemIds.add(item.id);
				}
			});

			if (matchingItemIds.size > 0) {
				// DOM上の行要素を取得（data-item-id属性で特定）
				const matchingRows: HTMLElement[] = [];
				matchingItemIds.forEach(id => {
					const row = container.querySelector(`[data-item-id="${id}"]`) as HTMLElement | null;
					if (row) matchingRows.push(row);
				});

				if (matchingRows.length > 0) {
					// offsetTopでソートして最初と最後の行を特定
					matchingRows.sort((a, b) => a.offsetTop - b.offsetTop);
					const firstRow = matchingRows[0];
					const lastRow = matchingRows[matchingRows.length - 1];
					const groupCenterY = (firstRow.offsetTop + lastRow.offsetTop + lastRow.offsetHeight) / 2;
					const verticalScroll = groupCenterY - container.clientHeight / 2;
					container.scrollTo({ top: Math.max(0, verticalScroll), behavior: 'smooth' });
				}
			}
		} else {
			// Grid/Timeline: 従来のスクロール
			scrollToDateElement(now);
		}
	}, [displayMode, scrollToDateElement, items]);

	useImperativeHandle(calendarRef, () => ({
		scrollToMonth: (year: number, month: number) => {
			const targetDate = new Date(year, month, 15); // Middle of target month
			setPendingScrollTarget(targetDate);
		},
		scrollToToday: () => {
			// [R-007] 「今月を表示」は今月全体を中央にスクロール
			const now = new Date();
			const monthFirstDay = new Date(now.getFullYear(), now.getMonth(), 1);
			// rangeが今月を含まない場合はrangeを拡張してから再試行
			if (range && (monthFirstDay < range.start || monthFirstDay > range.end)) {
				setPendingScrollTarget(now);
			}
			// DOMの更新後にスクロール実行
			requestAnimationFrame(() => {
				scrollToCurrentMonthCenter();
			});
		},
		openDailySettings: (date?: Date) => {
			setEditingDate(date || new Date());
		}
	}), [scrollToCurrentMonthCenter, range]);

	// [FIX] Initialize range with current month +/- 2 months (Total 5 months)
	React.useEffect(() => {
		const anchor = focusDate ? new Date(focusDate) : new Date(today);

		// [NEW] Avoid resetting range if the new focusDate is already within the current range 
		// AND we've already done the initial scroll. This prevents jumping on selection/click.
		if (range && hasInitialScrolled) {
			const fDate = new Date(anchor);
			if (fDate >= range.start && fDate <= range.end) {
				return;
			}
		}

		// Start: 2 months back, align to start of week
		const start = new Date(anchor.getFullYear(), anchor.getMonth() - 2, 1);
		const dayOfWeek = start.getDay();
		start.setDate(start.getDate() - dayOfWeek);
		start.setHours(0, 0, 0, 0);

		// End: 2 months forward, align to end of week
		const end = new Date(anchor.getFullYear(), anchor.getMonth() + 3, 0); // End of month + 2
		const endDayOfWeek = end.getDay();
		end.setDate(end.getDate() + (6 - endDayOfWeek));
		end.setHours(23, 59, 59, 999);

		setRange({ start, end });
		// Reset scroll flag if we are doing a major jump to a distant date
		if (range && (anchor < range.start || anchor > range.end)) {
			setHasInitialScrolled(false);
		}
	}, [today.getTime(), focusDate?.getTime()]);

	// Update allDays when range changes
	React.useEffect(() => {
		if (!range) return;
		const days: Date[] = [];
		let cur = new Date(range.start);

		// [Safety] Ensure start/end are valid
		if (isNaN(cur.getTime()) || isNaN(range.end.getTime())) {
			console.warn('[RyokanCalendar] Invalid range detected', range);
			return;
		}

		while (cur <= range.end) {
			days.push(new Date(cur));
			cur.setHours(12, 0, 0, 0);
			cur.setDate(cur.getDate() + 1);
			cur.setHours(0, 0, 0, 0);
			if (days.length > 3000) break; // Hard safety
		}
		setAllDays(days);
	}, [range]);

	// [NEW] Infinite Scroll & Scroll into View (Center Today)
	const [hasInitialScrolled, setHasInitialScrolled] = useState(false);

	// Initial Scroll to Center Today
	React.useEffect(() => {
		if (allDays.length > 0 && !hasInitialScrolled && scrollContainerRef.current) {
			const target = focusDate || today;
			scrollToDateElement(target, true); // 初回はアニメーションなしで即座に表示
			setHasInitialScrolled(true);
		}
	}, [allDays.length, hasInitialScrolled, scrollToDateElement, focusDate, today]);

	// [FIX] Process pending scroll targets AFTER range & allDays updates (Reactive Sync)
	React.useEffect(() => {
		if (pendingScrollTarget && allDays.length > 0) {
			if (!range || pendingScrollTarget < range.start || pendingScrollTarget > range.end) {
				// Expand range to encompass target
				const newStart = new Date(pendingScrollTarget.getFullYear(), pendingScrollTarget.getMonth() - 2, 1);
				const dayOfWeek = newStart.getDay();
				newStart.setDate(newStart.getDate() - dayOfWeek);
				newStart.setHours(0, 0, 0, 0);

				const newEnd = new Date(pendingScrollTarget.getFullYear(), pendingScrollTarget.getMonth() + 3, 0);
				const endDayOfWeek = newEnd.getDay();
				newEnd.setDate(newEnd.getDate() + (6 - endDayOfWeek));
				newEnd.setHours(23, 59, 59, 999);

				setRange({ start: newStart, end: newEnd });
				return; // Wait for the next tick when allDays is updated
			}

			// Proceed to scroll if target is within current DOM
			scrollToDateElement(pendingScrollTarget);
			setPendingScrollTarget(null);
		}
	}, [pendingScrollTarget, allDays, range, scrollToDateElement]);

	// 完了タスクを日付キー別にグループ化
	const completedByDate = useMemo(() => {
		const map = new Map<string, Item[]>();
		for (const item of completedItems) {
			if (!item.completedAt) continue;
			const d = new Date(item.completedAt * 1000);
			const key = normalizeDateKey(d);
			if (!map.has(key)) map.set(key, []);
			map.get(key)!.push(item);
		}
		return map;
	}, [completedItems]);

	// [NEW Phase 24] Track visible month from scroll position
	const lastReportedMonthRef = useRef<string>('');

	const detectVisibleMonth = useCallback((container: HTMLElement) => {
		if (!onVisibleMonthChange) return;
		// Find the date cell closest to the vertical center of the container
		const centerY = container.scrollTop + container.clientHeight / 2;
		const cells = container.querySelectorAll('[data-date]');
		let closestCell: Element | null = null;
		let closestDistance = Infinity;
		cells.forEach(cell => {
			const top = (cell as HTMLElement).offsetTop;
			const dist = Math.abs(top - centerY);
			if (dist < closestDistance) {
				closestDistance = dist;
				closestCell = cell;
			}
		});
		if (closestCell) {
			const dateStr = (closestCell as HTMLElement).getAttribute('data-date');
			if (dateStr) {
				const monthKey = dateStr.substring(0, 7); // 'YYYY-MM'
				if (monthKey !== lastReportedMonthRef.current) {
					lastReportedMonthRef.current = monthKey;
					const [y, m] = monthKey.split('-').map(Number);
					onVisibleMonthChange(new Date(y, m - 1, 1));
				}
			}
		}
	}, [onVisibleMonthChange]);

	// Handle Infinite Scroll Extension
	const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
		const container = e.currentTarget;
		const { scrollTop, scrollHeight, clientHeight } = container;

		// [NEW Phase 24] Detect visible month
		detectVisibleMonth(container);

		// Upward extension
		if (scrollTop < 200 && range) {
			// Record current scrollHeight to maintain position after prepend
			const prevScrollHeight = scrollHeight;
			const prevScrollTop = scrollTop;

			setRange(prev => {
				if (!prev) return prev;
				const newStart = new Date(prev.start);
				newStart.setDate(newStart.getDate() - 28); // Add 4 weeks
				return { ...prev, start: newStart };
			});

			// Adjust scrollTop in next frame to compensate for added height
			requestAnimationFrame(() => {
				const newScrollHeight = container.scrollHeight;
				const addedHeight = newScrollHeight - prevScrollHeight;
				if (addedHeight > 0) {
					container.scrollTop = prevScrollTop + addedHeight;
				}
			});
		}
		// Downward extension
		else if (scrollTop + clientHeight > scrollHeight - 400 && range) {
			setRange(prev => {
				if (!prev) return prev;
				const newEnd = new Date(prev.end);
				newEnd.setDate(newEnd.getDate() + 28); // Add 4 weeks
				return { ...prev, end: newEnd };
			});
		}
	};

	const qCtx = useMemo(() => ({
		items,
		members: members || [],
		capacityConfig: capacityConfig || { defaultDailyMinutes: 480, holidays: [], exceptions: {} },
		// filterMode removed: QuantityEngine no longer needs it
		focusedTenantId,
		focusedProjectId,
		currentUser: {
			id: currentUserId || '',
			isCompanyAccount: (currentUserId?.length || 0) > 20,
			// [Modified] joinedTenants is already JoinedTenant[], pass directly
			joinedTenants: joinedTenants
		}
	}), [items, capacityConfig, members, focusedTenantId, focusedProjectId, currentUserId, joinedTenants]);

	const metrics = useMemo(() => QuantityEngine.calculateMetrics(allDays, qCtx), [allDays, qCtx]);

	const heatMap = useMemo(() => {
		const hMap = new Map<string, number>();
		metrics.forEach((m, key) => {
			hMap.set(key, QuantityEngine.getIntensity(m.ratio));
		});
		return hMap;
	}, [metrics]);

	const effectiveUserId = useMemo(() => currentUserId || (JSON.parse(localStorage.getItem(YOUKAN_KEYS.USER) || '{}').id || null), [currentUserId]);

	const renderItemTitle = (item: Item) => {
		const isProjectContext = focusedProjectId && item.projectId === focusedProjectId;

		let title = item.title;
		const proj = projects.find(p => p.id === item.projectId);
		const projName = proj?.title || proj?.name || '';
		// グループ表示中はヘッダーでプロジェクト名が表示されるため、タイトルには付加しない
		if (proj && !showGroups) {
			const shortProj = projName.substring(0, 4);
			title = `${title} [${shortProj}]`;
		}

		// [Relaxed Privacy Logic]
		if (!effectiveUserId ||
			String(item.createdBy) === String(effectiveUserId) ||
			String(item.assignedTo) === String(effectiveUserId) ||
			isProjectContext) {
			return title;
		}
		return `予定あり [${projName.substring(0, 4) || '???'}]`;
	};

	const resetHighlights = () => {
		setPressureConnections([]);
		setFlashingItemIds(new Set());
		setSelectedSigns([]);
		setSelectedDateCompleted(null);
	};

	const handleDayAction = (date: Date, actionType: 'click' | 'doubleClick' | 'dateClick', rect?: DOMRect) => {
		const dateKey = normalizeDateKey(date);
		const metric = metrics.get(dateKey);
		const signs = metric?.contributingItems || [];

		// 日付クリック時: 負荷内訳 + 完了タスクを表示
		if (actionType === 'dateClick') {
			const dateCompletedItems = completedByDate.get(dateKey) || [];
			if (dateCompletedItems.length > 0 || signs.length > 0) {
				setSelectedSigns(signs);
				setSelectedDateCompleted(dateCompletedItems.length > 0 ? { date, items: dateCompletedItems } : null);
				setPressureConnections([]);
			}
			if (onDateClick) {
				onDateClick(date);
			}
			return;
		}

		// Standard Cell Click
		if (actionType === 'click') {
			if (signs.length === 0) {
				resetHighlights();
			}
			if (onSelectDate) onSelectDate(date);
			// Don't show highlights in volumeOnly mode unless forced
			if (volumeOnly) return;
		}

		if (actionType === 'doubleClick') {
			const dateCompletedItems = completedByDate.get(dateKey) || [];
			setSelectedSigns(signs);
			setSelectedDateCompleted(dateCompletedItems.length > 0 ? { date, items: dateCompletedItems } : null);
			setPressureConnections([]);
			return;
		}

		// Normal mode (Dashboard) logic for pressure lines below...
		if (!volumeOnly && !disablePressureLines && actionType === 'click') {
			if (!rect || !scrollContainerRef.current) return;
			const container = scrollContainerRef.current;
			const svg = container.querySelector('.pressure-lines-svg');
			const svgRect = svg ? svg.getBoundingClientRect() : container.getBoundingClientRect();

			const sourceX = rect.left + rect.width / 2 - svgRect.left;
			const sourceY = rect.top + rect.height / 2 - svgRect.top;

			const newConnections: PressureConnection[] = [];
			const newFlashingIds = new Set<string>();

			signs.forEach(item => {
				const chip = document.getElementById(`cal-chip-${item.id}`);
				// [UI] Find the date where this item's chip SHOULD appear based on UI priority rules
				const uiDate = safeParseDate(item.due_date || item.prep_date);

				if (chip) {
					const chipRect = chip.getBoundingClientRect();
					newConnections.push({
						id: `${date.getTime()}-${item.id}`,
						source: { x: sourceX, y: sourceY },
						target: {
							x: chipRect.left + chipRect.width / 2 - svgRect.left,
							y: chipRect.top + chipRect.height / 2 - svgRect.top
						},
						color: '#fbbf24'
					});
					newFlashingIds.add(item.id);
				} else if (uiDate) {
					const cell = container.querySelector(`[data-date="${normalizeDateKey(uiDate)}"]`);

					if (cell) {
						const cellRect = cell.getBoundingClientRect();
						newConnections.push({
							id: `${date.getTime()}-${item.id}-cell`,
							source: { x: sourceX, y: sourceY },
							target: {
								x: cellRect.left + cellRect.width / 2 - svgRect.left,
								y: cellRect.top + cellRect.height / 2 - svgRect.top
							},
							color: '#fbbf24'
						});
						newFlashingIds.add(item.id);
					} else {
						// Off-screen logic (Plan B: Directional Hints)
						const startView = allDays[0];
						const endView = allDays[allDays.length - 1];

						let offScreen: 'left' | 'right' | undefined;
						let targetX = 0;

						if (uiDate < startView) {
							offScreen = 'left';
							targetX = -20;
						} else if (uiDate > endView) {
							offScreen = 'right';
							targetX = container.clientWidth + 20;
						}

						if (offScreen) {
							newConnections.push({
								id: `${date.getTime()}-${item.id}-off`,
								source: { x: sourceX, y: sourceY },
								target: {
									x: targetX,
									y: sourceY
								},
								color: '#fbbf24',
								isOffScreen: offScreen
							});
						}
					}
				}
			});

			setPressureConnections(newConnections);
			setFlashingItemIds(newFlashingIds);
			setSelectedSigns([]);
		}
	};

	// [NEW] Commit Period Calculation (Priority: Prop > Simple workDays logic)
	const commitPeriodDates = useMemo(() => {
		if (commitPeriod) return commitPeriod;
		if (!selectedDate || workDays <= 1) return [];

		const days: Date[] = [];
		for (let i = 0; i < workDays; i++) {
			const d = new Date(selectedDate); // Re-create date for each iteration to avoid modifying selectedDate
			d.setDate(d.getDate() - i);
			days.push(d);
		}
		return days;
	}, [commitPeriod, selectedDate, workDays]);

	return (
		<div className={cn("ryokan-calendar w-full h-full flex flex-col relative overflow-hidden bg-slate-50 dark:bg-slate-900 border-l-4 border-indigo-200 dark:border-indigo-800 font-sans max-w-full")}>
			{!isMini && !hideHeader && (
				<div className="flex-none px-4 py-2 bg-white/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-10">
					<div className="flex items-center gap-2">
						{/* [User Request] Removed mode switching UI to unify with Global Header */}
					</div>

					<div className="ml-2 pl-2 border-l border-slate-300 dark:border-slate-600">
						<button
							onClick={() => {
								const targetDate = focusDate ? new Date(focusDate) : today;
								if (onOpenDailySettings) {
									onOpenDailySettings(targetDate);
								} else {
									setEditingDate(targetDate);
								}
							}}
							className="px-3 py-1 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1 transition-colors border border-slate-200 dark:border-slate-600"
							title="表示中の日付の稼働設定"
						>
							<Settings className="w-3 h-3" />
							<span>日次設定</span>
						</button>
					</div>
				</div>
			)}

			<div className="flex-1 overflow-hidden relative">
				{displayMode === 'timeline' && (
					<RyokanTimelineView
						allDays={allDays}
						metrics={metrics}
						heatMap={heatMap}
						today={today}
						selectedDate={selectedDate}
						prepDate={prepDate}
						isMini={isMini}
						flashingItemIds={flashingItemIds}
						pressureConnections={pressureConnections}
						onItemClick={onItemClick}
						onAction={handleDayAction}
						commitPeriod={commitPeriodDates}
						projects={projects}
						renderItemTitle={renderItemTitle}
						scrollRef={scrollContainerRef}
						onScroll={handleScroll}
						onBackgroundClick={resetHighlights}
					/>
				)}
				{displayMode === 'grid' && (
					<RyokanGridView
						allDays={allDays}
						metrics={metrics}
						heatMap={heatMap}
						today={today}
						onItemClick={onItemClick}
						onAction={handleDayAction}
						selectedDate={selectedDate}
						prepDate={prepDate}
						commitPeriod={commitPeriodDates}
						scrollRef={scrollContainerRef}
						onScroll={handleScroll}
						projects={projects}
						renderItemTitle={renderItemTitle}
						pressureConnections={pressureConnections}
						onBackgroundClick={resetHighlights}
						flashingIds={flashingItemIds}
						volumeOnly={volumeOnly}
						targetItemId={targetItemId}
						rowHeight={rowHeight}
						completedByDate={completedByDate}
					/>
				)}
				{displayMode === 'gantt' && (
					<RyokanGanttView
						allDays={allDays}
						items={items}
						heatMap={heatMap}
						today={today}
						onItemClick={onItemClick}
						safeConfig={capacityConfig || { defaultDailyMinutes: 480, holidays: [], exceptions: {} }}
						rowHeight={24}
						projects={projects}
						onJumpToDate={(date) => {
							if (onSelectDate) onSelectDate(date);
						}}
						renderItemTitle={renderItemTitle}
						onUpdateItem={onUpdateItem}
						// Context Props
						capacityConfig={capacityConfig}
						currentUserId={currentUserId}
						joinedTenants={joinedTenants}
						focusedTenantId={focusedTenantId}
						focusedProjectId={focusedProjectId}
						showGroups={showGroups}
						onVisibleMonthChange={onVisibleMonthChange}
						scrollRef={scrollContainerRef}
						onDateClick={onDateClick}
					/>
				)}
			</div>

			{(selectedSigns.length > 0 || selectedDateCompleted) && (
				<div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
					<div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
						<div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0">
							<div>
								<h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
									{selectedDateCompleted ? '日の振り返り' : '負荷内訳'}
								</h3>
								<p className="text-sm text-slate-400 font-bold mt-1">
									{selectedDateCompleted
										? `${format(selectedDateCompleted.date, 'M月d日', { locale: ja })}の記録`
										: '選択された日の影響要因'
									}
								</p>
							</div>
							<button onClick={resetHighlights} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
								<X className="w-6 h-6 text-slate-400" />
							</button>
						</div>
						<div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
							{/* 完了タスクセクション */}
							{selectedDateCompleted && selectedDateCompleted.items.length > 0 && (
								<>
									<div className="flex items-center gap-2 px-1 pt-1 pb-2">
										<div className="w-2 h-2 rounded-full bg-emerald-500" />
										<span className="text-xs font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
											完了 ({selectedDateCompleted.items.length})
										</span>
									</div>
									{selectedDateCompleted.items.map((item: Item) => {
										const proj = projects.find(p => p.id === item.projectId);
										return (
											<div
												key={item.id}
												onClick={() => { onItemClick?.(item); resetHighlights(); }}
												className="group flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-emerald-200 dark:hover:border-emerald-800 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-all cursor-pointer bg-white dark:bg-slate-900 border-l-4 border-l-emerald-400 shadow-sm"
											>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-0.5">
														<span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
															{item.title}
														</span>
														{proj && (
															<span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
																{proj.title || proj.name}
															</span>
														)}
													</div>
													{item.completedAt && (
														<span className="text-[10px] text-emerald-500 flex items-center gap-1">
															完了: {format(new Date(item.completedAt * 1000), 'HH:mm')}
														</span>
													)}
												</div>
												<div className="opacity-0 group-hover:opacity-100 transition-opacity">
													<ChevronRight size={16} className="text-emerald-500" />
												</div>
											</div>
										);
									})}
								</>
							)}

							{/* 負荷タスクセクション */}
							{selectedSigns.length > 0 && (
								<>
									{selectedDateCompleted && (
										<div className="flex items-center gap-2 px-1 pt-3 pb-2 border-t border-slate-100 dark:border-slate-800 mt-2">
											<div className="w-2 h-2 rounded-full bg-indigo-500" />
											<span className="text-xs font-black text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">
												負荷 ({selectedSigns.length})
											</span>
										</div>
									)}
									{selectedSigns.map((item: Item) => {
										const proj = projects.find(p => p.id === item.projectId);
										return (
											<div
												key={item.id}
												onClick={() => { onItemClick?.(item); resetHighlights(); }}
												className={cn(
													"group flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer bg-white dark:bg-slate-900 border-l-4 shadow-sm",
													item.status === 'focus' ? "border-l-orange-400" :
														item.status === 'done' ? "border-l-emerald-400" :
															item.status === 'waiting' ? "border-l-amber-400" : "border-l-slate-300"
												)}
											>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-0.5">
														<span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
															{item.title}
														</span>
														{proj && (
															<span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
																{proj.title || proj.name}
															</span>
														)}
													</div>
													<div className="flex items-center gap-3">
														{item.due_date && (
															<span className="text-[10px] text-slate-400 flex items-center gap-1">
																期限: {safeFormat(item.due_date, 'MM/dd')}
															</span>
														)}
														{item.estimatedMinutes && (
															<span className="text-[10px] text-slate-400 flex items-center gap-1">
																工数: {Math.round(item.estimatedMinutes / 60 * 10) / 10}h
															</span>
														)}
													</div>
												</div>
												<div className="opacity-0 group-hover:opacity-100 transition-opacity">
													<ChevronRight size={16} className="text-indigo-500" />
												</div>
											</div>
										);
									})}
								</>
							)}
						</div>
					</div>
				</div>
			)}
			{/* Daily Capacity Editor Modal */}
			<SimpleModal
				isOpen={!!editingDate}
				onClose={() => setEditingDate(null)}
				title="日次稼働設定"
			>
				{editingDate && (() => {
					const dateKey = format(editingDate, 'yyyy-MM-dd');
					const initialTotal = capacityConfig?.exceptions?.[dateKey] ?? capacityConfig?.defaultDailyMinutes ?? 480;
					const initialAlloc = capacityConfig?.dailyCompanyExceptions?.[dateKey] ?? {};

					return (
						<DailyCapacityEditor
							date={editingDate}
							joinedTenants={joinedTenants}
							initialTotalMinutes={initialTotal}
							initialAllocation={initialAlloc}
							onSave={async (date, totalMinutes, allocation) => {
								if (onUpdateCapacityException) {
									onUpdateCapacityException(date, totalMinutes, allocation);
									setEditingDate(null);
								}
							}}
							onCancel={() => setEditingDate(null)}
						/>
					);
				})()}
			</SimpleModal>
		</div>
	);
});
