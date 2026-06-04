import React, { useRef, useEffect } from 'react';
import { Item } from '../../types';
import { QuantityMetric } from '../../logic/QuantityEngine';
import { PressureConnection } from './RyokanCalendarTypes';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../../../lib/utils';
import { CalendarCell } from './CalendarCell';
import { ExternalEvent } from '../../types/externalEvent';
import { useLazyLoadSentinel } from '../../hooks/useLazyLoadSentinel';
import { GoogleCalendar } from '../../../../../api/googleCalendar';

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
    /** R-039 Phase 3 UX: Google カレンダー外部イベント */
    externalEventsByDate?: Map<string, ExternalEvent[]>;
    externalEventsMaxVisible?: number;
    onExternalEventClick?: (event: ExternalEvent) => void;
    onExternalEventsMoreClick?: (date: Date, events: ExternalEvent[]) => void;
    /** R-042-Y2: スクロール端で +N ヶ月の追加ロードを発火するコールバック */
    onLoadMore?: (direction: 'before' | 'after', months: number) => void;
    /** R-042-Y2: 追加ロード中フラグ（true のとき sentinel 発火を抑止する） */
    isLoadingMore?: boolean;
    /** R-041-Y3: イベントチップにカレンダー色を反映するための Google カレンダー一覧 */
    googleCalendars?: GoogleCalendar[];
}

export const RyokanTimelineView: React.FC<TimelineViewProps> = ({
    allDays, metrics, heatMap, today,
    selectedDate, prepDate, isMini,
    flashingItemIds, pressureConnections, onItemClick, onAction,
    commitPeriod = [], projects = [],
    renderItemTitle,
    scrollRef,
    onScroll,
    onBackgroundClick,
    externalEventsByDate,
    externalEventsMaxVisible = 3,
    onExternalEventClick,
    onExternalEventsMoreClick,
    onLoadMore,
    isLoadingMore = false,
    googleCalendars = [],
}) => {
    const todayRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // R-042-Y2: 上端／下端（縦表示）または左端／右端（横表示）に sentinel を配置し、
    // 交差検知で +3 ヶ月の追加読み込みを発火。isLoadingMore=true のときは抑止する。
    const sentinelEnabled = !!onLoadMore && !isLoadingMore;
    const setBeforeRef = useLazyLoadSentinel({
        enabled: sentinelEnabled,
        onIntersect: () => onLoadMore?.('before', LAZY_LOAD_MONTHS),
    });
    const setAfterRef = useLazyLoadSentinel({
        enabled: sentinelEnabled,
        onIntersect: () => onLoadMore?.('after', LAZY_LOAD_MONTHS),
    });

    useEffect(() => {
        if (todayRef.current) {
            todayRef.current.scrollIntoView({ inline: 'center', block: 'center', behavior: 'auto' });
        }
    }, [isMini]);

    return (
        <div className="w-full h-full relative" ref={containerRef} onClick={onBackgroundClick}>
            <div className={cn("flex-1 h-full overflow-auto select-none", isMini ? "overflow-y-auto" : "overflow-x-auto")} ref={scrollRef} onScroll={onScroll}>
                {/* R-042-Y2: スクロール先頭側 sentinel（縦表示時=上端、横表示時=左端） */}
                <div
                    ref={setBeforeRef}
                    data-testid="lazy-sentinel-before"
                    aria-hidden="true"
                    className={cn("pointer-events-none", isMini ? "h-px w-full" : "h-full w-px absolute top-0 left-0 z-0")}
                />
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
                                onAction={(d, _items, type, rect) => onAction(d, type as 'click' | 'doubleClick', rect)}
                                onItemClick={onItemClick}
                                projects={projects}
                                renderItemTitle={renderItemTitle}
                                externalEvents={externalEventsByDate?.get(toYmdKey(date)) || []}
                                onExternalEventClick={onExternalEventClick}
                                onExternalEventsMoreClick={onExternalEventsMoreClick}
                                externalEventsMaxVisible={externalEventsMaxVisible}
                                googleCalendars={googleCalendars}
                            />
                        );
                    })}
                </div>
                {/* R-042-Y2: スクロール末尾側 sentinel（縦表示時=下端、横表示時=右端） */}
                <div
                    ref={setAfterRef}
                    data-testid="lazy-sentinel-after"
                    aria-hidden="true"
                    className={cn("pointer-events-none", isMini ? "h-px w-full" : "h-full w-px absolute top-0 right-0 z-0")}
                />
            </div>
        </div>
    );
};
