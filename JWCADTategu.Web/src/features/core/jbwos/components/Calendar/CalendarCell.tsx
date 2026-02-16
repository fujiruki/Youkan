import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Item } from '../../types';
import { QuantityMetric } from '../../logic/QuantityEngine';
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { safeParseDate, normalizeDateKey } from '../../logic/dateUtils';

interface CalendarCellProps {
    date: Date;
    metric?: QuantityMetric;
    isToday: boolean;
    isFirst: boolean;
    intensity: number; // 0-100 visual density
    isMini: boolean;
    isSelected: boolean;     // Due Date (Red)
    isPrep: boolean;         // My Deadline (Blue)
    isCommitPeriod: boolean; // Range (Blue)
    flashingIds: Set<string>;
    onAction: (date: Date, signs: Item[], actionType: 'click' | 'doubleClick' | 'dateClick', rect?: DOMRect) => void;
    onItemClick?: (item: Item) => void;
    projects?: any[];
    renderItemTitle: (item: Item) => string;
    volumeOnly?: boolean;
    isTarget?: boolean;
    targetItem?: Item; // [NEW] Explicit item for overlay
    rowHeight?: number;
}

export const CalendarCell = forwardRef<HTMLDivElement, CalendarCellProps>(({
    date, metric, isToday, isFirst, intensity, isMini, isSelected, isPrep, isCommitPeriod, flashingIds, onAction, onItemClick, projects = [], renderItemTitle,
    volumeOnly = false, isTarget = false, targetItem, rowHeight
}, ref) => {
    const items = metric?.contributingItems || [];
    const isHoliday = metric?.isHoliday || false;
    // [FIX] Use metric.intensity if available, fallback to prop
    const displayIntensity = metric?.intensity ?? intensity;
    const cellRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => cellRef.current!);

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        onAction(date, items, 'doubleClick', cellRef.current?.getBoundingClientRect());
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Default cell click (for setting dates)
        onAction(date, items, 'click', cellRef.current?.getBoundingClientRect());
    };

    const handleDateClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        // Specialized date number click (for showing list)
        onAction(date, items, 'dateClick', cellRef.current?.getBoundingClientRect());
    };

    // Determine overlay item (Target Item on its Due/Prep Date)
    const overlayItem = isTarget && targetItem ? targetItem : (isTarget ? items.find(i => i.id === targetItem?.id) : null);
    // Fallback: If isTarget is true but no matching item found in metric (e.g. no capacity yet), we might still want to show it if passed via targetItem
    const effectiveOverlayItem = overlayItem || (isTarget && targetItem ? targetItem : null);


    return (
        <div
            ref={cellRef}
            data-date={normalizeDateKey(date)}
            className={cn(
                "calendar-cell relative flex-shrink-0 transition-all duration-300 w-full group",
                isMini ? "h-10 border-b flex items-center px-4" : "min-h-[80px] h-full border-r flex flex-col p-1 border-b border-slate-100 dark:border-slate-800",
                volumeOnly && rowHeight && `h-[${rowHeight}px] min-h-0`,
                isHoliday ? "bg-slate-100 dark:bg-slate-800/50" : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800",

                // [FIX] Border Styles for Detail View
                // 1. Due Date (Red) - Highest Priority
                isSelected
                    ? "z-10 shadow-[inset_0_0_0_2px_rgba(239,68,68,1)] bg-red-50/30 dark:bg-red-900/10"
                    : "",

                // 2. Prep Date (Blue)
                !isSelected && isPrep
                    ? "z-10 shadow-[inset_0_0_0_2px_rgba(59,130,246,1)] bg-blue-50/30 dark:bg-blue-900/10"
                    : "",

                // 3. Commit Period (Blue Range)
                !isSelected && !isPrep && isCommitPeriod
                    ? "bg-blue-50/50 dark:bg-blue-900/20 shadow-[inset_0_0_0_1px_rgba(59,130,246,0.3)]"
                    : ""
            )}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            {/* Heatmap Background */}
            <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-500"
                style={{
                    backgroundColor: 'var(--cal-bg-color)',
                    opacity: `calc(var(--cal-bg-max-opacity) * ${(displayIntensity || 0) / 100})`
                }}
            />

            <div className={cn("flex relative z-10 pointer-events-none", isMini ? "items-center gap-4 w-full" : "flex-col w-full h-full")}>
                <div className={isMini ? "w-12 flex-shrink-0" : "flex items-start justify-between mb-0.5"}>
                    <div className="flex items-center gap-1 pointer-events-auto">
                        {/* Month Label (First Day Only) */}
                        {isFirst && !isMini && (
                            <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter leading-none">
                                {format(date, 'M月', { locale: ja })}
                            </span>
                        )}

                        {/* Date Number (Clickable for List) */}
                        <span
                            className={cn(
                                "text-[10px] font-mono px-1 rounded cursor-pointer transition-all leading-none py-0.5",
                                isToday
                                    ? "bg-blue-600 text-white font-bold shadow-sm"
                                    : "text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200",
                                (isSelected || isPrep) && "font-bold"
                            )}
                            onClick={handleDateClick}
                            title="この日の内訳を表示"
                        >
                            {isMini ? format(date, 'MM/dd') : date.getDate()}
                        </span>
                    </div>
                </div>

                <div className={cn("flex-1 flex min-h-0", isMini ? "flex-row overflow-x-auto" : "flex-col overflow-hidden")}>
                    {/* Volume Only Overlay Card */}
                    {volumeOnly && isTarget && effectiveOverlayItem && (
                        <div className="absolute inset-x-0.5 top-5 z-20 pointer-events-auto">
                            <div className={cn(
                                "bg-white/95 dark:bg-slate-800/95 border rounded-[2px] px-1 py-0.5 shadow-md text-[9px] font-bold truncate border-l-2 animate-in zoom-in-95 duration-200",
                                isSelected ? "border-red-400 text-red-700 dark:text-red-300" : "border-amber-400 text-amber-700 dark:text-amber-300"
                            )}>
                                {renderItemTitle(effectiveOverlayItem)}
                            </div>
                        </div>
                    )}

                    {/* Standard List Items */}
                    {!volumeOnly && items
                        .filter(i => {
                            // [UI] Rule: Chip appears on due_date (Primary). If absent, appears on prep_date.
                            const uiDate = safeParseDate(i.due_date || i.prep_date);
                            if (!uiDate) return false;
                            return normalizeDateKey(uiDate) === normalizeDateKey(date);
                        })
                        .slice(0, isMini ? 10 : 3).map(i => {
                            const proj = projects.find(p => p.id === i.projectId);
                            return (
                                <div
                                    key={i.id}
                                    id={`cal-chip-${i.id}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (onItemClick) onItemClick(i);
                                    }}
                                    className={cn(
                                        "px-1 py-px rounded-[1px] text-[9px] truncate shadow-sm cursor-pointer border-l-2 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 transition-transform hover:scale-105 pointer-events-auto",
                                        flashingIds.has(i.id) ? "ring-1 ring-amber-400 scale-105" : "",
                                        i.tenantId ? "border-l-indigo-400" : "border-l-red-400",
                                        "mb-0.5"
                                    )}
                                >
                                    {proj && <span className="text-slate-400 mr-0.5">[{proj.name.substring(0, 2)}]</span>}
                                    {renderItemTitle(i)}
                                </div>
                            );
                        })}

                    {/* More Indicator */}
                    {!isMini && !volumeOnly && items.length > 3 && (
                        <div className="flex items-center gap-0.5 pl-1 opacity-50">
                            <span className="w-0.5 h-0.5 rounded-full bg-slate-400" />
                            <span className="w-0.5 h-0.5 rounded-full bg-slate-400" />
                            <span className="text-[8px] text-slate-400">+{items.length - 3}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});
