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
    onContextMenu?: (e: React.MouseEvent, itemId: string) => void; // [NEW]
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
    onContextMenu
}) => {
    // Drop target configuration
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    return (
        <div className={cn("flex flex-col h-full text-[1em]", className)}>
            {/* Header */}
            <div className="flex items-baseline justify-between mb-2 px-1 shrink-0">
                <div className="flex items-center gap-2">
                    <h2 className="font-bold text-slate-800 dark:text-slate-100 text-[1.25em]">{title}</h2>
                    <span className="font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full text-[0.75em]">
                        {items.length}
                    </span>
                </div>
                {description && (
                    <span className="text-slate-500 dark:text-slate-400 text-[0.75em]">{description}</span>
                )}
            </div>

            {/* Fixed Action Area (e.g. Throw In input) - Moved outside scroll area */}
            {footer && (
                <div className="mb-3 shrink-0">
                    {footer}
                </div>
            )}

            {/* Drop Area */}
            <div
                ref={setNodeRef}
                className={cn(
                    "flex-1 rounded-xl p-2 transition-colors overflow-y-auto min-h-[150px]",
                    "bg-slate-50/50 dark:bg-slate-900/20 box-border scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700",
                    "border-2 border-transparent",
                    isOver && "border-amber-400/50 bg-amber-50/30 dark:border-amber-500/30"
                )}
            >
                {items.length === 0 && emptyMessage ? (
                    <div className="h-full flex flex-col items-center justify-center p-4 text-center">
                        {emptyMessage}
                    </div>
                ) : (
                    <SortableContext
                        id={id}
                        items={items.map(i => i.id)}
                        strategy={verticalListSortingStrategy}
                    >
                        {items.map(item => (
                            <ItemCard
                                key={item.id}
                                item={item}
                                onRename={onRenameItem}
                                onContextMenu={onContextMenu}
                            />
                        ))}
                    </SortableContext>
                )}
            </div>
        </div>
    );
};
