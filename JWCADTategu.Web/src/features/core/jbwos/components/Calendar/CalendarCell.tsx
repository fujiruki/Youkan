import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { Item } from '../../types';
import { QuantityMetric } from '../../logic/QuantityEngine';
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';

interface CalendarCellProps {
    date: Date;
    metric?: QuantityMetric;
    isToday: boolean;
    isFirst: boolean;
    intensity: number;
    isMini: boolean;
    isSelected: boolean;
    isPrep: boolean;
    isCommitPeriod: boolean;
    flashingIds: Set<string>;
    onAction: (date: Date, signs: Item[], actionType: 'click' | 'doubleClick', rect?: DOMRect) => void;
    onItemClick?: (item: Item) => void;
    projects?: any[];
    renderItemTitle: (item: Item) => string;
    volumeOnly?: boolean;
    isTarget?: boolean;
    rowHeight?: number;
}

export const CalendarCell = forwardRef<HTMLDivElement, CalendarCellProps>(({
    date, metric, isToday, isFirst, intensity, isMini, isSelected, isPrep, isCommitPeriod, flashingIds, onAction, onItemClick, projects = [], renderItemTitle,
    volumeOnly = false, isTarget = false, rowHeight
}, ref) => {
    const items = metric?.contributingItems || [];
    const isHoliday = metric?.isHoliday || false;
    // [FIX] Use metric.intensity if available, fallback to prop
    const displayIntensity = metric?.intensity ?? intensity;
    const cellRef = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => cellRef.current!);

    const handleDoubleClick = (e: React.MouseEvent) => {
        // [FIX] Stop propagation to prevent background click reset
        e.stopPropagation();
        onAction(date, items, 'doubleClick', cellRef.current?.getBoundingClientRect());
    };

    const handleClick = (e: React.MouseEvent) => {
        // [FIX] Stop propagation to prevent background click reset
        e.stopPropagation();
        onAction(date, items, 'click', cellRef.current?.getBoundingClientRect());
    };

    return (
        <div
            ref={cellRef}
            data-date={date.toDateString()}
            className={cn(
                "calendar-cell relative flex-shrink-0 transition-all duration-300 w-full",
                isMini ? "h-10 border-b flex items-center px-4" : "min-h-[120px] h-full border-r flex flex-col p-2 border-b border-slate-100 dark:border-slate-800",
                volumeOnly && rowHeight && `h-[${rowHeight}px] min-h-0`,
                isHoliday ? "bg-slate-200 dark:bg-slate-800/80" : "bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800",
                // [FIX] 赤枠(納期)と青枠(マイ期限/目安期間)を独立表示
                isSelected && (isPrep || isCommitPeriod)
                    ? "z-10 bg-purple-50 dark:bg-purple-900/10 shadow-[0_0_0_2px_rgba(239,68,68,1),0_0_0_4px_rgba(59,130,246,1)]"  // 赤+青 二重枠
                    : isSelected
                        ? "z-10 bg-red-50 dark:bg-red-900/10 shadow-[0_0_0_2px_rgba(239,68,68,1)]"                                // 赤枠のみ
                        : (isPrep || isCommitPeriod)
                            ? "z-10 bg-blue-50 dark:bg-blue-900/10 shadow-[0_0_0_2px_rgba(59,130,246,1)]"                          // 青枠のみ
                            : "",
                volumeOnly && isTarget && !isSelected && "shadow-[0_0_0_2px_rgba(239,68,68,1)]",
                volumeOnly && isPrep && !isSelected && !isCommitPeriod && "shadow-[0_0_0_2px_rgba(59,130,246,1)]"
            )}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
        >
            <div
                className="absolute inset-0 bg-amber-500/40 dark:bg-amber-400/30 pointer-events-none transition-opacity duration-500"
                style={{ opacity: (displayIntensity || 0) / 100 }}
            />

            <div className={cn("flex relative z-10", isMini ? "items-center gap-4 w-full" : "flex-col w-full h-full")}>
                <div className={isMini ? "w-12 flex-shrink-0" : "flex items-start justify-between mb-1"}>
                    <div className="flex flex-col">
                        {isFirst && !isMini && <span className="text-[10px] font-bold text-slate-400">{format(date, 'MMM', { locale: ja })}</span>}
                        <span
                            className={cn(
                                "text-xs font-mono px-1 rounded cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors",
                                isToday ? "font-bold text-blue-600 underline" : "text-slate-500"
                            )}
                            onClick={(e) => {
                                e.stopPropagation();
                                onAction(date, items, 'doubleClick', cellRef.current?.getBoundingClientRect());
                            }}
                            title="この日の内訳を表示"
                        >
                            {isMini ? format(date, 'MM/dd') : date.getDate()}
                        </span>
                    </div>
                </div>

                <div className={cn("flex-1 flex gap-1", isMini ? "flex-row overflow-x-auto" : "flex-col overflow-hidden")}>
                    {!volumeOnly && items
                        .filter(i => {
                            // [UI] Rule: Chip appears on due_date (Primary). If absent, appears on prep_date.
                            const uiDateRaw = i.due_date || (i.prep_date ? new Date(i.prep_date * 1000).toISOString() : null);
                            if (!uiDateRaw) return false;

                            const itemDate = new Date(uiDateRaw);
                            itemDate.setHours(12, 0, 0, 0);
                            const cellDate = new Date(date);
                            cellDate.setHours(12, 0, 0, 0);
                            return itemDate.toDateString() === cellDate.toDateString();
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
                                        "px-1.5 py-0.5 rounded text-[10px] truncate shadow-sm cursor-pointer border-l-2 bg-white/90 dark:bg-slate-800/90 text-slate-700 dark:text-slate-300 font-bold transition-transform hover:scale-105",
                                        flashingIds.has(i.id) ? "ring-2 ring-amber-400 scale-105" : "",
                                        i.tenantId ? "border-l-indigo-400" : "border-l-red-400"
                                    )}
                                >
                                    {proj && <span className="text-slate-400 mr-1">[{proj.name}]</span>}
                                    {renderItemTitle(i)}
                                </div>
                            );
                        })}
                    {!isMini && items.length > 3 && (
                        <div className="flex items-center justify-center gap-1 py-0.5 bg-slate-50 dark:bg-slate-800/50 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm mt-0.5">
                            <span className="text-[9px] font-bold text-slate-500">+{items.length - 3}</span>
                            <div className="flex gap-0.5">
                                <span className="w-1 h-1 rounded-full bg-slate-400" />
                                <span className="w-1 h-1 rounded-full bg-slate-400" />
                                <span className="w-1 h-1 rounded-full bg-slate-400" />
                            </div>
                        </div>
                    )}

                    {volumeOnly && items.length > 0 && (
                        <div className="absolute top-1 right-1 opacity-20 group-hover:opacity-100 transition-opacity">
                            <span className="text-[9px] bg-slate-100 dark:bg-slate-800 px-1 rounded text-slate-400">
                                {items.length}件
                            </span>
                        </div>
                    )}
                    {isMini && items.length > 10 && <span className="text-[8px] text-slate-400">...</span>}
                </div>
            </div>
        </div>
    );
});
