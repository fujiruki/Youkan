import React, { useState, useEffect } from 'react';
import { useSmartContext } from './useSmartContext';
import { useQuantityMatrix } from './useQuantityMatrix';
import { QuantityCalendarGrid } from './QuantityCalendarGrid';
import { LocalFilterSwitcher } from './LocalFilterSwitcher';

interface DetailQuantityCalendarProps {
    item: { id: string; isPrivate?: boolean; title?: string } | null; // Generic item interface
    globalFilter: string;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    onSelectDate?: (date: Date) => void;
}

export const DetailQuantityCalendar: React.FC<DetailQuantityCalendarProps> = ({
    item,
    globalFilter,
    selectedDate,
    prepDate,
    onSelectDate
}) => {
    // 1. Determine Smart Context
    const smartContext = useSmartContext({ item, globalFilter });

    // 2. Allow Manual Override (Local State)
    const [activeContext, setActiveContext] = useState(smartContext);

    // Sync activeContext when smartContext changes (e.g. new item selected)
    useEffect(() => {
        setActiveContext(smartContext);
    }, [smartContext]);

    // 3. Fetch Matrix Data based on Active Context
    // Range: Today + 14 days? (Smaller range for detail view maybe?)
    // Let's stick to ~1 month to see context, or maybe 2 weeks.
    // Spec doesn't strictly say, but for "This Context", showing related load is key.
    const today = new Date();
    const startDate = today.toISOString().split('T')[0];
    const endDateObj = new Date(today);
    endDateObj.setDate(today.getDate() + 28); // 4 weeks
    const endDate = endDateObj.toISOString().split('T')[0];

    // Note: useQuantityMatrix requires 'all' | 'personal' | 'company' which matches context strings
    const { matrix, loading, error } = useQuantityMatrix(startDate, endDate, activeContext as any);

    return (
        <div className="flex flex-col gap-2 w-full max-w-sm border border-slate-200 dark:border-slate-700 rounded-lg p-2 bg-white dark:bg-slate-900 shadow-sm">
            {/* Header / Switcher */}
            <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-1">
                    Load Context
                </span>
                <div className="w-32">
                    <LocalFilterSwitcher
                        currentContext={activeContext}
                        onContextChange={setActiveContext}
                    />
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="overflow-hidden">
                {loading && <div className="p-4 text-xs text-slate-400 text-center">Loading...</div>}
                {error && <div className="p-4 text-xs text-red-500">Error: {error}</div>}

                {!loading && !error && (
                    <div className="scale-90 origin-top-left w-[111%]"> {/* Slight scale down to fit tight spaces if needed */}
                        <QuantityCalendarGrid
                            matrix={matrix}
                            startDate={startDate}
                            endDate={endDate}
                            selectedDate={selectedDate ? selectedDate.toISOString().split('T')[0] : null}
                            prepDate={prepDate ? prepDate.toISOString().split('T')[0] : null}
                            onCellClick={(dateStr) => {
                                if (onSelectDate) {
                                    onSelectDate(new Date(dateStr));
                                }
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Legend / Info */}
            <div className="flex gap-2 px-1">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500/20"></div>
                    <span className="text-[9px] text-slate-400">Low</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                    <span className="text-[9px] text-slate-400">High</span>
                </div>
                <div className="flex items-center gap-1 ml-auto">
                    <div className="w-0 h-0 border-l-[6px] border-b-[6px] border-l-transparent border-b-slate-400/50"></div>
                    <span className="text-[9px] text-slate-400">Over</span>
                </div>
            </div>
        </div>
    );
};
