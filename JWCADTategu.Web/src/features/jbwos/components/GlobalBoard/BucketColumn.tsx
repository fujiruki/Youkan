import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ItemCard } from './ItemCard';
import { Item } from '../../types';
import { cn } from '../../../../lib/utils';

interface BucketColumnProps {
    id: string; // 'inbox', 'ready', 'waiting', 'pending'
    title: string;
    items: Item[];
    className?: string;
    description?: string; // e.g. "Max 2"
    emptyMessage?: React.ReactNode;
    footer?: React.ReactNode;
    onRenameItem?: (id: string, newTitle: string) => void;
    onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
    onClickItem?: (item: Item) => void; // [NEW]
    inputRef?: React.RefObject<HTMLInputElement>;
}

export const BucketColumn: React.FC<BucketColumnProps> = ({
    id,
    title,
    items,
    className,
    description,
    emptyMessage,
    footer,
    onRenameItem,
    onContextMenu,
    onClickItem // [NEW]
}) => {
    const MAX_VISIBLE = 5;
    const [expanded, setExpanded] = React.useState(false);

    // Drop target configuration
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    const visibleItems = expanded ? items : items.slice(0, MAX_VISIBLE);
    const hiddenCount = items.length - MAX_VISIBLE;

    return (
        <div className={cn("flex flex-col h-full text-[1em]", className)}>
            {/* Header */}
            <div className="flex items-baseline justify-between mb-2 px-1 shrink-0">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 text-[1.25em]">{title}</h2>
                    {/* Count Badge REMOVED per spec to reduce pressure */}
                </div>
                {description && (
                    <span className="text-slate-500 dark:text-slate-400 text-[0.75em]">{description}</span>
                )}
            </div>

            {/* Fixed Action Area (e.g. Throw In input) */}
            {footer && (
                <div className="mb-3 shrink-0">
                    {footer}
                </div>
            )}

            {/* Shelf Area (No Infinite Scroll) */}
            <div
                ref={setNodeRef}
                className={cn(
                    "flex-1 rounded-xl p-2 transition-colors min-h-[100px]",
                    // "overflow-y-auto" REMOVED per spec. Let it grow.
                    "bg-slate-50/50 dark:bg-slate-900/20 box-border",
                    "border-2 border-transparent",
                    isOver && "border-amber-400/50 bg-amber-50/30 dark:border-amber-500/30"
                )}
            >
                {items.length === 0 && emptyMessage ? (
                    <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400 min-h-[100px]">
                        {emptyMessage}
                    </div>
                ) : (
                    <>
                        <SortableContext
                            id={id}
                            items={visibleItems.map(i => i.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {visibleItems.map(item => (
                                <ItemCard
                                    key={item.id}
                                    item={item}
                                    onRename={onRenameItem}
                                    onContextMenu={onContextMenu}
                                    onClick={() => onClickItem?.(item)}
                                />
                            ))}
                        </SortableContext>

                        {/* Expand Trigger (Quiet) */}
                        {!expanded && hiddenCount > 0 && (
                            <button
                                onClick={() => setExpanded(true)}
                                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 py-2 mt-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                                ...他 {hiddenCount} 件を見る
                            </button>
                        )}

                        {/* Collapse Trigger (Optional, for UX) */}
                        {expanded && items.length > MAX_VISIBLE && (
                            <button
                                onClick={() => setExpanded(false)}
                                className="w-full text-center text-xs text-slate-300 hover:text-slate-500 py-2 mt-2"
                            >
                                閉じる
                            </button>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};
