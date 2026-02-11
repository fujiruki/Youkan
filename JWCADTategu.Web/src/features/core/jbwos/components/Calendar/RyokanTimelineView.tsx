import React, { useRef, useEffect } from 'react';
import { Item } from '../../types';
import { QuantityMetric } from '../../logic/QuantityEngine';
import { PressureConnection } from './RyokanCalendarTypes';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../../../lib/utils';
import { CalendarCell } from './CalendarCell';

const isSameDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

interface TimelineViewProps {
    allDays: Date[];
    metrics: Map<string, QuantityMetric>;
    heatMap: Map<string, number>;
    today: Date;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    isMini: boolean;
    flashingItemIds: Set<string>;
    pressureConnections: PressureConnection[];
    onItemClick?: (item: Item) => void;
    onAction: (date: Date, actionType: 'click' | 'doubleClick', rect?: DOMRect) => void;
    commitPeriod?: Date[];
    projects?: any[];
    renderItemTitle: (item: Item) => string;
    scrollRef?: React.RefObject<HTMLDivElement>;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void; // [NEW] Loop back for infinite scroll
    onBackgroundClick?: () => void;
}

export const RyokanTimelineView: React.FC<TimelineViewProps> = ({
    allDays, metrics, heatMap, today,
    selectedDate, prepDate, isMini,
    flashingItemIds, pressureConnections, onItemClick, onAction,
    commitPeriod = [], projects = [],
    renderItemTitle,
    scrollRef,
    onScroll,
    onBackgroundClick
}) => {
    const todayRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (todayRef.current) {
            todayRef.current.scrollIntoView({ inline: 'center', block: 'center', behavior: 'auto' });
        }
    }, [isMini]);

    return (
        <div className="w-full h-full relative" ref={containerRef} onClick={onBackgroundClick}>
            <div className={cn("flex-1 h-full overflow-auto select-none", isMini ? "overflow-y-auto" : "overflow-x-auto")} ref={scrollRef} onScroll={onScroll}>
                <div className={cn("flex min-w-max min-h-full relative", isMini ? "flex-col w-full" : "flex-row")}>
                    <svg className="absolute inset-0 pointer-events-none z-50 w-full h-full pressure-lines-svg">
                        <AnimatePresence>
                            {pressureConnections.map(conn => (
                                <motion.path
                                    key={conn.id}
                                    d={`M ${conn.source.x} ${conn.source.y} Q ${Math.max(conn.source.x, conn.target.x) + 60} ${(conn.source.y + conn.target.y) / 2} ${conn.target.x} ${conn.target.y}`}
                                    fill="none"
                                    stroke={conn.color}
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: 0.7 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                />
                            ))}
                        </AnimatePresence>
                    </svg>
                    {allDays.map(date => {
                        const dateKey = date.toDateString();
                        const metric = metrics.get(dateKey);
                        const isToday = isSameDate(date, today);
                        const isFirst = date.getDate() === 1;
                        const intensity = heatMap.get(dateKey) || 0;
                        const isS = selectedDate ? isSameDate(date, selectedDate) : false;
                        const isP = prepDate ? isSameDate(date, prepDate) : false;

                        return (
                            <CalendarCell
                                key={dateKey}
                                date={date}
                                metric={metric}
                                isToday={isToday}
                                isFirst={isFirst}
                                intensity={intensity}
                                isMini={isMini}
                                isSelected={isS}
                                isPrep={isP}
                                isCommitPeriod={commitPeriod.some(d => isSameDate(d, date))}
                                flashingIds={flashingItemIds}
                                ref={isToday ? todayRef : null}
                                onAction={(d, _items, type, rect) => onAction(d, type, rect)}
                                onItemClick={onItemClick}
                                projects={projects}
                                renderItemTitle={renderItemTitle}
                            />
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
