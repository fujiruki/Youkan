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
}

export const QuantityCalendarGrid: React.FC<QuantityCalendarGridProps> = ({
    matrix,
    startDate,
    endDate,
    onCellClick,
    selectedDate,
    prepDate,
    displayMode = 'default'
}) => {
    // Generate date range
    const days: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Ensure start is set to midnight for accurate day calculation
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999); // End of day

    const startDayOfWeek = start.getDay(); // 0 (Sun) - 6 (Sat)

    // Calculate actual dates
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(d.toISOString().split('T')[0]);
    }

    return (
        <div className="w-full p-2">
            {/* Header Row */}
            <div className="grid grid-cols-7 gap-[2px] mb-1">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {day}
                    </div>
                ))}
            </div>

            {/* Grid Cells */}
            <div className="grid grid-cols-7 gap-[2px] auto-rows-fr">
                {days.map((date, index) => {
                    const data = matrix[date] || { capacity: 0, usage: 0, fillRate: 0, isOverflow: false };
                    const isSelected = selectedDate === date;
                    const isPrep = prepDate === date;

                    // First day alignment
                    const style = index === 0 ? { gridColumnStart: startDayOfWeek + 1 } : {};

                    return (
                        <div key={date} className="aspect-square bg-white relative" style={style}>
                            <QuantityCell
                                date={date}
                                {...data}
                                isSelected={isSelected}
                                isPrep={isPrep}
                                onClick={() => onCellClick && onCellClick(date)}
                                displayMode={displayMode}
                            // displayMode passed via context or checked here if Cell supports it
                            // For now, QuantityCell only does display logic. 
                            // To hide text in volume_only, we might need to pass a prop to QuantityCell.
                            // But let's stick to existing QuantityCell for now and update it if needed.
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
