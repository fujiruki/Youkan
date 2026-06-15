import React from 'react';
import { Item, Member, CapacityConfig, FilterMode, JoinedTenant } from '../../features/core/youkan/types';
import { RyokanCalendar } from '../../features/core/youkan/components/Calendar/RyokanCalendar';
import { cn } from '../../lib/utils';
import { YOUKAN_KEYS } from '../../features/core/session/youkanKeys';
import { ExternalEvent } from '../../features/core/youkan/types/externalEvent';
import { GoogleCalendar } from '../../api/googleCalendar';

type CalendarDensity = 'full' | 'compact';

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
	focusDate?: Date | null;
	forceScroll?: boolean;
	// R-061: 外部イベント
	externalEventsByDate?: Map<string, ExternalEvent[]>;
	googleCalendars?: GoogleCalendar[];
}

const DetailQuantityCalendarInner: React.FC<DetailQuantityCalendarProps> = ({
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
	focusDate,
	forceScroll,
	externalEventsByDate,
	googleCalendars,
}) => {
	const [isVolumeOnly, setIsVolumeOnly] = React.useState(false);

	const [filterMode, setFilterMode] = React.useState<FilterMode>(() => {
		if (_item) {
			const isPersonal = !_item.tenantId || _item.domain === 'private';
			return isPersonal ? 'personal' : 'company';
		}
		return globalFilter;
	});

	// R-061: 表示密度（localStorage永続化）
	const [density, setDensity] = React.useState<CalendarDensity>(() => {
		try {
			const saved = localStorage.getItem(YOUKAN_KEYS.DETAIL_CALENDAR_DENSITY);
			if (saved === 'compact') return 'compact';
		} catch { /* noop */ }
		return 'full';
	});

	const handleDensityToggle = React.useCallback(() => {
		setDensity(prev => {
			const next: CalendarDensity = prev === 'full' ? 'compact' : 'full';
			try {
				localStorage.setItem(YOUKAN_KEYS.DETAIL_CALENDAR_DENSITY, next);
			} catch { /* noop */ }
			return next;
		});
	}, []);

	React.useEffect(() => {
		if (_item) {
			const isPersonal = !_item.tenantId || _item.domain === 'private';
			setFilterMode(isPersonal ? 'personal' : 'company');
		}
	}, [_item?.id, _item?.tenantId, _item?.domain]);

	const filteredItems = React.useMemo(() => {
		if (filterMode === 'all') return items;
		if (filterMode === 'company') return items.filter(i => !!i.tenantId || i.domain === 'business');
		if (filterMode === 'personal') return items.filter(i => !i.tenantId && i.domain !== 'business');
		return items.filter(i => i.tenantId === filterMode);
	}, [items, filterMode]);

	return (
		<div className="flex flex-col w-full h-full border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
			{/* Minimal Header with Toggle */}
			<div className="flex items-center justify-between px-2 py-1 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-800 shrink-0">
				<div className="flex items-center gap-1">
					{/* Filter Buttons (All / Personal / Company) */}
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

				<div className="flex items-center gap-1">
					{/* R-061: 密度トグル */}
					<button
						data-testid="density-toggle-btn"
						onClick={handleDensityToggle}
						className={cn(
							"text-[9px] px-1.5 py-0.5 rounded border transition-colors font-bold tracking-tighter",
							density === 'compact'
								? 'bg-slate-100 text-slate-600 border-slate-300'
								: 'bg-white text-slate-400 border-slate-200 shadow-sm'
						)}
					>
						{density === 'full' ? 'FULL' : 'COMPACT'}
					</button>

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
			</div>

			<div className="flex-1 overflow-hidden relative">
				<RyokanCalendar
					items={filteredItems}
					members={members}
					capacityConfig={capacityConfig}
					projects={projects}
					joinedTenants={joinedTenants}
					currentUserId={currentUserId || (() => { try { const u = JSON.parse(localStorage.getItem(YOUKAN_KEYS.USER) || '{}'); return u?.id || null; } catch { return null; } })()}

					layoutMode={density === 'full' ? 'panorama' : 'mini'}
					displayMode="grid"
					filterMode={filterMode}
					// 量感母集団は左上フィルタ（全て/個人/会社）に連動。
					// アイテムの所属プロジェクト/テナントでは量感を絞り込まない（R-062）

					selectedDate={selectedDate}
					prepDate={prepDate}
					focusDate={focusDate || selectedDate || prepDate || new Date()}
					onSelectDate={onSelectDate}

					volumeOnly={isVolumeOnly}
					hideHeader={true}

					targetItemId={targetItemId}
					commitPeriod={commitPeriod}

					disablePressureLines={true}
					forceScroll={forceScroll}

					externalEventsByDate={externalEventsByDate}
					googleCalendars={googleCalendars}
				/>
			</div>
		</div>
	);
};

export const DetailQuantityCalendar = React.memo(DetailQuantityCalendarInner);
