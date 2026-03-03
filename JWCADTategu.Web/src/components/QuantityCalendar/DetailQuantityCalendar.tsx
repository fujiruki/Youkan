import React from 'react';
import { Item, Member, CapacityConfig, FilterMode, JoinedTenant } from '../../features/core/youkan/types';
import { RyokanCalendar } from '../../features/core/youkan/components/Calendar/RyokanCalendar';
import { cn } from '../../lib/utils';
import { YOUKAN_KEYS } from '../../features/core/session/youkanKeys';

interface DetailQuantityCalendarProps {
	item: Item | null;
	globalFilter: FilterMode;
	selectedDate?: Date | null;
	prepDate?: Date | null;
	onSelectDate?: (date: Date) => void;
	// Data Props
	items?: Item[];
	members?: Member[];
	capacityConfig?: CapacityConfig;
	projects?: Item[];
	joinedTenants?: JoinedTenant[];
	currentUserId?: string | null;
	targetItemId?: string;
	commitPeriod?: Date[];
	focusDate?: Date | null; // [NEW] Allow external control of focus
}

export const DetailQuantityCalendar: React.FC<DetailQuantityCalendarProps> = ({
	item: _item,
	globalFilter,
	selectedDate,
	prepDate,
	onSelectDate,
	items = [],
	members = [],
	capacityConfig,
	projects = [],
	joinedTenants = [],
	currentUserId,
	targetItemId,
	commitPeriod,
	focusDate
}) => {
	// [NEW] Local Volume Only Toggle
	const [isVolumeOnly, setIsVolumeOnly] = React.useState(false);

	// [NEW] Local Filter Mode with auto-selection logic
	const [filterMode, setFilterMode] = React.useState<FilterMode>(() => {
		// Default based on item ownership: No tenantId means personal
		if (_item) {
			const isPersonal = !_item.tenantId || _item.domain === 'private';
			return isPersonal ? 'personal' : 'company';
		}
		return globalFilter;
	});

	// Handle item changes to re-sync filter if needed
	React.useEffect(() => {
		if (_item) {
			const isPersonal = !_item.tenantId || _item.domain === 'private';
			setFilterMode(isPersonal ? 'personal' : 'company');
		}
	}, [_item?.id, _item?.tenantId, _item?.domain]);

	// [FIX] Apply filterMode to items locally (QuantityEngine no longer filters)
	const filteredItems = React.useMemo(() => {
		if (filterMode === 'all') return items;
		if (filterMode === 'company') return items.filter(i => !!i.tenantId || i.domain === 'business');
		if (filterMode === 'personal') return items.filter(i => !i.tenantId && i.domain !== 'business');
		// tenantId string
		return items.filter(i => i.tenantId === filterMode);
	}, [items, filterMode]);

	return (
		<div className="flex flex-col w-full h-full border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
			{/* Minimal Header with Toggle */}
			<div className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 shrink-0">
				<div className="flex items-center gap-1">
					{/* [NEW] Filter Buttons (All / Personal / Company) */}
					<div className="flex bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded p-0.5 shadow-sm scale-90 origin-left">
						{[
							{ id: 'all', label: '全て' },
							{ id: 'personal', label: '個人' },
							{ id: 'company', label: '会社' }
						].map((m) => (
							<button
								key={m.id}
								onClick={() => setFilterMode(m.id as FilterMode)}
								className={cn(
									"px-2 py-0.5 text-[10px] font-black rounded transition-all",
									filterMode === m.id
										? "bg-indigo-600 text-white shadow-sm"
										: "text-slate-400 hover:text-slate-600"
								)}
							>
								{m.label}
							</button>
						))}
					</div>
				</div>

				<button
					onClick={() => setIsVolumeOnly(!isVolumeOnly)}
					className={cn(
						"text-[9px] px-1.5 py-0.5 rounded border transition-colors font-bold tracking-tighter",
						isVolumeOnly
							? 'bg-indigo-100 text-indigo-600 border-indigo-200'
							: 'bg-white text-slate-400 border-slate-200 shadow-sm'
					)}
				>
					{isVolumeOnly ? 'VOL ONLY' : 'DETAIL'}
				</button>
			</div>

			<div className="flex-1 overflow-hidden relative">
				<RyokanCalendar
					items={filteredItems}
					members={members}
					capacityConfig={capacityConfig}
					projects={projects}
					joinedTenants={joinedTenants}
					currentUserId={currentUserId || (() => { try { const u = JSON.parse(localStorage.getItem(YOUKAN_KEYS.USER) || '{}'); return u?.id || null; } catch { return null; } })()}

					layoutMode="mini"
					displayMode="grid"
					filterMode={filterMode}
					focusedTenantId={_item?.tenantId}
					focusedProjectId={_item?.projectId}

					selectedDate={selectedDate} // Due Date (Red)
					prepDate={prepDate}         // My Deadline (Blue)
					focusDate={focusDate || selectedDate || prepDate || new Date()} // 納期 > マイ期限 > 今月 の優先順位
					onSelectDate={onSelectDate} // Handle click to set date

					volumeOnly={isVolumeOnly}
					hideHeader={true}  // Hide standard header

					targetItemId={targetItemId}
					commitPeriod={commitPeriod}

					// Allow default RyokanCalendar behavior for dateClick (Show Breakdown)
					disablePressureLines={true} // [NEW] Disable pressure lines in detail modal
				/>
			</div>
		</div>
	);
};
