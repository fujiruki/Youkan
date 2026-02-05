import React, { useState, useRef, useEffect } from 'react';
import { Item } from '../../types';
import { format } from 'date-fns';
import { cn } from '../../../../../lib/utils';
import { NewspaperItemWrapper } from './useNewspaperItems';
import { Folder } from 'lucide-react';

interface NewspaperItemProps {
    wrapper: NewspaperItemWrapper;
    onClick: (item: Item) => void;
    onContextMenu: (e: React.MouseEvent, itemId: string) => void;
    onAddChild?: (item: Item, title: string) => void; // [CHANGED] Now receives title directly
}

const StatusDot = ({ status, isEngaged }: { status: string, isEngaged?: boolean }) => {
    if (status === 'done' || status === 'completed' || status === 'log') return null;

    if (isEngaged) {
        return (
            <div className="relative flex items-center justify-center w-[1em] h-[1em] shrink-0">
                <div className="absolute w-[0.6em] h-[0.6em] rounded-full bg-emerald-500 animate-ping opacity-75" />
                <div className="relative w-[0.55em] h-[0.55em] rounded-full bg-emerald-600 shadow-[0_0_8px_rgba(16,185,129,0.6)]" />
            </div>
        );
    }

    if (status === 'focus') {
        return (
            <div className="flex items-center justify-center w-[1em] h-[1em] shrink-0">
                <div className="w-[0.55em] h-[0.55em] rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]" />
            </div>
        );
    }

    // Default badges for other statuses
    const base = "px-[0.3em] py-0 rounded-[0.2em] font-bold whitespace-nowrap uppercase tracking-tighter leading-normal scale-90 origin-left";
    // [FIX] inbox (受信) is now hidden per user request - not needed for this view
    if (status === 'inbox') return null;
    if (status === 'pending') return <span className={cn(base, "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400")}>保留</span>;
    if (status === 'waiting') return <span className={cn(base, "bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400")}>待機</span>;

    return null;
};

export const NewspaperItem: React.FC<NewspaperItemProps> = ({ wrapper, onClick, onContextMenu, onAddChild }) => {
    const { item, isHeader, depth, project } = wrapper; // [FIX] Extract project from wrapper
    const [isInlineInputOpen, setIsInlineInputOpen] = useState(false);
    const [inlineInputValue, setInlineInputValue] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    // Auto-focus when input opens
    useEffect(() => {
        if (isInlineInputOpen && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isInlineInputOpen]);

    const handleInlineSubmit = () => {
        const trimmed = inlineInputValue.trim();
        // [FIX] Use project (real Item object) instead of item (virtual header object)
        const targetProject = project || item;
        if (trimmed && onAddChild) {
            onAddChild(targetProject as any, trimmed);
        }
        setInlineInputValue('');
        setIsInlineInputOpen(false);
    };

    const handleInlineCancel = () => {
        setInlineInputValue('');
        setIsInlineInputOpen(false);
    };

    if (isHeader) {
        return (
            <div
                className="mb-[0.5em] mt-[1em] break-inside-avoid group/header"
                style={{ breakAfter: 'avoid' }}
            >
                <div className="flex items-center gap-[0.5em] text-slate-700 dark:text-slate-200 font-bold border-b border-slate-200 dark:border-slate-700 pb-[0.2em] cursor-pointer hover:bg-slate-100/50 dark:hover:bg-slate-800/50 p-1 rounded transition-colors"
                    onClick={() => onClick(item)}
                >
                    <Folder size="1.1em" className="text-blue-500 fill-blue-500/10" />
                    <span className="truncate flex-1">{item.title}</span>
                    <button
                        className="opacity-0 group-hover/header:opacity-100 p-1 hover:bg-blue-100 dark:hover:bg-blue-900/50 rounded transition-all text-blue-600 dark:text-blue-400"
                        onClick={(e) => {
                            e.stopPropagation();
                            setIsInlineInputOpen(true);
                        }}
                    >
                        <span className="text-lg leading-none">+</span>
                    </button>
                </div>

                {/* Inline Input */}
                {isInlineInputOpen && (
                    <div className="mt-1 pl-[1.6em]">
                        <input
                            ref={inputRef}
                            type="text"
                            value={inlineInputValue}
                            onChange={(e) => setInlineInputValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleInlineSubmit();
                                } else if (e.key === 'Escape') {
                                    handleInlineCancel();
                                }
                            }}
                            onBlur={() => {
                                // Delay to allow button clicks
                                setTimeout(() => {
                                    if (!inlineInputValue.trim()) {
                                        handleInlineCancel();
                                    }
                                }, 150);
                            }}
                            placeholder="タイトルを入力して Enter..."
                            className="w-full text-[0.9em] px-2 py-1 border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                )}
            </div>
        );
    }


    const isDone = (item.status as string) === 'done' || (item.status as string) === 'completed' || (item.status as string) === 'log';

    return (
        <div
            onMouseUp={(e) => {
                if (e.button === 0) { // Left click only
                    onClick(item);
                }
            }}
            onContextMenu={(e) => {
                e.preventDefault();
                onContextMenu(e, item.id);
            }}
            className={
                cn(
                    "group flex items-center gap-[0.4em] px-[0.4em] py-[0.15em] rounded-[0.3em] transition-all cursor-pointer select-none relative z-10",
                    "hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:shadow-sm",
                    "break-inside-avoid",
                    "mb-[0.1em]",
                    isDone && "opacity-60 grayscale-[0.3]"
                )}
            style={{
                marginLeft: `${depth * 1}em` // 1em indent for children
            }}
        >
            {/* Title & Status wrapper */}
            <div className="flex-1 min-w-0 flex items-center gap-[0.4em] leading-tight pl-1">
                <span className={cn(
                    "text-[1em] font-medium break-words",
                    isDone ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"
                )}>
                    {item.title}
                </span>

                {/* Status Dot (Blue/Green) */}
                <StatusDot status={item.status} isEngaged={item.isEngaged} />
            </div>

            {/* Metadata (Due Date) */}
            {
                item.due_date && !isDone && (
                    <div className="shrink-0">
                        <span className={cn(
                            "text-[0.85em] font-bold whitespace-nowrap px-1 rounded",
                            new Date(item.due_date).getTime() < Date.now() ? "bg-red-50 text-red-500 dark:bg-red-950/20" : "text-slate-400"
                        )}>
                            {format(new Date(item.due_date), 'M/d')}
                        </span>
                    </div>
                )
            }
        </div >
    );
};
