import { useState, useEffect, useCallback } from 'react';
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from 'date-fns';
import { ApiClient } from '../../../../api/client';
import { Item } from '../../youkan/types';
import { useCapacityConfig } from '../../youkan/hooks/useCapacityConfig';

interface FilterProps {
	projectId?: string | null;
	tenantId?: string | null;
}

export const useVolumeCalendarViewModel = (filters: FilterProps = {}) => {
	const [currentDate, setCurrentDate] = useState(new Date());
	const [items, setItems] = useState<Item[]>([]);
	const [completedItems, setCompletedItems] = useState<Item[]>([]);
	const [members, setMembers] = useState<any[]>([]);
	const [projects, setProjects] = useState<any[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { projectId, tenantId } = filters;

	// [NEW] Use shared capacity hook
	const { capacityConfig, refreshCapacityConfig, toggleHoliday, updateCapacityConfig } = useCapacityConfig();

	const loadData = useCallback(async () => {
		setLoading(true);
		try {
			const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
			const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

			// Build Query Params
			let itemQuery = `/calendar/items?start_date=${start}&end_date=${end}`;
			let completedQuery = `/calendar/completed?start_date=${start}&end_date=${end}`;
			if (tenantId) {
				itemQuery += `&tenantId=${tenantId}`;
				completedQuery += `&tenantId=${tenantId}`;
			}
			if (projectId) {
				itemQuery += `&projectId=${projectId}`;
			}

			const [fetchedItems, fetchedCompleted, rawMembers, fetchedProjects] = await Promise.all([
				ApiClient.request<Item[]>('GET', itemQuery),
				ApiClient.request<Item[]>('GET', completedQuery).catch(() => [] as Item[]),
				ApiClient.request<any[]>('GET', '/members'),
				ApiClient.request<any[]>('GET', '/projects')
			]);

			setItems(fetchedItems);
			setCompletedItems(fetchedCompleted);
			setMembers(rawMembers);
			setProjects(fetchedProjects);

			// Refresh capacity as well
			refreshCapacityConfig();

			setError(null);
		} catch (e: any) {
			console.error(e);
			setError('データ読み込みに失敗しました');
		} finally {
			setLoading(false);
		}
	}, [currentDate, projectId, tenantId, refreshCapacityConfig]);

	useEffect(() => {
		loadData();
	}, [loadData]);

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
