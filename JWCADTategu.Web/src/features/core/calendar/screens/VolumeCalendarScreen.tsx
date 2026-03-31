import React, { useState, useEffect } from 'react';
import { useVolumeCalendarViewModel } from '../viewmodels/useVolumeCalendarViewModel';
import { YOUKAN_KEYS, YOUKAN_EVENTS } from '../../session/youkanKeys';
import { useFilter } from '../../youkan/contexts/FilterContext';
import { RyokanCalendar } from '../../youkan/components/Calendar/RyokanCalendar';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth/providers/AuthProvider';
import { DecisionDetailModal } from '../../youkan/components/Modal/DecisionDetailModal';
import { Item } from '../../youkan/types';
import { ApiClient } from '../../../../api/client';
import { GanttHeader } from '../../youkan/components/Calendar/GanttHeader';
import { isValid } from 'date-fns';

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
	const [selectedDateForCapacity, setSelectedDateForCapacity] = useState<Date | null>(null); // [NEW] Track selected date for DailySettings
	const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'gantt'>(() => {
		return (localStorage.getItem(YOUKAN_KEYS.CALENDAR_VIEW_MODE) as any) || 'gantt';
	});
	const [showGanttGroups, setShowGanttGroups] = useState<boolean>(() => {
		const saved = localStorage.getItem(YOUKAN_KEYS.GANTT_SHOW_GROUPS);
		return saved !== 'false';
	});
	useEffect(() => {
		localStorage.setItem(YOUKAN_KEYS.GANTT_SHOW_GROUPS, showGanttGroups.toString());
	}, [showGanttGroups]);
	const { filterMode } = useFilter();
	const calendarRef = React.useRef<any>(null);

	useEffect(() => {
		const handleModeChange = (e: CustomEvent<{ mode: 'grid' | 'timeline' | 'gantt' }>) => {
			if (e.detail?.mode) setViewMode(e.detail.mode);
		};
		window.addEventListener(YOUKAN_EVENTS.CALENDAR_VIEW_MODE_CHANGE, handleModeChange as EventListener);
		return () => {
			window.removeEventListener(YOUKAN_EVENTS.CALENDAR_VIEW_MODE_CHANGE, handleModeChange as EventListener);
		};
	}, []);

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

	const items = React.useMemo(() => {
		return (rawItems || []).filter(item => {
			if (filterMode === 'all') return true;
			if (filterMode === 'personal') return !item.tenantId || item.tenantId === '';
			if (filterMode === 'company') return !!item.tenantId;
			return item.tenantId === filterMode;
		});
	}, [rawItems, filterMode]);

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
			await ApiClient.deleteItem(id);
			setSelectedItem(null);
			await refresh();
		} catch (e) {
			console.error('Delete failed', e);
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
			{/* Header Section (Unified GanttHeader) - [FIX] Show only in Gantt mode */}
			{viewMode === 'gantt' && (
				<GanttHeader
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
						calendarRef.current?.scrollToToday();
					}}
					onOpenDailySettings={() => calendarRef.current?.openDailySettings(selectedDateForCapacity || new Date())}
					rowHeight={24}
					onRowHeightChange={() => { }} // VolumeCalendar doesn't support rowHeight yet
					showGroups={showGanttGroups}
					onShowGroupsChange={setShowGanttGroups}
				/>
			)}

			<div className="flex-1 overflow-hidden relative">
				<RyokanCalendar
					ref={calendarRef}
					items={items || []}
					completedItems={completedItems || []}
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
