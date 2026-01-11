import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item } from '../../types';
import { GripVertical } from 'lucide-react';
import { cn } from '../../../../lib/utils'; // Assuming cn utility exists, if not will use standard class manipulation

interface ItemCardProps {
    item: Item;
    onClick?: (item: Item) => void;
    onDoubleClick?: (item: Item) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, onDoubleClick }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id, data: item });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "group relative flex items-center gap-2 px-2 py-1 mb-1 rounded-lg border backdrop-blur-sm transition-all",
                "bg-white/40 border-white/20 hover:bg-white/60 hover:border-white/40 shadow-sm",
                "dark:bg-slate-800/40 dark:border-white/10 dark:hover:bg-slate-800/60",
                item.interrupt && "border-amber-400/50 bg-amber-50/50 dark:border-amber-600/50 dark:bg-amber-900/10",
                "cursor-pointer select-none"
            )}
            onClick={() => onClick?.(item)}
            onDoubleClick={() => onDoubleClick?.(item)}
        >
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-400 cursor-grab active:cursor-grabbing p-1 -ml-1"
            >
                <GripVertical size={16} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-700 dark:text-slate-200 truncate text-sm">
                        {item.title}
                    </span>
                </div>
                {/* Meta / Tags could go here */}
                {(item.waitingReason || item.projectId) && (
                    <div className="flex gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        {item.waitingReason && (
                            <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                ⏳ {item.waitingReason}
                            </span>
                        )}
                        {/* Project Badge placeholder */}
                        {item.projectId && (
                            <span className="bg-blue-100/50 dark:bg-blue-900/30 px-1.5 rounded text-[10px]">
                                Project A
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Side Memo Indicator (MVP: Just an icon or subtle text) */}
            {item.memo && (
                <div className="text-[10px] text-slate-400 max-w-[80px] truncate border-l pl-2 border-slate-200 dark:border-slate-700">
                    {item.memo}
                </div>
            )}
        </div>
    );
};
