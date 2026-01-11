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
    onEditItem?: (item: Item) => void;
}

export const BucketColumn: React.FC<BucketColumnProps> = ({
    id,
    title,
    items,
    className,
    description,
    emptyMessage,
    footer,
    onEditItem
}) => {
    // Drop target configuration
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    return (
        <div className={cn("flex flex-col h-full", className)}>
            {/* Header */}
            <div className="flex items-baseline justify-between mb-4 px-1">
                <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">{title}</h2>
                    <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
                        {items.length}
                    </span>
                </div>
                {description && (
                    <span className="text-xs text-slate-500 dark:text-slate-400">{description}</span>
                )}
            </div>

            {/* Drop Area */}
            <div
                ref={setNodeRef}
                className={cn(
                    "flex-1 rounded-xl p-2 transition-colors overflow-y-auto min-h-[150px]",
                    "bg-slate-50/50 dark:bg-slate-900/20 box-border",
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
                                onDoubleClick={onEditItem}
                            />
                        ))}
                    </SortableContext>
                )}
                {/* Footer Action (e.g. Throw In button for Inbox) */}
                {footer && (
                    <div className="mt-2 text-center">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
