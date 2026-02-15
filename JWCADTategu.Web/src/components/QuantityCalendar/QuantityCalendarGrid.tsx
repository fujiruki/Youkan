import React from 'react';
import { QuantityCell, QuantityCellProps } from './QuantityCell';

interface QuantityCalendarGridProps {
    matrix: Record<string, Omit<QuantityCellProps, 'date' | 'onClick'>>;
    startDate: string | Date;
    endDate: string | Date;
    onCellClick?: (date: string) => void;
    selectedDate?: string | null;
    prepDate?: string | null;
    displayMode?: 'default' | 'volume_only';
    compact?: boolean;
    capacityConfig?: any; // Add if needed, though filtered via matrix
    seamless?: boolean;
    isFirstMonth?: boolean;
    monthLabel?: string;
    currentItem?: { id: string; title?: string; due_date?: string };
}

export const QuantityCalendarGrid: React.FC<QuantityCalendarGridProps> = ({
    matrix,
    startDate,
    endDate,
    onCellClick,
    selectedDate,
    prepDate,
    displayMode = 'default',
    seamless = false,
    isFirstMonth = false,
    monthLabel,
    currentItem
}) => {
    // Generate date range
    const days: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Ensure start is set to midnight for accurate day calculation
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999); // End of day

    // Monday Start Logic: (0 for Mon, ..., 6 for Sun)
    // getDay(): 0(Sun), 1(Mon), ..., 6(Sat)
    // To make Mon=0: (day + 6) % 7
    // Sun(0) -> (0+6)%7 = 6
    // Mon(1) -> (1+6)%7 = 0
    const startDayOfWeek = (start.getDay() + 6) % 7;

    // Calculate actual dates
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(d.toISOString().split('T')[0]);
    }

    const containerClass = seamless ? "contents" : "w-full p-2";

    const renderCells = () => {
        return days.map((date, index) => {
            const data = matrix[date] || { capacity: 0, usage: 0, fillRate: 0, isOverflow: false };
            const isSelected = selectedDate === date;
            const isPrep = prepDate === date;

            // First day alignment
            // In seamless mode, apply gridColumnStart ONLY if it's the very first month loaded.
            // Subsequent months simply follow the previous cell.
            const shouldApplyOffset = !seamless || (seamless && isFirstMonth);
            const style = (index === 0 && shouldApplyOffset) ? { gridColumnStart: startDayOfWeek + 1 } : {};

            return (
                <div key={date} className="aspect-square bg-white relative" style={style}>
                    <QuantityCell
                        date={date}
                        {...data}
                        isSelected={isSelected}
                        isPrep={isPrep}
                        onClick={() => onCellClick && onCellClick(date)}
                        displayMode={displayMode}
                        currentItem={currentItem}
                    />
                </div>
            );
        });
    };

    return (
        <div className={containerClass}>
            {/* Header Row (Only if not seamless) */}
            {!seamless && (
                <div className="grid grid-cols-7 gap-[2px] mb-1">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                        <div key={day} className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                            {day}
                        </div>
                    ))}
                </div>
            )}

            {/* Month Label for Seamless Mode (Full Width) */}
            {seamless && monthLabel && (
                <div
                    className="col-span-7 sticky top-0 z-10 bg-white/95 dark:bg-slate-900/95 backdrop-blur py-1 px-2 border-b border-slate-100 dark:border-slate-800 text-xs font-bold text-slate-500 shadow-sm mt-1 mb-0.5"
                    data-month-label={startDate instanceof Date ? startDate.toISOString() : startDate}
                >
                    {monthLabel}
                </div>
            )}

            {/* Grid Cells */}
            {!seamless ? (
                <div className="grid grid-cols-7 gap-[2px] auto-rows-fr">
                    {renderCells()}
                </div>
            ) : (
                renderCells()
            )}
        </div>
    );
};
