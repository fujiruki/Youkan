import React from 'react';
import { Item } from '../../types';
import { format } from 'date-fns';
import { cn } from '../../../../../lib/utils';
import { Folder } from 'lucide-react';

interface SmartItemRowProps {
    item: Item;
    onFocus: (id: string, isIntent: boolean) => void;
    onClick: () => void;
    onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
    index?: number;
    isRecommended?: boolean;
}

const StatusBadge = ({ status, isIntent }: { status: string, isIntent?: boolean }) => {
    const base = "text-[9px] px-1 py-0 rounded-sm font-bold whitespace-nowrap uppercase tracking-tighter";
    if (status === 'inbox') return <span className={cn(base, "bg-orange-100 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400")}>受信</span>;
    if (status === 'pending') return <span className={cn(base, "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>保留</span>;
    if (status === 'waiting') return <span className={cn(base, "bg-purple-100 text-purple-600 dark:bg-purple-950/40 dark:text-purple-400")}>待機</span>;
    if (status === 'focus') {
        return isIntent
            ? <span className={cn(base, "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50")}>今日</span>
            : <span className={cn(base, "bg-blue-100 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400")}>Focus</span>;
    }
    return <span className={cn(base, "bg-gray-100 text-gray-500")}>{status}</span>;
};

/**
 * 超高密度（Ultra-High Density）タスク行
 * 2pxのマージン/パディング、1行表示、ソフトレコメンド対応。
 */
export const SmartItemRow: React.FC<SmartItemRowProps> = ({
    item,
    onFocus,
    onClick,
    onContextMenu,
    index,
    isRecommended
}) => {
    return (
        <div
            onClick={onClick}
            onContextMenu={(e) => {
                if (onContextMenu) {
                    e.preventDefault();
                    onContextMenu(e, item.id);
                }
            }}
            className={cn(
                "group flex items-center gap-1.5 px-1 py-0.5 border rounded-sm transition-all cursor-pointer select-none min-w-0 h-7",
                "bg-white dark:bg-slate-900",
                isRecommended
                    ? "border-indigo-300 dark:border-indigo-700 shadow-[0_0_8px_rgba(99,102,241,0.1)] z-10"
                    : "border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700",
                "mb-[2px]" // 2px margin
            )}
        >
            {/* Index / Reorder Handle placeholder */}
            {index !== undefined && (
                <span className="text-[9px] font-mono text-slate-300 dark:text-slate-700 w-3 text-right flex-shrink-0">
                    {index + 1}
                </span>
            )}

            {/* Status */}
            <StatusBadge status={item.status} isIntent={item.isIntent} />

            {/* Title & Project context */}
            <div className="flex-1 flex items-center min-w-0 gap-1.5 overflow-hidden">
                <span className={cn(
                    "text-xs font-medium truncate",
                    item.status === 'focus' ? "text-slate-800 dark:text-slate-100" : "text-slate-600 dark:text-slate-400"
                )}>
                    {item.title}
                </span>

                {item.projectTitle && (
                    <span className="flex items-center gap-0.5 text-[9px] text-slate-400 dark:text-slate-500 truncate opacity-70 group-hover:opacity-100 transition-opacity">
                        <Folder size={10} className="text-indigo-300/70" />
                        {item.projectTitle}
                    </span>
                )}
            </div>

            {/* Metadata (Tenant, Due, Time) */}
            <div className="flex items-center flex-shrink-0 ml-auto mr-1 gap-1">
                {/* Tenant Badge */}
                {item.tenantName && !item.tenantId?.startsWith('p_') && (
                    <span className="hidden xl:inline-block text-[8px] px-1 bg-slate-50 dark:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-sm border border-slate-100 dark:border-slate-700 truncate max-w-[40px]">
                        {item.tenantName}
                    </span>
                )}

                {/* Due Date - Fixed width to align vertically */}
                <div className="w-8 flex justify-center">
                    {item.due_date ? (
                        <span className={cn(
                            "text-[10px] font-bold whitespace-nowrap",
                            new Date(item.due_date).getTime() < Date.now() ? "text-red-500" : "text-slate-400"
                        )}>
                            {format(new Date(item.due_date), 'M/d')}
                        </span>
                    ) : (
                        <span className="text-[10px] text-slate-200 dark:text-slate-800 text-center">-</span>
                    )}
                </div>

                {/* Estimated Time - Fixed width to align vertically */}
                <div className="w-10 flex justify-end">
                    {item.estimatedMinutes ? (
                        <span className="text-[10px] font-mono text-slate-300 dark:text-slate-600 whitespace-nowrap group-hover:text-slate-500 transition-colors">
                            {item.estimatedMinutes}m
                        </span>
                    ) : (
                        <span className="text-[10px] text-slate-200 dark:text-slate-800">-</span>
                    )}
                </div>
            </div>

            {/* Actions (Hover only) */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                {item.status !== 'focus' && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onFocus(item.id, true); }}
                        className="text-[9px] bg-indigo-500 text-white px-1.5 py-0 rounded-sm hover:bg-indigo-600 font-bold h-5 shadow-sm"
                    >
                        今日
                    </button>
                )}
            </div>
        </div>
    );
};
