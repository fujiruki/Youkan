import React from 'react';
import { Item } from '../../types';
import { QuantityMetric } from '../../logic/QuantityEngine';
import { PressureConnection } from './RyokanCalendarTypes';
import { motion, AnimatePresence } from 'framer-motion';
import { VolumeCurve } from './VolumeCurve';
import { CalendarCell } from './CalendarCell';

const isSameDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

interface GridViewProps {
    allDays: Date[];
    metrics: Map<string, QuantityMetric>;
    heatMap: Map<string, number>;
    today: Date;
    onItemClick?: (item: Item) => void;
    onAction: (date: Date, actionType: 'click' | 'doubleClick', rect?: DOMRect) => void;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    commitPeriod?: Date[];
    scrollRef?: React.RefObject<HTMLDivElement>;
    projects?: any[];
    renderItemTitle: (item: Item) => string;
    pressureConnections?: PressureConnection[];
    onBackgroundClick?: () => void;
    flashingItemIds: Set<string>;
}

export const RyokanGridView: React.FC<GridViewProps> = ({
    allDays, metrics, heatMap, today, onItemClick, onAction,
    selectedDate, prepDate, commitPeriod = [], scrollRef, projects = [], renderItemTitle,
    pressureConnections = [],
    onBackgroundClick,
    flashingItemIds
}) => {
    return (
        <div
            ref={scrollRef}
            className="w-full h-full overflow-auto p-4 bg-slate-50 dark:bg-slate-900/50 scrollbar-hide relative"
            onClick={onBackgroundClick}
        >
            {/* Background Volume Curve */}
            <div className="absolute inset-0 pointer-events-none z-0">
                <svg className="w-full h-full opacity-30 dark:opacity-20 overflow-visible">
                    <defs>
                        <linearGradient id="volumeGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#818cf8" />
                            <stop offset="50%" stopColor="#6366f1" />
                            <stop offset="100%" stopColor="#4f46e5" />
                        </linearGradient>
                    </defs>
                    <VolumeCurve allDays={allDays} metrics={metrics} />
                </svg>
            </div>

            <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden shadow-sm relative z-10">
                <svg className="absolute inset-0 pointer-events-none z-50 w-full h-full overflow-visible pressure-lines-svg">
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
                    const isCP = commitPeriod.some(d => isSameDate(d, date));

                    return (
                        <CalendarCell
                            key={dateKey}
                            date={date}
                            metric={metric}
                            isToday={isToday}
                            isFirst={isFirst}
                            intensity={intensity}
                            isMini={false}
                            isSelected={isS}
                            isPrep={isP}
                            isCommitPeriod={isCP}
                            flashingIds={flashingItemIds}
                            onAction={(d, _items, type, rect) => onAction(d, type, rect)}
                            onItemClick={onItemClick}
                            projects={projects}
                            renderItemTitle={renderItemTitle}
                        />
                    );
                })}
            </div>
        </div>
    );
};
