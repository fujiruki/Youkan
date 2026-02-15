import React from 'react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { QuantityCalendarGrid } from './QuantityCalendarGrid';
import { useQuantityMatrix } from './useQuantityMatrix';
import { Item, FilterMode, CapacityConfig } from '../../features/core/jbwos/types';

interface MonthlyGridWrapperProps {
    monthDate: Date;

    // Props passed down
    filterMode: FilterMode;
    capacityConfig?: CapacityConfig;
    currentItem?: Item;

    selectedDate?: Date | null;
    prepDate?: Date | null;
    onSelectDate?: (date: Date) => void;

    displayMode?: 'default' | 'volume_only';
    seamless?: boolean;
    isFirstMonth?: boolean;
}

export const MonthlyGridWrapper: React.FC<MonthlyGridWrapperProps> = ({
    monthDate,
    filterMode,
    capacityConfig,
    currentItem,
    selectedDate,
    prepDate,
    onSelectDate,
    displayMode = 'default',
    seamless = false,
    isFirstMonth = false
}) => {
    // Determine fetch range for this month
    const startDate = startOfMonth(monthDate);
    const endDate = endOfMonth(monthDate);

    // Fetch data for this specific month (API expects YYYY-MM-DD strings)
    const { matrix, loading } = useQuantityMatrix(
        format(startDate, 'yyyy-MM-dd'),
        format(endDate, 'yyyy-MM-dd'),
        filterMode === 'all' ? 'all' : filterMode === 'company' ? 'company' : 'personal'
    );

    const rootClass = seamless ? "contents" : "w-full relative";

    return (
        <div className={rootClass}>
            {/* Standard Header (only if not seamless) */}
            {!seamless && (
                <div className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm py-1 px-2 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500">
                    {format(monthDate, 'yyyy年 M月')}
                </div>
            )}

            <div className={`min-h-[100px] transition-opacity ${loading ? 'opacity-50' : 'opacity-100'} ${seamless ? "contents" : ""}`}>
                <QuantityCalendarGrid
                    matrix={matrix}
                    startDate={startDate}
                    endDate={endDate}
                    onCellClick={(dateStr) => onSelectDate?.(new Date(dateStr))}
                    selectedDate={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : null}
                    prepDate={prepDate ? format(prepDate, 'yyyy-MM-dd') : null}
                    // capacityConfig is implicitly handled by matrix calculation logic in backend or hook
                    compact={true}
                    displayMode={displayMode}
                    seamless={seamless}
                    isFirstMonth={isFirstMonth}
                    monthLabel={seamless ? format(monthDate, 'yyyy年 M月') : undefined}
                    currentItem={currentItem ? { id: currentItem.id, title: currentItem.title, due_date: currentItem.due_date || undefined } : undefined}
                />
            </div>
        </div>
    );
};
