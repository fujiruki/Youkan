import React, { useState, useEffect } from 'react';
import { useVolumeCalendarViewModel } from '../viewmodels/useVolumeCalendarViewModel';
import { YOUKAN_KEYS } from '../../session/youkanKeys';
import { useFilter } from '../../youkan/contexts/FilterContext';
import { useViewMode } from '../../youkan/contexts/ViewModeContext';
import { RyokanCalendar } from '../../youkan/components/Calendar/RyokanCalendar';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth/providers/AuthProvider';
import { DecisionDetailModal } from '../../youkan/components/Modal/DecisionDetailModal';
import { Item } from '../../youkan/types';
import { ApiClient } from '../../../../api/client';
import { CalendarHeader } from '../../youkan/components/Calendar/CalendarHeader';
import { CalendarToggleButton } from '../../youkan/components/Calendar/CalendarToggleButton';
import { applyGanttCompletedFilter } from '../../youkan/logic/filterUtils';
import { isValid } from 'date-fns';
import { useExternalEvents } from '../../youkan/hooks/useExternalEvents';
import { useGoogleCalendars } from '../../youkan/hooks/useGoogleCalendars';

interface Props {
	onNavigateHome: () => void;
	activeProjectId?: string | null;
	activeTenantId?: string | null;
}

