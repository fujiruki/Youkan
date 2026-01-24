
import { useState, useEffect, useCallback } from 'react';
import { startOfMonth, endOfMonth, format, addMonths, subMonths } from 'date-fns';
import { ApiClient } from '../../../../api/client';
import { Item } from '../../jbwos/types';
import { calculateAllocations, DailyLoadMap } from '../logic/AllocationCalculator';

export const useVolumeCalendarViewModel = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dailyLoads, setDailyLoads] = useState<DailyLoadMap>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Member selection (future scope used later)
    // const [currentMemberCapacity, setCurrentMemberCapacity] = useState(480);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
            const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');

            // Using generic request logic
            const items = await ApiClient.request<Item[]>('GET', `/calendar/items?start_date=${start}&end_date=${end}`);

            // Calculate Allocations
            // Assuming 480 (8h) for MVP or fetch from somewhere.
            const capacity = 480;

            const loads = calculateAllocations(items, capacity);
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
