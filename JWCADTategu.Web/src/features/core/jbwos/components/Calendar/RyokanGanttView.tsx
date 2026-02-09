import React, { useState, useRef } from 'react';
import { Item } from '../../types';
import { cn } from '../../../../../lib/utils';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { ChevronRight } from 'lucide-react';
import { isHoliday } from '../../logic/capacity';

const isSameDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
        d1.getMonth() === d2.getMonth() &&
        d1.getDate() === d2.getDate();
};

interface GanttViewProps {
    allDays: Date[];
    items: Item[];
    heatMap: Map<string, number>;
    today: Date;
    onItemClick?: (item: Item) => void;
    safeConfig: any;
    rowHeight: number;
    projects: any[];
    onJumpToDate?: (date: Date) => void;
    renderItemTitle: (item: Item) => string;
}

export const RyokanGanttView: React.FC<GanttViewProps> = ({
    allDays, items, heatMap: _heatMap, today, onItemClick, safeConfig, rowHeight, projects, onJumpToDate, renderItemTitle
}) => {
    const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    return (
        <div className="w-full h-full flex flex-col bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800">
            <div className="flex-none flex bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 z-20">
                <div className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 px-4 py-2 flex items-center">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">アイテム / プロジェクト</span>
                </div>
                <div className="flex flex-1 overflow-x-auto scrollbar-hide">
                    {allDays.map(date => (
                        <div key={date.toDateString()} className={cn(
                            "w-6 flex-shrink-0 text-center py-2 border-r border-slate-100 dark:border-slate-800/50 flex flex-col items-center",
                            isSameDate(date, today) ? "bg-blue-600/10" : ""
                        )}>
                            <span className="text-[8px] font-bold text-slate-400">{format(date, 'eee', { locale: ja })}</span>
                            <span className={cn(
                                "text-[10px] font-mono font-bold",
                                isSameDate(date, today) ? "text-blue-600" : "text-slate-600 dark:text-slate-400"
                            )}>{date.getDate()}</span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-hide" ref={scrollContainerRef}>
                <div className="min-w-max">
                    {items.map(item => {
                        const myDeadline = item.prep_date ? new Date(item.prep_date * 1000) : (item.due_date ? new Date(item.due_date) : null);
                        const wDays = item.work_days || Math.ceil((item.estimatedMinutes || 0) / 480) || 1;
                        let commitStart = myDeadline ? new Date(myDeadline) : null;
                        if (commitStart) {
                            let c = 0;
                            let s = 0;
                            while (c < wDays && s < 60) {
                                s++;
                                if (!isHoliday(commitStart, safeConfig)) c++;
                                if (c < wDays) commitStart.setDate(commitStart.getDate() - 1);
                            }
                        }
                        const project = projects.find(p => p.id === item.projectId);
                        const deadlineDate = myDeadline || (item.due_date ? new Date(item.due_date) : null);

                        return (
                            <div key={item.id} className="flex border-b border-slate-50 dark:border-slate-800/20 group transition-all">
                                <div
                                    className={cn(
                                        "sticky left-0 z-[10] w-64 flex-shrink-0 bg-slate-50/90 dark:bg-slate-900/90 border-r border-slate-200 dark:border-slate-800 px-2 flex items-center justify-between transition-colors",
                                        hoveredItemId === item.id ? "bg-indigo-50 dark:bg-indigo-900/40" : ""
                                    )}
                                    style={{ height: `${rowHeight}px` }}
                                    onMouseEnter={() => setHoveredItemId(item.id)}
                                    onMouseLeave={() => setHoveredItemId(null)}
                                >
                                    <div className="flex-1 min-w-0 pr-2 cursor-pointer" onClick={() => deadlineDate && onJumpToDate?.(deadlineDate)}>
                                        <div className="flex items-baseline gap-1.5">
                                            <span className={cn("truncate font-bold tracking-tight", hoveredItemId === item.id ? "text-xs text-indigo-600 dark:text-indigo-400" : "text-[10px] text-slate-500")}>
                                                {renderItemTitle(item)}
                                            </span>
                                            {project && <span className="truncate text-[9px] text-slate-400 ml-1">{project.name}</span>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {item.prep_date && (
                                                <span className="text-[9px] text-slate-400 font-mono tracking-tighter">My: {format(new Date(item.prep_date * 1000), 'MM/dd')}</span>
                                            )}
                                            {item.work_days ? (
                                                <span className="text-[9px] text-slate-400 font-mono tracking-tighter">工: {item.work_days}d</span>
                                            ) : item.estimatedMinutes ? (
                                                <span className="text-[9px] text-slate-400 font-mono tracking-tighter">工: {item.estimatedMinutes}m</span>
                                            ) : null}
                                        </div>
                                    </div>
                                    {hoveredItemId === item.id && (
                                        <button onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }} className="p-1 rounded bg-white dark:bg-slate-700 shadow-sm border border-slate-200 dark:border-slate-600 text-indigo-500 hover:text-indigo-600"><ChevronRight size={10} /></button>
                                    )}
                                </div>
                                <div className={cn("flex relative transition-all cursor-pointer", hoveredItemId === item.id ? "bg-indigo-50/20 dark:bg-indigo-900/10" : "")} style={{ height: `${rowHeight}px` }}>
                                    {allDays.map(date => {
                                        const isDue = item.due_date && isSameDate(date, new Date(item.due_date));
                                        const isCommit = commitStart && myDeadline && date >= commitStart && date <= myDeadline && !isHoliday(date, safeConfig);
                                        return (
                                            <div key={date.toDateString()} className={cn("w-6 flex-shrink-0 border-r border-slate-50 dark:border-slate-800/20 relative", isDue ? "bg-red-50/50" : "")} onClick={(e) => { e.stopPropagation(); onItemClick?.(item); }}>
                                                {isCommit && <div className="absolute inset-y-1 left-0 right-0 bg-indigo-400 dark:bg-indigo-500 rounded-sm" />}
                                                {isDue && <div className="absolute inset-y-0 left-1/2 w-0.5 bg-red-600" />}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
