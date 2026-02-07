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
    isCompact?: boolean;
    depth?: number;
    onCreateSubTask?: (parentId: string, title: string) => Promise<string | undefined>;
    rowHeight?: number;
}

export const ItemCard: React.FC<ItemCardProps> = ({ item, onClick, onRename, onContextMenu, isCompact, depth = 0, onCreateSubTask, rowHeight = 12 }) => {
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

    // [NEW] Sub-task Creation State
    const [isAddingSubTask, setIsAddingSubTask] = React.useState(false);
    const [subTaskTitle, setSubTaskTitle] = React.useState('');

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        marginLeft: `${depth * 1.5}em`, // [NEW] Visible indentation
    };

    const handleCalendarClick = (e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent card select
        if (item.status === 'focus') {
            openCalendarForReady(item); // Maybe rename hook method too later, but compatible for now.
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

    // [NEW] Sub-task Handle
    const handleSubTaskKeyDown = async (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && subTaskTitle.trim()) {
            e.preventDefault();
            e.stopPropagation();
            if (onCreateSubTask) {
                await onCreateSubTask(item.id, subTaskTitle);
                setSubTaskTitle(''); // Clear and keep input open for multiple
                // setIsAddingSubTask(false); // Valid UX: Keep adding
            }
        } else if (e.key === 'Escape') {
            setIsAddingSubTask(false);
        }
    };

    const cardPadding = rowHeight <= 14 ? 'py-0.5 px-1' : (rowHeight >= 24 ? 'py-1.5 px-2.5' : 'py-1 px-1.5');

    return (
        <>
            <div
                ref={setNodeRef}
                style={style}
                {...attributes}
                {...listeners}
                className={cn(
                    "group relative flex items-start gap-1 rounded transition-all", // Clean layout (gap reduced 2->1)
                    "mb-[2px]", // 2px Vertical Margin
                    cardPadding,
                    "bg-white/40 dark:bg-slate-800/40 hover:bg-white hover:shadow-sm dark:hover:bg-slate-800", // Minimal borders
                    "border border-transparent hover:border-slate-100 dark:hover:border-slate-700", // Soft interactive border
                    item.interrupt && "bg-amber-50/80 dark:bg-amber-900/20",
                    "cursor-grab active:cursor-grabbing select-none",
                    "text-[12px]", // Single fixed density for list overview
                    isDragging && "opacity-50 z-50 ring-1 ring-indigo-400 bg-white shadow-md"
                )}
                onClick={() => onClick?.(item)}
                onDoubleClick={handleDoubleClick}
                onContextMenu={(e) => onContextMenu?.(e, item.id)}
            >
                {/* Content (Inline Edit or Text) */}
                <div className="flex-1 min-w-0 flex items-center justify-between gap-2 overflow-hidden">
                    {/* Left: Title + Project Name Area */}
                    <div className="flex items-center gap-1.5 min-w-0 overflow-hidden">
                        {item.isProject && <Folder size={isCompact ? 12 : 14} className="shrink-0 text-slate-400" />}

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
                            <>
                                <span className={cn(
                                    "text-slate-700 dark:text-slate-200 font-medium leading-snug truncate",
                                    isCompact ? "text-[0.9em]" : "text-[0.95em]"
                                )}>
                                    {item.title}
                                </span>

                                {/* Project Name (Muted Gray, No background) */}
                                {item.projectTitle && (
                                    <span className="text-[11px] text-slate-400 dark:text-slate-500 font-normal max-w-[120px] truncate shrink-0 ml-1" title={item.projectTitle}>
                                        {item.projectTitle.length > 4 ? `${item.projectTitle.substring(0, 4)}...` : item.projectTitle}
                                    </span>
                                )}
                            </>
                        )}
                    </div>

                    {/* Right: Meta Badges (Assignee, Date, Wait, etc) */}
                    {(item.assigneeName || item.due_date || item.waitingReason || item.dueStatus) && !isEditing && (
                        <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                            {/* Assignee Badge [NEW] */}
                            {item.assigneeName && (
                                <div
                                    className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold text-white shadow-sm shrink-0"
                                    style={{ backgroundColor: item.assigneeColor || '#ccc' }}
                                    title={item.assigneeName}
                                >
                                    {item.assigneeName.charAt(0)}
                                </div>
                            )}

                            {/* [FIX] Standardized Status Badges (Matching NewspaperItem) */}
                            {item.status === 'pending' && (
                                <span className="px-1 py-0.5 rounded-[0.2em] font-bold text-[0.75em] bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 whitespace-nowrap">保留</span>
                            )}
                            {item.status === 'waiting' && (
                                <span className="px-1 py-0.5 rounded-[0.2em] font-bold text-[0.75em] bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-400 whitespace-nowrap">待機</span>
                            )}

                            {/* Deadline Display */}
                            {item.due_date && (
                                <span className={cn(
                                    "flex items-center gap-1 text-[0.75em] font-medium px-1.5 py-0.5 rounded border",
                                    "text-rose-500 dark:text-rose-400 bg-rose-50 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800"
                                )}>
                                    <span className="whitespace-nowrap">
                                        {new Date(item.due_date).toLocaleDateString('ja-JP', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                                    </span>
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Side Memo Indicator (MVP: Just an icon or subtle text) */}
                {item.memo && (
                    <div className="shrink-0 text-[0.7em] text-slate-400 max-w-[60px] truncate border-l pl-2 border-slate-200 dark:border-slate-700 hidden sm:block">
                        {item.memo}
                    </div>
                )}

                {/* [NEW] Quick Add Button */}
                {isCompact && onCreateSubTask && (
                    <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center shrink-0">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsAddingSubTask(!isAddingSubTask);
                            }}
                            className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-green-500 transition-colors"
                            title="小タスクを追加"
                        >
                            +
                        </button>
                    </div>
                )}

                {/* Calendar Link (Hover only) */}
                <div className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <button
                        onClick={(e) => handleCalendarClick(e)}
                        className="p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-400 hover:text-blue-500 transition-colors"
                        title={item.status === 'focus' ? "作業予定をカレンダー登録" : "判断再開をカレンダー登録"}
                    >
                        <Calendar size="1em" />
                    </button>
                </div>
            </div>

            {/* [NEW] Inline Sub-task Creator */}
            {
                isAddingSubTask && (
                    <div
                        style={{ marginLeft: `${(depth + 1) * 1.5}em` }}
                        className="flex items-center gap-2 mb-1 px-2 py-1 animate-in fade-in slide-in-from-top-1"
                    >
                        <span className="text-slate-400">↳</span>
                        <input
                            autoFocus
                            value={subTaskTitle}
                            onChange={(e) => setSubTaskTitle(e.target.value)}
                            onKeyDown={handleSubTaskKeyDown}
                            placeholder="小タスク名を入力..."
                            className="flex-1 bg-transparent border-b border-indigo-300 dark:border-indigo-700 text-[0.8em] focus:outline-none p-0.5"
                        />
                    </div>
                )
            }
        </>
    );
};
