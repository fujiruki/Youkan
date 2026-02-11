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
    flashingIds: Set<string>;
    volumeOnly?: boolean;
    targetItemId?: string;
    rowHeight?: number;
}

export const RyokanGridView: React.FC<GridViewProps> = ({
    allDays, metrics, heatMap, today, onItemClick, onAction,
    selectedDate, prepDate, commitPeriod = [], scrollRef, projects = [], renderItemTitle,
    pressureConnections = [],
    onBackgroundClick,
    flashingIds,
    volumeOnly = false,
    targetItemId,
    rowHeight
}) => {
    return (
        <div
            ref={scrollRef}
            className="w-full h-full overflow-auto p-4 bg-slate-50 dark:bg-slate-900/50 scrollbar-hide relative flex flex-col gap-4"
            onClick={onBackgroundClick}
        >
            <div className="flex-1 relative min-w-max">
                {/* [NEW] Weekday Headers */}
                <div className="grid grid-cols-7 gap-px mb-px bg-slate-200 dark:bg-slate-800 border-x border-t border-slate-200 dark:border-slate-800 rounded-t-lg overflow-hidden sticky top-0 z-30">
                    {['日', '月', '火', '水', '木', '金', '土'].map(day => (
                        <div key={day} className="bg-slate-100 dark:bg-slate-800 py-1.5 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                            {day}
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-7 gap-px bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800 rounded-b-lg overflow-hidden shadow-sm relative z-10">
                    <svg className="absolute inset-0 pointer-events-none z-50 w-full h-full overflow-visible pressure-lines-svg">
                        <AnimatePresence>
                            {pressureConnections.map(conn => (
                                <motion.path
                                    key={conn.id}
                                    d={`M ${conn.source.x} ${conn.source.y} Q ${conn.isOffScreen ? (conn.source.x + conn.target.x) / 2 : Math.max(conn.source.x, conn.target.x) + 60} ${(conn.source.y + conn.target.y) / 2} ${conn.target.x} ${conn.target.y}`}
                                    fill="none"
                                    stroke={conn.color}
                                    strokeWidth="2.5"
                                    strokeLinecap="round"
                                    strokeDasharray={conn.isOffScreen ? "4 4" : "0"}
                                    initial={{ pathLength: 0, opacity: 0 }}
                                    animate={{ pathLength: 1, opacity: conn.isOffScreen ? 0.4 : 0.7 }}
                                    exit={{ opacity: 0 }}
                                    transition={{ duration: 0.5 }}
                                />
                            ))}
                        </AnimatePresence>
                    </svg>
                    {allDays.map(date => {
                        const cellDate = new Date(date);
                        cellDate.setHours(12, 0, 0, 0);
                        const dateKey = cellDate.toDateString();
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
                                flashingIds={flashingIds}
                                onAction={(d, _items, type, rect) => onAction(d, type, rect)}
                                onItemClick={onItemClick}
                                projects={projects}
                                renderItemTitle={renderItemTitle}
                                volumeOnly={volumeOnly}
                                isTarget={metric?.contributingItems?.some(i => i.id === targetItemId && i.due_date && isSameDate(date, new Date(i.due_date)))}
                                rowHeight={rowHeight}
                            />
                        );
                    })}
                </div>

                {/* Background Volume Curve - Moved here to cover full grid area */}
                <div className="absolute inset-0 pointer-events-none z-0">
                    <svg className="w-full h-full opacity-30 dark:opacity-20 overflow-visible">
                        <VolumeCurve allDays={allDays} metrics={metrics} />
                    </svg>
                </div>
            </div>
        </div>
    );
};
