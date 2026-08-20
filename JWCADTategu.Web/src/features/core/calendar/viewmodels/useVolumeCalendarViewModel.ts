import { useState, useEffect, useCallback, useRef } from 'react';
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from 'date-fns';
import { ApiClient } from '../../../../api/client';
import { Item } from '../../youkan/types';
import { useCapacityConfig } from '../../youkan/hooks/useCapacityConfig';

interface FilterProps {
	projectId?: string | null;
	tenantId?: string | null;
	viewMode?: string;
}

export const buildCalendarItemsQuery = ({
	start,
	end,
	projectId,
	tenantId,
	viewMode,
}: {
	start: string;
	end: string;
	projectId?: string | null;
	tenantId?: string | null;
	viewMode?: string;
}) => {
	let itemQuery = `/calendar/items?start_date=${start}&end_date=${end}`;
	if (viewMode === 'gantt') {
		itemQuery += `&mode=gantt`;
	}
	if (tenantId) {
		itemQuery += `&tenantId=${tenantId}`;
	}
	if (projectId) {
		itemQuery += `&projectId=${projectId}`;
	}
	return itemQuery;
};

export const useVolumeCalendarViewModel = (filters: FilterProps = {}) => {
	const [currentDate, setCurrentDate] = useState(new Date());
	const [items, setItems] = useState<Item[]>([]);
	const [completedItems, setCompletedItems] = useState<Item[]>([]);
	const [members, setMembers] = useState<any[]>([]);
	const [projects, setProjects] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { projectId, tenantId, viewMode } = filters;

	// [NEW] Use shared capacity hook
	const { capacityConfig, refreshCapacityConfig, toggleHoliday, updateCapacityConfig } = useCapacityConfig();

	// [R-151] 世代キャンセル: currentDate 連続変化時は前世代の取得を abort し、最後の1世代だけを state に反映する
	const abortRef = useRef<AbortController | null>(null);

	const loadData = useCallback(async () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;

		setLoading(true);
		try {
			// RyokanCalendar initially renders current month +/- 2 months.
			// Fetch the same buffered window so adjacent visible cells and backward allocations are populated.
			const start = format(startOfMonth(subMonths(currentDate, 2)), 'yyyy-MM-dd');
			const end = format(endOfMonth(addMonths(currentDate, 2)), 'yyyy-MM-dd');

			// Build Query Params
			let itemQuery = buildCalendarItemsQuery({ start, end, projectId, tenantId, viewMode });
			let completedQuery = `/calendar/completed?start_date=${start}&end_date=${end}`;
			if (tenantId) {
				completedQuery += `&tenantId=${tenantId}`;
			}

			const [fetchedItems, fetchedCompleted, rawMembers, fetchedProjects] = await Promise.all([
				ApiClient.request<Item[]>('GET', itemQuery, undefined, false, controller.signal),
				ApiClient.request<Item[]>('GET', completedQuery, undefined, false, controller.signal).catch(() => [] as Item[]),
				ApiClient.request<any[]>('GET', '/members', undefined, false, controller.signal),
				ApiClient.request<any[]>('GET', '/projects?scope=aggregated', undefined, false, controller.signal)
			]);

			// [R-151] abort 済み世代の応答は捨てる
			if (controller.signal.aborted) return;

			setItems(fetchedItems);
			setCompletedItems(fetchedCompleted);
			setMembers(rawMembers);
			setProjects(fetchedProjects);

			// Refresh capacity as well
			refreshCapacityConfig();

			setError(null);
		} catch (e: any) {
			if (controller.signal.aborted) return; // abort は正常系
			console.error(e);
			setError('データ読み込みに失敗しました');
		} finally {
			if (!controller.signal.aborted) {
				setLoading(false);
			}
		}
	}, [currentDate, projectId, tenantId, viewMode, refreshCapacityConfig]);

	useEffect(() => {
		loadData();
	}, [loadData]);

	// アンマウント時に飛行中の取得を中断する
	useEffect(() => () => abortRef.current?.abort(), []);

	const handleUpdateCapacityException = async (date: Date, totalMinutes: number, allocation: any) => {
		if (!capacityConfig) return;
		const dateKey = format(date, 'yyyy-MM-dd');

		const newExceptions = { ...(capacityConfig.exceptions || {}) };
		newExceptions[dateKey] = totalMinutes;

		const newDailyAllocs = { ...(capacityConfig.dailyCompanyExceptions || {}) };
		newDailyAllocs[dateKey] = allocation;

		await updateCapacityConfig({
			...capacityConfig,
			exceptions: newExceptions,
			dailyCompanyExceptions: newDailyAllocs
		});
	};

	return {
		currentDate,
		setCurrentDate,
		items,
		completedItems,
		members,
		projects,
		loading,
		error,
		startOfMonth: startOfMonth(currentDate),
		endOfMonth: endOfMonth(currentDate),
		handleNextMonth: () => setCurrentDate(addMonths(currentDate, 1)),
		handlePrevMonth: () => setCurrentDate(subMonths(currentDate, 1)),
		refresh: loadData,
		// [NEW] Expose capacity config
		capacityConfig,
		toggleHoliday,
		handleUpdateCapacityException // [NEW Phase 24] For Daily Settings
	};
};
