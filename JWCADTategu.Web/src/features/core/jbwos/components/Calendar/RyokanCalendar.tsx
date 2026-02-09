import React, { useMemo, useState, useRef } from 'react';
import { Item } from '../../types';
import { QuantityEngine } from '../../logic/QuantityEngine';
import { X } from 'lucide-react';
import { format } from 'date-fns';
import { RyokanCalendarProps, PressureConnection } from './RyokanCalendarTypes';
import { RyokanGridView } from './RyokanGridView';
import { RyokanTimelineView } from './RyokanTimelineView';
import { RyokanGanttView } from './RyokanGanttView';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../../../../../lib/utils';
import { ChevronRight } from 'lucide-react';

const getStartOfToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
};


export const RyokanCalendar: React.FC<RyokanCalendarProps> = ({
    items, onItemClick, capacityConfig, members,
    layoutMode = 'panorama', displayMode: propDisplayMode, filterMode = 'all',
    onSelectDate, selectedDate, prepDate, focusDate, workDays = 1, projects = [],
    focusedTenantId, focusedProjectId, currentUserId
}) => {
    const [displayMode, setDisplayMode] = useState<'grid' | 'timeline' | 'gantt'>(propDisplayMode || 'grid');
    const today = useMemo(() => getStartOfToday(), []);
    const isMini = layoutMode === 'mini';

    const [selectedSigns, setSelectedSigns] = useState<Item[]>([]);
    const [pressureConnections, setPressureConnections] = useState<PressureConnection[]>([]);
    const [flashingItemIds, setFlashingItemIds] = useState<Set<string>>(new Set());

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const allDays = useMemo(() => {
        const start = focusDate ? new Date(focusDate) : new Date(today);
        start.setDate(start.getDate() - (isMini ? 15 : 90));

        // [FIX] Align to the start of the week (Sunday) to ensure 7-column grid works like a calendar
        const dayOfWeek = start.getDay();
        start.setDate(start.getDate() - dayOfWeek);

        const end = focusDate ? new Date(focusDate) : new Date(today);
        end.setDate(end.getDate() + (isMini ? 15 : 90));
        // Align end to the end of the week (Saturday)
        const endDayOfWeek = end.getDay();
        end.setDate(end.getDate() + (6 - endDayOfWeek));

        const days: Date[] = [];
        let cur = new Date(start);
        while (cur <= end) {
            days.push(new Date(cur));
            cur.setDate(cur.getDate() + 1);
        }
        return days;
    }, [today, focusDate, isMini]);

    const metrics = useMemo(() => QuantityEngine.calculateMetrics(allDays, {
        items,
        members: members || [],
        capacityConfig: capacityConfig || { defaultDailyMinutes: 480, holidays: [], exceptions: {} },
        filterMode: filterMode || 'all',
        focusedTenantId,
        focusedProjectId
    }), [items, allDays, capacityConfig, filterMode, members, focusedTenantId, focusedProjectId]);

    const heatMap = useMemo(() => {
        const hMap = new Map<string, number>();
        metrics.forEach((m, key) => {
            hMap.set(key, QuantityEngine.getIntensity(m.ratio));
        });
        return hMap;
    }, [metrics]);

    const renderItemTitle = (item: Item) => {
        const isMine = item.created_by === currentUserId || item.assignedTo === currentUserId;
        const isProjectContext = focusedProjectId && item.projectId === focusedProjectId;
        if (isMine || isProjectContext) {
            return item.title;
        }
        return "予定あり (Private)";
    };

    const resetHighlights = () => {
        setPressureConnections([]);
        setFlashingItemIds(new Set());
        setSelectedSigns([]);
    };

    const handleDayAction = (date: Date, actionType: 'click' | 'doubleClick', rect?: DOMRect) => {
        const dateKey = date.toDateString();
        const metric = metrics.get(dateKey);
        const signs = metric?.contributingItems || [];

        if (actionType === 'click' && signs.length === 0) {
            resetHighlights();
        }

        if (onSelectDate) onSelectDate(date);

        if (actionType === 'doubleClick') {
            setSelectedSigns(signs);
            setPressureConnections([]);
        } else {
            if (!rect || !scrollContainerRef.current) return;
            const container = scrollContainerRef.current;
            const svg = container.querySelector('.pressure-lines-svg');
            const svgRect = svg ? svg.getBoundingClientRect() : container.getBoundingClientRect();

            const sourceX = rect.left + rect.width / 2 - svgRect.left;
            const sourceY = rect.top + rect.height / 2 - svgRect.top;

            const newConnections: PressureConnection[] = [];
            const newFlashingIds = new Set<string>();

            signs.forEach(item => {
                const chip = document.getElementById(`cal-chip-${item.id}`);
                if (chip) {
                    const chipRect = chip.getBoundingClientRect();
                    newConnections.push({
                        id: `${date.getTime()}-${item.id}`,
                        source: { x: sourceX, y: sourceY },
                        target: {
                            x: chipRect.left + chipRect.width / 2 - svgRect.left,
                            y: chipRect.top + chipRect.height / 2 - svgRect.top
                        },
                        color: '#fbbf24'
                    });
                    newFlashingIds.add(item.id);
                }
            });

            setPressureConnections(newConnections);
            setFlashingItemIds(newFlashingIds);
            setSelectedSigns([]);
        }
    };

    const commitPeriod = useMemo(() => {
        if (!selectedDate || workDays <= 1) return [];
        const days = [];
        for (let i = 0; i < workDays; i++) {
            const d = new Date(selectedDate);
            d.setDate(d.getDate() - i);
            days.push(d);
        }
        return days;
    }, [selectedDate, workDays]);

    return (
        <div className={cn("ryokan-calendar w-full h-full flex flex-col relative overflow-hidden bg-slate-50 dark:bg-slate-900 border-l-4 border-indigo-200 dark:border-indigo-800 font-sans")} ref={scrollContainerRef}>
            {!isMini && (
                <div className="flex-none px-4 py-2 bg-white/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between z-10">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-400 mr-2">表示モード</span>
                        {[
                            { id: 'grid', label: 'グリッド', icon: '📅' },
                            { id: 'timeline', label: 'タイムライン', icon: '➡️' },
                            { id: 'gantt', label: 'ガント', icon: '📊' }
                        ].map(mode => (
                            <button
                                key={mode.id}
                                onClick={() => setDisplayMode(mode.id as any)}
                                className={cn(
                                    "px-3 py-1 text-xs font-bold rounded-full transition-all flex items-center gap-1",
                                    displayMode === mode.id
                                        ? "bg-indigo-500 text-white shadow-md scale-105"
                                        : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-300"
                                )}
                            >
                                <span>{mode.icon}</span>
                                <span>{mode.label}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-hidden relative">
                {displayMode === 'timeline' && (
                    <RyokanTimelineView
                        allDays={allDays}
                        metrics={metrics}
                        heatMap={heatMap}
                        today={today}
                        selectedDate={selectedDate}
                        prepDate={prepDate}
                        isMini={isMini}
                        flashingItemIds={flashingItemIds}
                        pressureConnections={pressureConnections}
                        onItemClick={onItemClick}
                        onAction={handleDayAction}
                        commitPeriod={commitPeriod}
                        projects={projects}
                        renderItemTitle={renderItemTitle}
                        scrollRef={scrollContainerRef}
                        onBackgroundClick={resetHighlights}
                    />
                )}
                {displayMode === 'grid' && (
                    <RyokanGridView
                        allDays={allDays}
                        metrics={metrics}
                        heatMap={heatMap}
                        today={today}
                        onItemClick={onItemClick}
                        onAction={handleDayAction}
                        selectedDate={selectedDate}
                        prepDate={prepDate}
                        commitPeriod={commitPeriod}
                        scrollRef={scrollContainerRef}
                        projects={projects}
                        renderItemTitle={renderItemTitle}
                        pressureConnections={pressureConnections}
                        onBackgroundClick={resetHighlights}
                        flashingItemIds={flashingItemIds}
                    />
                )}
                {displayMode === 'gantt' && (
                    <RyokanGanttView
                        allDays={allDays}
                        items={items}
                        heatMap={heatMap}
                        today={today}
                        onItemClick={onItemClick}
                        safeConfig={capacityConfig || { defaultDailyMinutes: 480, holidays: [], exceptions: {} }}
                        rowHeight={24}
                        projects={projects}
                        onJumpToDate={(date) => {
                            if (onSelectDate) onSelectDate(date);
                        }}
                        renderItemTitle={renderItemTitle}
                    />
                )}
            </div>

            {selectedSigns.length > 0 && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[80vh]">
                        <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900 sticky top-0">
                            <div>
                                <h3 className="text-xl font-black text-slate-800 dark:text-slate-100 tracking-tight">負荷内訳</h3>
                                <p className="text-sm text-slate-400 font-bold mt-1">選択された日の影響要因</p>
                            </div>
                            <button onClick={() => setSelectedSigns([])} className="p-3 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-2xl transition-all">
                                <X className="w-6 h-6 text-slate-400" />
                            </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                            {selectedSigns.map((item: Item) => {
                                const proj = projects.find(p => p.id === item.projectId);
                                return (
                                    <div
                                        key={item.id}
                                        onClick={() => { onItemClick?.(item); setSelectedSigns([]); }}
                                        className={cn(
                                            "group flex items-center gap-3 p-3 rounded-xl border border-transparent hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer bg-white dark:bg-slate-900 border-l-4 shadow-sm",
                                            item.status === 'focus' ? "border-l-orange-400" :
                                                item.status === 'done' ? "border-l-emerald-400" :
                                                    item.status === 'waiting' ? "border-l-amber-400" : "border-l-slate-300"
                                        )}
                                    >
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                                                    {item.title}
                                                </span>
                                                {proj && (
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 dark:text-slate-400 truncate max-w-[120px]">
                                                        {proj.name}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-3">
                                                {item.due_date && (
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        期限: {format(new Date(item.due_date), 'MM/dd')}
                                                    </span>
                                                )}
                                                {item.estimatedMinutes && (
                                                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                                                        工数: {Math.round(item.estimatedMinutes / 60 * 10) / 10}h
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ChevronRight size={16} className="text-indigo-500" />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
