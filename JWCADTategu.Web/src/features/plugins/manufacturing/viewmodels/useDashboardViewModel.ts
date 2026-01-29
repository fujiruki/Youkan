import { useState, useEffect, useCallback } from 'react';
import { ApiClient } from '../../../../api/client';

export const useDashboardViewModel = () => {
    const [dailyTotalFabricationTime, setDailyTotalFabricationTime] = useState(0);
    const [dailyTotalSiteTime, setDailyTotalSiteTime] = useState(0);
    const [isStatusGroupingEnabled, setIsStatusGroupingEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const calculateTimes = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const todayView = await ApiClient.getTodayView();
            const items = todayView.items || [];

            let totalFab = 0;
            let totalSite = 0;

            // Fetch manufacturing data for each item
            const mfgPromises = items.map((item: any) => ApiClient.getManufacturingItem(item.id));
            const mfgResults = await Promise.all(mfgPromises);

            mfgResults.forEach((mfgData: any) => {
                if (mfgData) {
                    totalFab += mfgData.fab_minutes || 0;
                    totalSite += mfgData.site_minutes || 0;
                }
            });

            setDailyTotalFabricationTime(totalFab);
            setDailyTotalSiteTime(totalSite);
        } catch (err: any) {
            setError(err.message || 'Failed to calculate dashboard data');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        calculateTimes();
    }, [calculateTimes]);

    const toggleStatusGrouping = () => {
        setIsStatusGroupingEnabled(prev => !prev);
    };

    return {
        dailyTotalFabricationTime,
        dailyTotalSiteTime,
        isStatusGroupingEnabled,
        toggleStatusGrouping,
        loading,
        error,
        refresh: calculateTimes
    };
};
