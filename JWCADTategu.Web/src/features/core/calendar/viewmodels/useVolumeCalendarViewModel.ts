import { useState, useEffect, useCallback } from 'react';
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from 'date-fns';
import { ApiClient } from '../../../../api/client';
import { Item } from '../../jbwos/types';
import { calculateAllocations, DailyLoadMap } from '../logic/AllocationCalculator';
import { isHoliday } from '../../jbwos/logic/capacity';
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
            const [items, members] = await Promise.all([
                ApiClient.request<Item[]>('GET', `/calendar/items?start_date=${start}&end_date=${end}`),
                ApiClient.request<CalendarMember[]>('GET', '/members')
            ]);

            // Calculate Total Core Capacity
            // Note: is_core might be number (1/0) or boolean depending on API
            const totalCoreCapacity = members
                .filter(m => Boolean(m.is_core))
                .reduce((sum, m) => sum + (m.daily_capacity_minutes || 480), 0);

            // Strategy Function
            const getCapacityForDate = (date: Date): number => {
                // 1. Check Holiday (using default config for now)
                if (isHoliday(date, DEFAULT_CAPACITY_CONFIG)) {
                    return 0;
                }
                // 2. Return Team Capacity
                return totalCoreCapacity > 0 ? totalCoreCapacity : 480; // Fallback to 1 person if 0
            };

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
