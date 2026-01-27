import { useState, useEffect, useCallback } from 'react';
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from 'date-fns';
import { ApiClient } from '../../../../api/client';
import { Item } from '../../jbwos/types';
import { calculateAllocations, DailyLoadMap } from '../logic/AllocationCalculator';
import { createCapacityProvider } from '../logic/CapacityFactory';
import { DEFAULT_CAPACITY_CONFIG } from '../../jbwos/logic/volumeCalculator';

// Define Member interface locally or import if available
interface CalendarMember {
    id: string;
    is_core: number; // SQLite boolean often number
    daily_capacity_minutes: number;
}

export const useVolumeCalendarViewModel = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dailyLoads, setDailyLoads] = useState<DailyLoadMap>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
            const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

            // Parallel fetch: Items and Members
            // Note: /members API returns snake_case, mapping to CamelCase manually
            const [items, rawMembers] = await Promise.all([
                ApiClient.request<Item[]>('GET', `/calendar/items?start_date=${start}&end_date=${end}`),
                ApiClient.request<CalendarMember[]>('GET', '/members')
            ]);

            const members = rawMembers.map(m => ({
                id: m.id,
                userId: m.id, // Fallback
                display_name: 'Unknown', // Fallback
                role: 'user', // Fallback
                isCore: Boolean(m.is_core),
                dailyCapacityMinutes: m.daily_capacity_minutes || 480
            } as any)); // Type assertion to satisfy Member interface partially for CapacityFactory

            // 2. Create Capacity Strategy (Logic Layer)
            // Ideally fetch config from API: const config = await ApiClient.getCapacityConfig();
            const config = DEFAULT_CAPACITY_CONFIG;
            const getCapacityForDate = createCapacityProvider(members, config);

            const loads = calculateAllocations(items, getCapacityForDate);
            setDailyLoads(loads);
            setError(null);
        } catch (e: any) {
            console.error(e);
            setError('Failed to load calendar data');
        } finally {
            setLoading(false);
        }
    }, [currentDate]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    return {
        currentDate,
        dailyLoads,
        loading,
        error,
        nextMonth,
        prevMonth,
        refresh: loadData
    };
};
