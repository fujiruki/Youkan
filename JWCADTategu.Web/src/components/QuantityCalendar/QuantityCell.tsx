import React from 'react';

export interface QuantityCellProps {
    date: string;
    capacity: number; // minutes
    usage: number;    // minutes
    fillRate: number; // 0.0 - 1.0+
    isOverflow: boolean;
    isSelected?: boolean;
    isPrep?: boolean;
    onClick?: () => void;
    displayMode?: 'default' | 'volume_only';
    currentItem?: { id: string; title?: string; due_date?: string };
}

export const QuantityCell: React.FC<QuantityCellProps> = ({
    date,
    capacity,
    usage,
    fillRate,
    isOverflow,
    isSelected,
    isPrep,
    onClick,
    displayMode = 'default',
    currentItem
}) => {
    // Determine Intensity
    const intensity = Math.min(fillRate, 1.0);

    // Tailwind Blue-500 equivalent color calculation for inline style standard
    // Using inline style for dynamic opacity is cleaner than generating 100 tailwind classes
    // Base color: rgb(59, 130, 246)
    const backgroundColor = `rgba(59, 130, 246, ${intensity * 0.8})`;

    const overflowHours = isOverflow ? ((usage - capacity) / 60).toFixed(1) : null;

    // Check if this cell is the due date for the current item
    const isDue = currentItem?.due_date === date || (currentItem?.due_date && date.startsWith(currentItem.due_date.split('T')[0]));

    // Selection Styles
    const selectionClass = isSelected
        ? "ring-2 ring-red-500 z-30"
        : isPrep
            ? "ring-2 ring-indigo-500 z-30"
            : isDue
                ? "ring-2 ring-amber-500 z-30"
                : "border-slate-200";

    return (
        <div
            onClick={onClick}
            className={`w-full h-full relative border cursor-pointer transition-all hover:brightness-90 group box-border bg-white ${selectionClass}`}
        >
            <div
                className="absolute inset-0 transition-colors"
                style={{ backgroundColor }}
                title={`Capacity: ${capacity / 60}h / Usage: ${usage / 60}h`}
            />

            {/* Date Label (Always Visible) */}
            <span className="absolute top-0.5 left-1 text-[10px] text-slate-500 font-sans pointer-events-none z-10 mix-blend-multiply">
                {new Date(date).getDate()}
            </span>

            {/* Current Item Card on Due Date */}
            {isDue && (
                <div className="absolute inset-x-0.5 top-4 bg-white/95 border border-amber-500 rounded-[2px] px-0.5 py-0.5 shadow-sm z-20 overflow-hidden">
                    <div className="text-[8px] font-bold text-amber-700 truncate leading-tight text-center">
                        {currentItem?.title || 'This Item'}
                    </div>
                </div>
            )}

            {/* Overflow Dog-ear (CSS Triangle) */}
            {isOverflow && (
                <>
                    <div
                        className="absolute bottom-0 right-0 w-0 h-0 border-style-solid border-b-[24px] border-l-[24px] border-l-transparent border-b-slate-700/30 z-10"
                        style={{ borderBottomColor: 'rgba(0,0,0,0.3)' }}
                    />
                    {displayMode !== 'volume_only' && (
                        <span className="absolute bottom-0 right-0.5 text-[9px] font-bold text-white z-20 pointer-events-none">
                            +{overflowHours}h
                        </span>
                    )}
                </>
            )}
        </div>
    );
};
