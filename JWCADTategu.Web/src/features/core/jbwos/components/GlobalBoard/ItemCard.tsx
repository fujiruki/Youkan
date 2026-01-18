import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Item } from '../../types';
import { Calendar, Folder } from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { useGoogleCalendar } from '../../hooks/useGoogleCalendar';

interface ItemCardProps {
    item: Item;
    onClick?: (item: Item) => void;
    onRename?: (id: string, newTitle: string) => void;
    onContextMenu?: (e: React.MouseEvent, itemId: string) => void;
    isCompact?: boolean; // [NEW]
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, onRename, onContextMenu, isCompact }) => {
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
                "group relative flex items-start gap-2 rounded-lg transition-all", // Clean layout
                isCompact ? "px-2 py-0.5 mb-0" : "px-3 py-1 mb-0.5", // Compact Padding
                "bg-white/60 dark:bg-slate-800/60 hover:bg-white hover:shadow-sm dark:hover:bg-slate-800", // Minimal borders
                "border border-transparent hover:border-slate-100 dark:hover:border-slate-700", // Soft interactive border
                item.interrupt && "bg-amber-50/80 dark:bg-amber-900/20",
                "cursor-grab active:cursor-grabbing select-none",
                isCompact ? "text-[0.8em]" : "text-[0.95em]",
                isDragging && "opacity-50 z-50 ring-2 ring-indigo-400 bg-white shadow-lg"
            )}
            onClick={() => onClick?.(item)}
            onDoubleClick={handleDoubleClick}
            onContextMenu={(e) => onContextMenu?.(e, item.id)}
        >
            {/* Content (Inline Edit or Text) */}
            <div className="flex-1 min-w-0">
                <div className="flex flex-col gap-0.5">
                    {isEditing ? (
                        <input
                            autoFocus
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onBlur={handleBlur}
                            onKeyDown={handleKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            className="w-full bg-transparent border-b border-indigo-500 text-[1em] focus:outline-none p-0"
                        />
                    ) : (
                        <span className={cn(
                            "text-slate-700 dark:text-slate-200 font-medium leading-snug",
                            isCompact ? "line-clamp-1" : "line-clamp-2"
                        )}>
                            {/* Project Badge for Compact Mode */}
                            {isCompact && item.projectTitle && (
                                <span className="inline-block bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-1 rounded text-[0.85em] mr-1.5 align-baseline">
                                    {item.projectTitle.slice(0, 3)}
                                </span>
                            )}

                            {/* Folder Icon only if it IS a project (usually not in item buckets but safe to keep) */}
                            {item.isProject && <Folder size={isCompact ? 12 : 14} className="inline-block mr-1 text-slate-400 align-text-bottom" />}

                            {item.title}

                            {/* Full Project Title for Standard Mode */}
                            {!isCompact && item.projectTitle && (
                                <span className="ml-2 font-normal text-slate-400 text-[0.9em]">
                                    ({item.projectTitle})
                                </span>
                            )}
                        </span>
                    )}
                </div>
                {/* Meta / Tags */}
                {(item.waitingReason || item.projectId || item.due_status === 'waiting_external') && (
                    <div className="flex flex-wrap gap-2 mt-1.5 text-[0.75em] text-slate-400">
                        {item.due_status === 'waiting_external' && (
                            <span className="text-slate-500 font-normal">取付日未確定</span>
                        )}
                        {item.waitingReason && (
                            <span className="text-amber-600 dark:text-amber-500 flex items-center gap-1">
                                ⏳ {item.waitingReason}
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
