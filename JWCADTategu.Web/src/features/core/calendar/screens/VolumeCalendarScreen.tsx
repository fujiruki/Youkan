import React, { useState, useEffect } from 'react';
import { useVolumeCalendarViewModel } from '../viewmodels/useVolumeCalendarViewModel';
import { YOUKAN_KEYS, YOUKAN_EVENTS } from '../../session/youkanKeys';
import { RyokanCalendar } from '../../jbwos/components/Calendar/RyokanCalendar';
import { Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../../auth/providers/AuthProvider';
import { DecisionDetailModal } from '../../jbwos/components/Modal/DecisionDetailModal';
import { Item } from '../../jbwos/types';
import { ApiClient } from '../../../../api/client';
import { GanttHeader } from '../../jbwos/components/Calendar/GanttHeader';
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
	const [viewMode, setViewMode] = useState<'grid' | 'timeline' | 'gantt'>(() => {
		return (localStorage.getItem(YOUKAN_KEYS.CALENDAR_VIEW_MODE) as any) || 'gantt';
	});
	const [filterMode, setFilterMode] = useState<string>(() => {
		return localStorage.getItem(YOUKAN_KEYS.FILTER_MODE) || 'all';
	});
	const calendarRef = React.useRef<any>(null);

	useEffect(() => {
		const handleModeChange = (e: CustomEvent<{ mode: 'grid' | 'timeline' | 'gantt' }>) => {
			if (e.detail?.mode) setViewMode(e.detail.mode);
		};
		const handleFilterChange = (e: any) => {
			if (e.detail?.mode) setFilterMode(e.detail.mode);
		};
		window.addEventListener(YOUKAN_EVENTS.CALENDAR_VIEW_MODE_CHANGE, handleModeChange as EventListener);
		window.addEventListener(YOUKAN_EVENTS.FILTER_CHANGE, handleFilterChange as EventListener);
		return () => {
			window.removeEventListener(YOUKAN_EVENTS.CALENDAR_VIEW_MODE_CHANGE, handleModeChange as EventListener);
			window.removeEventListener(YOUKAN_EVENTS.FILTER_CHANGE, handleFilterChange as EventListener);
		};
	}, []);

	const {
		currentDate, setCurrentDate,
		items: rawItems, members, projects, loading, error,
		handlePrevMonth, handleNextMonth, refresh,
		capacityConfig // [NEW]
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
			{/* Header Section (Unified GanttHeader) */}
			<GanttHeader
				visibleDate={currentDate}
				onPrevMonth={handlePrevMonth}
				onNextMonth={handleNextMonth}
				onGoToCurrentMonth={() => {
					setCurrentDate(new Date());
					calendarRef.current?.scrollToToday();
				}}
				onOpenDailySettings={() => calendarRef.current?.openDailySettings()}
				rowHeight={24}
				onRowHeightChange={() => { }} // VolumeCalendar doesn't support rowHeight yet
				showGroups={true}
				onShowGroupsChange={() => { }}
			/>

			<div className="flex-1 overflow-hidden relative">
				<RyokanCalendar
					ref={calendarRef}
					items={items || []}
					members={members || []}
					projects={projects || []}
					focusedProjectId={activeProjectId}
					focusedTenantId={activeTenantId}
					currentUserId={auth.user?.id}
					onItemClick={setSelectedItem}
					displayMode={viewMode}
					focusDate={currentDate}
					onUpdateItem={handleUpdate}
					capacityConfig={capacityConfig} // [NEW]
					joinedTenants={auth.joinedTenants} // [NEW]
					onVisibleMonthChange={(date) => {
						if (isValid(date) && (date.getMonth() !== currentDate.getMonth() || date.getFullYear() !== currentDate.getFullYear())) {
							setCurrentDate(new Date(date.getFullYear(), date.getMonth(), 1));
						}
					}}
					hideHeader={true}
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
