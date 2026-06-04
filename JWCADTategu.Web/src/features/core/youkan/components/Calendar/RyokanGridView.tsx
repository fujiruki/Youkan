import React from 'react';
import { Item } from '../../types';
import { QuantityMetric } from '../../logic/QuantityEngine';
import { PressureConnection } from './RyokanCalendarTypes';
import { motion, AnimatePresence } from 'framer-motion';
import { VolumeCurve } from './VolumeCurve';
import { CalendarCell } from './CalendarCell';
import { ExternalEvent } from '../../types/externalEvent';
import { useLazyLoadSentinel } from '../../hooks/useLazyLoadSentinel';

/** R-042-Y2: lazy load 1 回あたりの追加ヶ月数（議事録 2026-06-04 §4 採用案） */
const LAZY_LOAD_MONTHS = 3;

const isSameDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

const toYmdKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

interface GridViewProps {
    allDays: Date[];
    metrics: Map<string, QuantityMetric>;
    heatMap: Map<string, number>;
    today: Date;
    onItemClick?: (item: Item) => void;
    onAction: (date: Date, actionType: 'click' | 'doubleClick' | 'dateClick', rect?: DOMRect) => void;
    selectedDate?: Date | null;
    prepDate?: Date | null;
    commitPeriod?: Date[];
    scrollRef?: React.RefObject<HTMLDivElement>;
    projects?: any[];
    renderItemTitle: (item: Item) => string;
    pressureConnections?: PressureConnection[];
    onBackgroundClick?: () => void;
    onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
    flashingIds: Set<string>;
    volumeOnly?: boolean;
    targetItemId?: string;
    rowHeight?: number;
    completedByDate?: Map<string, Item[]>;
    externalEventsByDate?: Map<string, ExternalEvent[]>;
    onExternalEventClick?: (event: ExternalEvent) => void;
    onExternalEventsMoreClick?: (date: Date, events: ExternalEvent[]) => void;
    externalEventsMaxVisible?: number;
    /** R-042-Y2: スクロール端で +N ヶ月の追加ロードを発火するコールバック */
    onLoadMore?: (direction: 'before' | 'after', months: number) => void;
    /** R-042-Y2: 追加ロード中フラグ（true のとき sentinel 発火を抑止する） */
    isLoadingMore?: boolean;
}

export const RyokanGridView: React.FC<GridViewProps> = ({
    allDays, metrics, heatMap, today, onItemClick, onAction,
    selectedDate, prepDate, commitPeriod = [], scrollRef, projects = [], renderItemTitle,
    pressureConnections = [],
    onBackgroundClick,
    onScroll,
    flashingIds,
    volumeOnly = false,
    targetItemId,
    rowHeight,
    completedByDate,
    externalEventsByDate,
    onExternalEventClick,
    onExternalEventsMoreClick,
    externalEventsMaxVisible = 3,
    onLoadMore,
    isLoadingMore = false,
}) => {
    // R-042-Y2: 縦スクロール先頭・末尾に sentinel を配置し、交差検知で +3 ヶ月の追加読み込みを発火。
    // 追加ロード中（isLoadingMore=true）は enabled=false にして二重発火を抑止する。
    const sentinelEnabled = !!onLoadMore && !isLoadingMore;
    const setBeforeRef = useLazyLoadSentinel({
        enabled: sentinelEnabled,
        onIntersect: () => onLoadMore?.('before', LAZY_LOAD_MONTHS),
    });
    const setAfterRef = useLazyLoadSentinel({
        enabled: sentinelEnabled,
        onIntersect: () => onLoadMore?.('after', LAZY_LOAD_MONTHS),
    });

    return (
        <div
            ref={scrollRef}
            className="w-full h-full overflow-auto p-4 bg-slate-50 dark:bg-slate-900/50 scrollbar-hide relative flex flex-col gap-4"
            onClick={onBackgroundClick}
            onScroll={onScroll}
        >
            {/* R-042-Y2: 先頭 sentinel（rootMargin 200px 手前で交差） */}
            <div
                ref={setBeforeRef}
                data-testid="lazy-sentinel-before"
                aria-hidden="true"
                className="h-px w-full pointer-events-none"
            />
            <div className="flex-1 relative">
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
                        // 隣接セル（前週・次週・前日）が別月かどうかで境界を判定する
                        const prevWeek = new Date(date); prevWeek.setDate(date.getDate() - 7);
                        const nextWeek = new Date(date); nextWeek.setDate(date.getDate() + 7);
                        const prevDay = new Date(date); prevDay.setDate(date.getDate() - 1);
                        const monthBoundaryTop =
                            prevWeek.getMonth() !== date.getMonth() || prevWeek.getFullYear() !== date.getFullYear();
                        const monthBoundaryBottom =
                            nextWeek.getMonth() !== date.getMonth() || nextWeek.getFullYear() !== date.getFullYear();
                        const monthBoundaryLeft =
                            date.getDay() !== 0 &&
                            (prevDay.getMonth() !== date.getMonth() || prevDay.getFullYear() !== date.getFullYear());
                        const intensity = heatMap.get(dateKey) || 0;

                        const isS = selectedDate ? isSameDate(date, selectedDate) : false;
                        const isP = prepDate ? isSameDate(date, prepDate) : false;
                        const isCP = commitPeriod.some(d => isSameDate(d, date));

                        // [NEW] Find target item for overlay
                        const targetItem = targetItemId && metric?.contributingItems
                            ? metric.contributingItems.find(i => i.id === targetItemId)
                            : undefined;
                        const isTarget = !!targetItem;

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
                                isTarget={isTarget}
                                targetItem={targetItem}
                                rowHeight={rowHeight}
                                completedCount={completedByDate?.get(dateKey)?.length || 0}
                                monthBoundaryTop={monthBoundaryTop}
                                monthBoundaryBottom={monthBoundaryBottom}
                                monthBoundaryLeft={monthBoundaryLeft}
                                externalEvents={externalEventsByDate?.get(toYmdKey(date)) || []}
                                onExternalEventClick={onExternalEventClick}
                                onExternalEventsMoreClick={onExternalEventsMoreClick}
                                externalEventsMaxVisible={externalEventsMaxVisible}
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
            {/* R-042-Y2: 末尾 sentinel（rootMargin 200px 手前で交差） */}
            <div
                ref={setAfterRef}
                data-testid="lazy-sentinel-after"
                aria-hidden="true"
                className="h-px w-full pointer-events-none"
            />
        </div>
    );
};
