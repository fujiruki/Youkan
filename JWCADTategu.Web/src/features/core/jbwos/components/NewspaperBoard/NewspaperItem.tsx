import React from 'react';
import { Item } from '../../types';
import { format } from 'date-fns';
import { cn } from '../../../../../lib/utils';
import { NewspaperItemWrapper } from './useNewspaperItems';
import { Folder } from 'lucide-react';

interface NewspaperItemProps {
    wrapper: NewspaperItemWrapper;
    onClick: (item: Item) => void;
    onContextMenu: (e: React.MouseEvent, itemId: string) => void;
}

const StatusBadge = ({ status, isEngaged }: { status: string, isEngaged?: boolean }) => {
    // Uses em for padding to scale with font-size
    const base = "px-[0.3em] py-0 rounded-[0.2em] font-bold whitespace-nowrap uppercase tracking-tighter leading-normal";
    // Inbox: Cyan (Subtle, Fresh)
    if (status === 'inbox') return <span className={cn(base, "bg-cyan-50 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-400")}>受信</span>;
    // Pending: Slate (Static)
    if (status === 'pending') return <span className={cn(base, "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>保留</span>;
    // Waiting: Purple (Delegated, Soft)
    if (status === 'waiting') return <span className={cn(base, "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400")}>待機</span>;
    if (status === 'focus') {
        return isEngaged
            // Engaged: Amber (Active, Vivid)
            ? <span className={cn(base, "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50")}>実行中</span>
            // Focus: Indigo (Intent, Intelligent)
            : <span className={cn(base, "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400")}>Focus</span>;
    }
    return null; // hide other statuses like 'done' or 'focus' (if logic changes)
};

export const NewspaperItem: React.FC<NewspaperItemProps> = ({ wrapper, onClick, onContextMenu }) => {
    const { item, isHeader, depth } = wrapper;

    if (isHeader) {
        return (
            <div
                className="mb-[0.5em] mt-[1em] break-inside-avoid"
                style={{ breakAfter: 'avoid' }} // Standard CSS prop
            >
                <div className="flex items-center gap-[0.5em] text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 pb-[0.2em]">
                    <Folder size="1em" className="text-blue-500 fill-blue-500/10" />
                    <span className="truncate">{item.title}</span>
                </div>
            </div>
        );
    }

    const isDone = (item.status as string) === 'done' || (item.status as string) === 'completed' || (item.status as string) === 'log';

    return (
        <div
            onClick={() => onClick(item)}
            onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu(e, item.id);
            }}
            className={cn(
                "group flex items-start gap-[0.5em] px-[0.3em] py-[0.1em] rounded-[0.2em] transition-all cursor-pointer select-none",
                "hover:bg-slate-100 dark:hover:bg-slate-800",
                "break-inside-avoid", // Prevent item split
                "mb-[0.2em]",
                isDone && "opacity-60"
            )}
            style={{
                marginLeft: `${depth * 0.5}em`
            }}
        >
            {/* Status Badge */}
            {!isDone && <StatusBadge status={item.status} isEngaged={item.isEngaged} />}

            {/* Title */}
            <div className="flex-1 min-w-0 leading-tight pt-[0.1em]">
                <span className={cn(
                    "text-[1em] font-medium break-words", // allow wrap
                    isDone ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-300"
                )}>
                    {item.title}
                </span>
            </div>

            {/* Metadata (Due Date) */}
            {item.due_date && !isDone && (
                <div className="shrink-0 pt-[0.1em]">
                    <span className={cn(
                        "text-[0.85em] font-bold whitespace-nowrap",
                        new Date(item.due_date).getTime() < Date.now() ? "text-red-500" : "text-slate-400"
                    )}>
                        {format(new Date(item.due_date), 'M/d')}
                    </span>
                </div>
            )}
        </div>
    );
};
