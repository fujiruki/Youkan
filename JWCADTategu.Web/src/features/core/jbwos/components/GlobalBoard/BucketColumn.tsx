import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { ItemCard } from './ItemCard';
import { Item } from '../../types';
import { cn } from '../../../../../lib/utils';

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
    onCreateSubTask?: (parentId: string, title: string) => Promise<string | undefined>; // [NEW]
    inputRef?: React.RefObject<HTMLInputElement>;
    isCompact?: boolean; // [NEW] Super Compact Mode
    rowHeight?: number; // [NEW]
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
    onClickItem, // [NEW]
    onCreateSubTask, // [NEW]
    isCompact = false, // [NEW]
    rowHeight = 12
}) => {
    const MAX_VISIBLE = 5;
    const [expanded, setExpanded] = React.useState(false);

    // Drop target configuration
    const { setNodeRef, isOver } = useDroppable({
        id: id,
    });

    const visibleItems = (expanded || isCompact) ? items : items.slice(0, MAX_VISIBLE);
    const hiddenCount = items.length - MAX_VISIBLE;

    // [NEW] Hierarchical Sorting Helper
    const sortItemsHierarchically = (allItems: Item[]) => {
        const itemMap = new Map<string, Item>();
        const childrenMap = new Map<string, Item[]>();
        const roots: Item[] = [];

        // 1. Build Maps
        allItems.forEach(item => {
            itemMap.set(item.id, item);
            if (item.parentId && allItems.find(p => p.id === item.parentId)) {
                if (!childrenMap.has(item.parentId)) childrenMap.set(item.parentId, []);
                childrenMap.get(item.parentId)!.push(item);
            } else {
                roots.push(item);
            }
        });

        // 2. Flatten safely (Recursive)
        const result: { item: Item; depth: number }[] = [];
        const processItem = (item: Item, depth: number) => {
            result.push({ item, depth });
            const children = childrenMap.get(item.id) || [];
            children.forEach(child => processItem(child, depth + 1));
        };

        roots.forEach(root => processItem(root, 0));
        return result;
    };

    // Use hierarchical sort mainly for Panorama/Compact mode, 
    // or always if we want hierarchy in standard view too.
    // User requested specifically for Panorama ("Panorama Hierarchy").
    // Let's apply it generally for now as it's cleaner, or strictly if isCompact.
    // Given "Focus" view might rely on strict date ordering, maybe only for isCompact?
    // Let's try applying to visibleItems.

    const sortedHierarchy = React.useMemo(() => sortItemsHierarchically(visibleItems), [visibleItems]);

    return (
        <div className={cn(
            "flex flex-col text-[1em]", // Removed h-full for fluid layout
            isCompact ? "gap-0.5" : "gap-0 h-full", // Keep h-full only for Standard mode
            className
        )}>
            {/* Header */}
            <div className={cn(
                "flex items-baseline justify-between px-1 shrink-0",
                isCompact ? "mb-0.5 py-1 min-h-[24px]" : "mb-1"
            )}>
                <div className="flex items-center gap-2">
                    <h2 className={cn(
                        "font-bold text-slate-800 dark:text-slate-100",
                        isCompact ? "text-xs" : "text-[1.1em]"
                    )}>{title}</h2>
                    {/* Count Badge REMOVED per spec to reduce pressure */}
                </div>
                {description && (
                    <span className="text-slate-500 dark:text-slate-400 text-[0.7em]">{description}</span>
                )}
            </div>

            {/* Fixed Action Area (e.g. Throw In input) */}
            {footer && (
                <div className="mb-2 shrink-0">
                    {footer}
                </div>
            )}

            {/* Shelf Area (No Infinite Scroll) */}
            <div
                ref={setNodeRef}
                className={cn(
                    "flex-1 transition-colors min-h-[50px]",
                    isCompact ? "rounded-md p-1 bg-slate-100/30 dark:bg-slate-900/10" : "rounded-xl p-1 bg-slate-50/50 dark:bg-slate-900/20",
                    isCompact ? "" : "", // Removed overflow-y-auto for compact to let it grow in masonry
                    "box-border border-2 border-transparent",
                    isOver && "border-amber-400/50 bg-amber-50/30 dark:border-amber-500/30"
                )}
            >
                {items.length === 0 && emptyMessage ? (
                    <div className={cn(
                        "flex flex-col items-center justify-center text-center text-slate-400",
                        isCompact ? "p-2 text-[0.7em] min-h-[50px]" : "p-4 min-h-[100px]"
                    )}>
                        {emptyMessage}
                    </div>
                ) : (
                    <>
                        <SortableContext
                            id={id}
                            items={sortedHierarchy.map(x => x.item.id)}
                            strategy={verticalListSortingStrategy}
                        >
                            {sortedHierarchy.map(({ item, depth }) => (
                                <ItemCard
                                    key={item.id}
                                    item={item}
                                    onRename={onRenameItem}
                                    onContextMenu={onContextMenu}
                                    onClick={() => onClickItem?.(item)}
                                    isCompact={isCompact}
                                    depth={depth} // [NEW] Pass depth
                                    onCreateSubTask={onCreateSubTask} // [NEW] Connect function
                                    rowHeight={rowHeight} // [FIX] Required for density sync
                                />
                            ))}
                        </SortableContext>

                        {/* Expand Trigger (View All) - Only for Standard Mode or if we want to limit in Compact? */}
                        {/* In Panorama/Compact, we usually want to scroll, so maybe 'expanded' logic is only for Standard? */}
                        {/* Let's disable expansion limit in Compact mode to allow scrolling */}
                        {!isCompact && !expanded && hiddenCount > 0 && (
                            <button
                                onClick={() => setExpanded(true)}
                                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 py-2 mt-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                                ...他 {hiddenCount} 件を見る
                            </button>
                        )}

                        {/* Collapse Trigger (Optional, for UX) */}
                        {!isCompact && expanded && items.length > MAX_VISIBLE && (
                            <button
                                onClick={() => setExpanded(false)}
                                className="w-full text-center text-xs text-slate-300 hover:text-slate-500 py-2 mt-2"
                            >
                                閉じる
                            </button>
                        )}

                        {/* Compact Mode: Always show all (via overflow), no "more" button needed */}
                    </>
                )}
            </div>
        </div>
    );
};
