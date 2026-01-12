import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item } from '../../types';
import { Calendar } from 'lucide-react';
import { cn } from '../../../../lib/utils';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';

interface ItemCardProps {
    item: Item;
    onClick?: (item: Item) => void;
    onRename?: (id: string, newTitle: string) => void;
    onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, onRename, onContextMenu }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: item.id, data: item });

    const { openCalendarForInbox, openCalendarForReady } = useGoogleCalendar();

    const [isEditing, setIsEditing] = React.useState(false);
    const [editValue, setEditValue] = React.useState(item.title);

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    const handleCalendarClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card select
        if (item.status === 'ready') {
            openCalendarForReady(item);
        } else {
            // Default to Inbox behavior (Judgment Resume Hook) for all other states
            openCalendarForInbox(item);
        }
    };

    const handleDoubleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onRename) {
            setIsEditing(true);
            setEditValue(item.title);
        }
    };

    const handleBlur = () => {
        setIsEditing(false);
        if (editValue.trim() && editValue !== item.title) {
            onRename?.(item.id, editValue);
        } else {
            setEditValue(item.title); // Revert if empty
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleBlur();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setEditValue(item.title);
        }
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={cn(
                "group relative flex items-center gap-2 px-2 py-[1px] mb-1 rounded-lg border backdrop-blur-sm transition-all",
                "bg-white/40 border-white/20 hover:bg-white/60 hover:border-white/40 shadow-sm",
                "dark:bg-slate-800/40 dark:border-white/10 dark:hover:bg-slate-800/60",
                item.interrupt && "border-amber-400/50 bg-amber-50/50 dark:border-amber-600/50 dark:bg-amber-900/10",
                "cursor-grab active:cursor-grabbing select-none text-[1em]", // Added cursor classes here
                isDragging && "opacity-50 z-50 ring-2 ring-indigo-400"
            )}
            onClick={() => onClick?.(item)}
            onDoubleClick={handleDoubleClick}
            onContextMenu={(e) => onContextMenu?.(e, item.id)}
        >
            {/* Drag Handle (Visual Only now) */}

            {/* Content (Inline Edit or Text) */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    {isEditing ? (
                        <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-white dark:bg-slate-900 border border-indigo-500 rounded px-1 py-0 text-[1em] focus:outline-none"
                        />
                    ) : (
                        <span className="font-medium text-slate-700 dark:text-slate-200 truncate text-[1em]">
                            {item.title}
                        </span>
                    )}
                </div>
                {/* Meta / Tags could go here */}
                {(item.waitingReason || item.projectId) && (
                    <div className="flex gap-2 mt-1 text-[0.8em] text-slate-500 dark:text-slate-400">
                        {item.waitingReason && (
                            <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                ⏳ {item.waitingReason}
                            </span>
                        )}
                        {/* Project Badge placeholder */}
                        {item.projectId && (
                            <span className="bg-blue-100/50 dark:bg-blue-900/30 px-1.5 rounded text-[0.9em]">
                                Project A
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Side Memo Indicator (MVP: Just an icon or subtle text) */}
            {item.memo && (
                <div className="text-[0.7em] text-slate-400 max-w-[80px] truncate border-l pl-2 border-slate-200 dark:border-slate-700">
                    {item.memo}
                </div>
            )}

            {/* Calendar Link (Hover only) - Logic based on status */}
            <div className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                    onClick={(e) => handleCalendarClick(e)}
                    className="p-1.5 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-colors"
                    title={item.status === 'ready' ? "作業予定をカレンダー登録" : "判断再開をカレンダー登録"}
                >
                    <Calendar size="1.2em" />
                </button>
            </div>
        </div>
    );
};