export const VolumeCalendarScreen: React.FC<Props> = ({
	activeProjectId,
	activeTenantId
}) => {
	const auth = useAuth();
	const [selectedItem, setSelectedItem] = useState<Item | null>(null);
	const [selectedDateForCapacity, setSelectedDateForCapacity] = useState<Date | null>(null);
	const { calendarViewMode: viewMode } = useViewMode();
	const [showGanttGroups, setShowGanttGroups] = useState<boolean>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.GANTT_SHOW_GROUPS);
		return saved !== 'false';
	});
	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.GANTT_SHOW_GROUPS, showGanttGroups.toString());
	}, [showGanttGroups]);

	const { filterMode, hideCompleted } = useFilter();
	const calendarRef = React.useRef<any>(null);

	const {
		currentDate, setCurrentDate,
		items: rawItems, completedItems, members, projects, loading, error,
		handlePrevMonth, handleNextMonth, refresh,
		capacityConfig,
		handleUpdateCapacityException
	} = useVolumeCalendarViewModel({
		projectId: activeProjectId,
		tenantId: activeTenantId
	});

	const filterByMode = React.useCallback((item: Item) => {
		if (filterMode === 'all') return true;
		if (filterMode === 'personal') return !item.tenantId || item.tenantId === '';
		if (filterMode === 'company') return !!item.tenantId;
		return item.tenantId === filterMode;
	}, [filterMode]);

	const items = React.useMemo(() => {
		return (rawItems || []).filter(filterByMode);
	}, [rawItems, filterByMode]);

	const filteredCompletedItems = React.useMemo(() => {
		return (completedItems || []).filter(filterByMode);
	}, [completedItems, filterByMode]);

	// R-034 Phase 2 / R-039 Phase 3 UX / R-042-Y1: Google カレンダー外部イベントを取得
	// 取得対象ビューの判定は useExternalEvents 内部で「表示するビュー」設定（ykn_external_events_views）に基づき行う
	// R-042-Y1: 初期取得範囲を ±6 ヶ月（計 13 ヶ月）に拡大。月単位キャッシュにより重複 fetch は抑制される。
	const externalRange = React.useMemo(() => {
		const base = new Date(currentDate);
		const start = new Date(base.getFullYear(), base.getMonth() - 6, 1);
		// 月末は翌月 0 日で算出（+7 ヶ月の 0 日 = +6 ヶ月の月末）
		const end = new Date(base.getFullYear(), base.getMonth() + 7, 0);
		const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
		return { from: ymd(start), to: ymd(end) };
	}, [currentDate]);
	const externalViewMode = viewMode === 'grid' || viewMode === 'gantt' || viewMode === 'timeline'
		? viewMode
		: undefined;
	// R-042-Y2 で sentinel から呼ぶための loadMore / loadedRange / isLoadingMore を取得
	// （Y1 では呼び出し側で未使用。Y2 で props 経路を通す）
	const {
		eventsByDate: externalEventsByDate,
		loadMore: externalLoadMore,
		loadedRange: externalLoadedRange,
		isLoadingMore: externalIsLoadingMore,
		loadDirection: externalLoadDirection,
	} = useExternalEvents(
		externalRange.from,
		externalRange.to,
		externalViewMode
	);
	// R-041-Y3: イベントチップにカレンダー色を反映するため、Google カレンダー一覧を取得
	const { calendars: googleCalendars } = useGoogleCalendars();
	// R-042-Y2: sentinel から呼ぶ lazy load コールバック。
	// useExternalEvents.loadMore はそのまま渡せばよい（direction / months 引数の意味は一致）。

	/**
	 * R-065: 右上「完了非表示」ボタン（FilterContext.hideCompleted）に統一。
	 * hideCompleted=false → 完了表示（items + completedItems をマージ）
	 * hideCompleted=true  → 完了非表示（items のみ）
	 */
	const visibleItems = React.useMemo(() => {
		const showCompleted = !hideCompleted;
		const merged = showCompleted ? [...items, ...filteredCompletedItems] : items;
		return applyGanttCompletedFilter(merged, showCompleted);
	}, [items, filteredCompletedItems, hideCompleted]);

	const handleUpdate = async (id: string, updates: Partial<Item>) => {
		try {
			await ApiClient.updateItem(id, updates);
			await refresh();
		} catch (e) {
			console.error('Update failed', e);
		}
	};

	const handleDelete = async (id: string) => {
		try {
			await ApiClient.trashItem(id);
			setSelectedItem(null);
			await refresh();
		} catch (e) {
			console.error('Delete failed', e);
			throw e;
		}
	};

	const handleDecision = async (id: string, decision: 'yes' | 'hold' | 'no', note?: string, updates?: Partial<Item>) => {
		try {
			// 1. Apply updates first (if any)
			if (updates && Object.keys(updates).length > 0) {
				await ApiClient.updateItem(id, updates);
			}

			// 2. Resolve Decision (Server handles status and logs)
			await ApiClient.resolveDecision(id, decision, note);

			setSelectedItem(null);
			await refresh();
		} catch (e) {
			console.error('Decision failed', e);
		}
	};

	if (loading && !items.length) {
		return (
			<div className="flex items-center justify-center p-20 text-slate-500 gap-2 h-full bg-slate-50 dark:bg-slate-900">
				<Loader2 className="w-5 h-5 animate-spin" />
				<span>読み込み中...</span>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex items-center justify-center p-20 text-red-500 gap-2 h-full bg-slate-50 dark:bg-slate-900">
				<AlertCircle className="w-5 h-5" />
				<span>{error}</span>
				<button onClick={refresh} className="text-blue-500 underline text-sm">再試行</button>
			</div>
		);
	}

	return (
		<div className="flex flex-col h-full bg-slate-50 dark:bg-slate-900 overflow-hidden">
			{/* [R-038] Header Section（CalendarHeader）-
			    gantt: 全機能 / grid: 月切替＋今月＋日次設定のみ。
			    どちらのモードでも年月表示はスクロール追従し、「今月を表示」ボタンで
			    今月 1 日のセルを中央付近に再配置できる（RyokanCalendar 側で対応）。 */}
			{(viewMode === 'gantt' || viewMode === 'grid') && (
				<CalendarHeader
					variant={viewMode === 'gantt' ? 'gantt' : 'grid'}
					visibleDate={currentDate}
					onPrevMonth={() => {
						handlePrevMonth();
						const next = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1);
						calendarRef.current?.scrollToMonth(next.getFullYear(), next.getMonth());
					}}
					onNextMonth={() => {
						handleNextMonth();
						const next = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
						calendarRef.current?.scrollToMonth(next.getFullYear(), next.getMonth());
					}}
					onGoToCurrentMonth={() => {
						setCurrentDate(new Date());
						setTimeout(() => {
							calendarRef.current?.scrollToToday();
						}, 0);
					}}
					onOpenDailySettings={() => calendarRef.current?.openDailySettings(selectedDateForCapacity || new Date())}
					rowHeight={24}
					onRowHeightChange={() => { }} // VolumeCalendar doesn't support rowHeight yet
					showGroups={showGanttGroups}
					onShowGroupsChange={setShowGanttGroups}
					extraActions={<CalendarToggleButton />}
				/>
			)}

			<div className="flex-1 overflow-hidden relative">
				<RyokanCalendar
					ref={calendarRef}
					items={visibleItems || []}
					completedItems={hideCompleted ? [] : (filteredCompletedItems || [])}
					members={members || []}
					projects={projects || []}
					focusedProjectId={activeProjectId}
					focusedTenantId={activeTenantId}
					currentUserId={auth.user?.id}
					onItemClick={setSelectedItem}
					displayMode={viewMode}
					focusDate={currentDate}
					onUpdateItem={handleUpdate}
					capacityConfig={capacityConfig}
					onUpdateCapacityException={handleUpdateCapacityException}
					joinedTenants={auth.joinedTenants}
					onDateClick={setSelectedDateForCapacity}
					onVisibleMonthChange={(date) => {
						if (isValid(date) && (date.getMonth() !== currentDate.getMonth() || date.getFullYear() !== currentDate.getFullYear())) {
							setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
						}
					}}
					hideHeader={true}
					showGroups={showGanttGroups}
					onDeleteItem={handleDelete}
					externalEventsByDate={externalEventsByDate}
					googleCalendars={googleCalendars}
					onLoadMore={externalLoadMore}
					isLoadingMore={externalIsLoadingMore}
					loadDirection={externalLoadDirection}
					loadedRange={externalLoadedRange}
				/>
			</div>

			{selectedItem && (
				<DecisionDetailModal
					item={selectedItem}
					onClose={() => setSelectedItem(null)}
					onUpdate={handleUpdate}
					onDelete={handleDelete}
					onDecision={handleDecision}
					members={members}
					allProjects={projects}
					joinedTenants={auth.joinedTenants || []} // [FIX] Pass joined tenants
					onOpenItem={setSelectedItem}
					quantityItems={items}
					filterMode={activeTenantId ? 'company' : 'personal'}
					capacityConfig={capacityConfig} // [FIX] Pass capacity config
				/>
			)}
		</div>
	);
};
