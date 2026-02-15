import React from 'react';
import { QuantityCalendarGrid } from '../../../../../components/QuantityCalendar/QuantityCalendarGrid';
import { useQuantityMatrix } from '../../../../../components/QuantityCalendar/useQuantityMatrix';

export const MainQuantityCalendar: React.FC = () => {
    // TODO: Integrate with actual global filter state from context/recoil
    const filter = 'all'; // Temporary Mock

    // Date Range: Today + 4 weeks (approx 1 month)
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDateObj = new Date(today);
    endDateObj.setDate(today.getDate() + 28);
    const endDate = endDateObj.toISOString().split('T')[0];

    // Fix: Pass 'context' explicitly as required by hook
    const { matrix, loading, error } = useQuantityMatrix(startDate, endDate, filter as any);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm">
            <div className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                    Quantity Calendar ({filter.toUpperCase()})
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto">
                {loading && <div className="p-4 text-xs text-slate-400">Loading...</div>}
                {error && <div className="p-4 text-xs text-red-500">Error: {error}</div>}

                {!loading && !error && (
                    <QuantityCalendarGrid
                        matrix={matrix}
                        startDate={startDate}
                        endDate={endDate}
                        onCellClick={(date) => console.log('Clicked', date)}
                    />
                )}
            </div>
        </div>
    );
};
