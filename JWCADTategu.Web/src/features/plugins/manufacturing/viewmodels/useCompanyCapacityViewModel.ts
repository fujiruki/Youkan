import { useState, useEffect, useCallback, useMemo } from 'react';
import { ApiClient } from '../../../../api/client';

export interface DailyLoad {
    date: string;
    occupancy: number; // minutes
    fullnessPercentage: number;
}

export const useCompanyCapacityViewModel = (yearMonth: string) => {
    const [members, setMembers] = useState<any[]>([]);
    const [dailyData, setDailyData] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const totalDailyCapacity = useMemo(() => {
        return members
            .filter(m => m.is_core_member)
            .reduce((sum, m) => sum + (m.daily_capacity_minutes || 0), 0);
    }, [members]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            // 1. Fetch Members
            const memberData = await ApiClient.getCompanyMembers();
            setMembers(memberData);

            // 2. Fetch Items for the scope (simplified for now: get all then filter)
            // In a real app, we would use yearMonth to filter on server.
            const items = await ApiClient.getAllItems({ scope: 'company' });

            // 3. Fetch Mfg details and aggregate
            const mfgPromises = items.map(async (item: any) => {
                const mfg = await ApiClient.getManufacturingItem(item.id);
                return { date: item.due_date, fab: mfg?.fab_minutes || 0, site: mfg?.site_minutes || 0 };
            });

            const results = await Promise.all(mfgPromises);
            const loadMap: Record<string, number> = {};

            results.forEach(res => {
                if (!res.date) return;
                const total = res.fab + res.site;
                loadMap[res.date] = (loadMap[res.date] || 0) + total;
            });

            setDailyData(loadMap);
        } catch (err: any) {
            setError(err.message || 'Failed to fetch capacity data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData, yearMonth]);

    const getDailyStats = (date: string): DailyLoad => {
        const occupancy = dailyData[date] || 0;
        const capacity = totalDailyCapacity || 1; // Avoid div by zero
        return {
            date,
            occupancy,
            fullnessPercentage: Math.round((occupancy / capacity) * 100)
        };
    };

    return {
        totalDailyCapacity,
        getDailyStats,
        loading,
        error,
        refresh: fetchData
    };
};
