import React from 'react';
import { QuantityCell, QuantityCellProps } from './QuantityCell';

interface QuantityCalendarGridProps {
    matrix: Record<string, Omit<QuantityCellProps, 'date' | 'onClick'>>;
    startDate: string;
    endDate: string;
    onCellClick?: (date: string) => void;
    selectedDate?: string | null;
    prepDate?: string | null;
}

export const QuantityCalendarGrid: React.FC<QuantityCalendarGridProps> = ({
    matrix,
    startDate,
    endDate,
    onCellClick,
    selectedDate,
    prepDate
}) => {
    // Generate date range
    const days: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);

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
            <div className="grid grid-cols-7 gap-[2px]">
                {days.map(date => {
                    const data = matrix[date] || { capacity: 0, usage: 0, fillRate: 0, isOverflow: false };
                    const isSelected = selectedDate === date;
                    const isPrep = prepDate === date;

                    return (
                        <div key={date} className="aspect-square bg-white relative">
                            <QuantityCell
                                date={date}
                                {...data}
                                isSelected={isSelected}
                                isPrep={isPrep}
                                onClick={() => onCellClick && onCellClick(date)}
                            />
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
