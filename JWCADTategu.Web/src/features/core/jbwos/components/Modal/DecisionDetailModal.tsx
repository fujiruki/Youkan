import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, PauseCircle, CheckCircle2, Folder, Plus, CheckSquare } from 'lucide-react';
import { Item, Member } from '../../types';
import { cn } from '../../../../../lib/utils';
import { ApiClient } from '../../../../../api/client';
import { format } from 'date-fns';
import { SmartDateInput } from '../Inputs/SmartDateInput';
import { SideCalendarPanel } from '../Inputs/SideCalendarPanel';
import { calculateDailyVolume } from '../../logic/volumeCalculator';

interface DecisionDetailModalProps {
    item: Item | null;
    onClose: () => void;
    onDecision: (id: string, decision: 'yes' | 'hold' | 'no', note?: string, updates?: Partial<Item>) => void;
    onDelete: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Item>) => Promise<void>;
    onCreateSubTask?: (parentId: string, title: string, initialDueDate?: string) => Promise<string | undefined>; // [FIX] Added initialDueDate
    onGetSubTasks?: (parentId: string) => Promise<Item[]>; // [NEW]
    onDelegate?: (taskId: string, assignedTo: string, dueDate?: string, note?: string) => Promise<void>; // [NEW]
    onOpenItem?: (item: Item) => void; // [NEW] Drill-down navigation
    onOpenParent?: (parentId: string) => void; // [NEW] Drill-up navigation
    members?: Member[]; // [NEW]
    // Custom Labels
    yesButtonLabel?: string;
    initialFocus?: 'date';
}

export const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({ item, onClose, onDecision, onDelete, onUpdate, onCreateSubTask, onGetSubTasks, onDelegate, onOpenItem, onOpenParent, members = [], initialFocus, yesButtonLabel }) => {
    // [FIX] Hooks must be called unconditionally.
    // Initialize with safe defaults.
    const [note, setNote] = React.useState('');
    const [dueStatus, setDueStatus] = React.useState<any>('waiting_external');
    const [dueDate, setDueDate] = React.useState('');
    const [prepDate, setPrepDate] = React.useState('');
    const [workDays, setWorkDays] = React.useState(1);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [isWorkDaysDirty] = React.useState(false);
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [editedTitle, setEditedTitle] = React.useState('');
    const [estimatedMinutes, setEstimatedMinutes] = React.useState(0);

    const [subTasks, setSubTasks] = React.useState<Item[]>([]);
    const [newSubTaskTitle, setNewSubTaskTitle] = React.useState('');
    const [isProject, setIsProject] = React.useState(false);

    // [NEW] Calendar State
    const [viewMonth, setViewMonth] = React.useState<Date>(new Date());
    const [activeDateInput, setActiveDateInput] = React.useState<'due' | 'my' | null>('due');
    const [dailyVolumes, setDailyVolumes] = React.useState<Map<string, number>>(new Map());

    // Sync state when item changes
    React.useEffect(() => {
        if (item) {
            setNote(item.memo || '');
            setDueStatus(item.dueStatus || 'waiting_external');
            setDueDate(item.due_date || '');
            setPrepDate(item.prep_date ? new Date(item.prep_date * 1000).toISOString().split('T')[0] : '');
            setWorkDays(item.work_days ?? 1);
            setEditedTitle(item.title);
            setEstimatedMinutes(item.estimatedMinutes ?? 0);
            setIsProject(item.isProject ?? false);
            // Default subTasks to empty until fetched
            setSubTasks([]);
        }
    }, [item]);

    // Now safe to return null if no item, as hooks are already registered
    // Early return removed to allow hooks to run.
    // Null check moved to pre-render.

    // [NEW] Fetch Heatmap Data when viewMonth changes
    React.useEffect(() => {
        const fetchLoad = async () => {
            try {
                const year = viewMonth.getFullYear();
                const month = viewMonth.getMonth() + 1;
                // Currently getCalendarLoad returns Promise<any[]> (Item objects with prep/due dates)
                const items = await ApiClient.getCalendarLoad(year, month);

                // Calculate volume using shared logic
                const volMap = calculateDailyVolume(items);
                setDailyVolumes(volMap);
            } catch (e) {
                console.error("Failed to load calendar volume:", e);
            }
        };
        fetchLoad();
    }, [viewMonth]);


    // [NEW] Load Sub-tasks & Optimistic Defaults
    // [NEW] Load Sub-tasks & Optimistic Defaults
    React.useEffect(() => {
        if (!item) return; // Guard

        if (isProject && onGetSubTasks) {
            console.log('[Modal] Fetching subtasks for:', item.id);
            onGetSubTasks(item.id).then(tasks => {
                console.log('[Modal] Subtasks loaded:', tasks.length);
                setSubTasks(tasks);
            });
        }

        // Optimistic Due Date Logic (Default to Today if Waiting)
        if (item.dueStatus === 'waiting_external') {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            setDueDate(todayStr); // In-memory only until save
            setDueStatus('confirmed');
            // Note: We are NOT saving to DB yet to allow "Esc" to cancel without side effects, 
            // but UI will look like it's confirmed.
            // If user interacts (e.g. Enter), handleClose/Decision will save `dueDate`.
        }
    }, [item?.id, isProject, onGetSubTasks, item?.dueStatus]);

    // Menu Latching State
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const menuRef = React.useRef<HTMLDivElement>(null);

    const dateInputRef = React.useRef<HTMLInputElement>(null);
    const titleInputRef = React.useRef<HTMLInputElement>(null);

    // ... Initial Focus Logic ...

    // Click Outside for Menu Latching
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isMenuOpen]);

    // Sync prop changes
    // Duplicate Sync Effect Removed (Logic is handled by top-level effect)

    // [NEW] Enhanced Keyboard Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!item) return; // Guard
            // [FIX] Stop propagation to prevent background GDB from reacting
            e.stopPropagation();

            // Alt + D: Focus Date
            if (e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                if (dueStatus === 'waiting_external') {
                    setDueStatus('confirmed');
                    const updates: Partial<Item> = { dueStatus: 'confirmed' };
                    if (onUpdate) onUpdate(item.id, updates);
                    else ApiClient.updateItem(item.id, updates);
                }
                setTimeout(() => dateInputRef.current?.focus(), 50);
            }

            // Ctrl + Enter: Immediate decision "Yes" (Today) - Execute and close modal
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                handleDecisionWithSave('yes');
                return; // Exit early to prevent further processing
            }

            // Esc: Close (Keep in Inbox)
            if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [item ? item.id : null, dueStatus, note, workDays, onDecision, onClose, onUpdate, isWorkDaysDirty]);

    // [NEW] Unified Save Helper -> Returns pending updates instead of calling API immediately
    const getPendingChanges = () => {
        if (!item) return {};
        const updates: Partial<Item> = {};

        // Work Days
        if (isWorkDaysDirty || workDays !== item.work_days) {
            updates.work_days = workDays;
        }
        // Estimated Minutes
        if (estimatedMinutes !== (item.estimatedMinutes || 0)) {
            updates.estimatedMinutes = estimatedMinutes;
        }
        // Memo (Note)
        if (note !== (item.memo || '')) {
            updates.memo = note;
        }
        // Prep Date (Safety check)
        const itemPrepStr = item.prep_date ? new Date(item.prep_date * 1000).toISOString().split('T')[0] : '';
        if (prepDate !== itemPrepStr) {
            const dateObj = new Date(prepDate);
            const timestamp = !isNaN(dateObj.getTime()) ? Math.floor(dateObj.getTime() / 1000) : null;
            if (timestamp !== item.prep_date) {
                updates.prep_date = timestamp;
            }
        }
        // Due Date (Safety check)
        // Due Date (Safety check)
        if (dueDate !== (item.due_date || '')) {
            updates.due_date = dueDate;
            updates.dueStatus = dueStatus; // If date changed, likely status is confirmed
        }
        // Title
        if (editedTitle !== item.title) {
            updates.title = editedTitle;
        }

        return updates;
    };

    const saveChanges = async () => {
        if (!item) return;
        const updates = getPendingChanges();
        if (Object.keys(updates).length > 0) {
            console.log('Saving changes before close:', updates);
            if (onUpdate) {
                await onUpdate(item.id, updates);
            } else {
                await ApiClient.updateItem(item.id, updates);
            }
        }
    };

    // [NEW] Save work_days AND estimatedMinutes and close
    const handleClose = async () => {
        await saveChanges();
        onClose();
    };

    // [NEW] Helper to save work_days before decision
    const handleDecisionWithSave = async (decision: 'yes' | 'hold' | 'no') => {
        if (!item) return;
        const updates = getPendingChanges();

        // [FIX] Auto-set Today's date if "Yes" (Today) is chosen and no date is set
        if (decision === 'yes') {
            const todayStr = format(new Date(), 'yyyy-MM-dd');
            if (!updates.due_date && !item.due_date) {
                updates.due_date = todayStr;
                updates.dueStatus = 'confirmed';
            }
        }

        console.log('Resolving decision with atomic updates:', updates);
        // Pass updates to onDecision to handle them atomically or strictly sequentially
        onDecision(item.id, decision, note, updates);
    };

    // [FIX] Null check before rendering, AFTER all hooks are declared.
    if (!item) return null;

    return (
        <AnimatePresence>
            {item && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        data-testid="modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                        onClick={handleClose}
                    />    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="relative z-10 w-full max-w-lg md:max-w-4xl bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh] md:h-[650px]"
                    >
                        {/* Header Area */}
                        <div className="p-4 pb-3 flex justify-between items-start flex-none"> {/* [FIX] flex-none to prevent shrinking */}
                            <div className="flex-1 min-w-0">

                                {item.projectTitle && (
                                    <div
                                        onClick={() => item.parentId && onOpenParent?.(item.parentId)}
                                        className={cn(
                                            "flex items-center gap-2 text-lg font-bold text-slate-400 mb-1 leading-snug",
                                            item.parentId && "cursor-pointer hover:text-blue-500 transition-colors"
                                        )}
                                        title={item.parentId ? "親プロジェクトを開く" : undefined}
                                    >
                                        <Folder size={18} />
                                        <span>{item.projectTitle}</span>
                                    </div>
                                )}
                                {isEditingTitle ? (
                                    <input
                                        ref={titleInputRef}
                                        type="text"
                                        value={editedTitle}
                                        onChange={(e) => setEditedTitle(e.target.value)}
                                        onBlur={async () => {
                                            setIsEditingTitle(false);
                                            if (editedTitle !== item.title) {
                                                if (onUpdate) {
                                                    await onUpdate(item.id, { title: editedTitle });
                                                } else {
                                                    await ApiClient.updateItem(item.id, { title: editedTitle });
                                                }
                                            }
                                        }}
                                        onKeyDown={async (e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                const newTitle = editedTitle.trim();
                                                if (!newTitle) {
                                                    setEditedTitle(item.title);
                                                    setIsEditingTitle(false);
                                                    return;
                                                }
                                                setIsEditingTitle(false);
                                                if (newTitle !== item.title) {
                                                    // [FIX] Update immediately and wait
                                                    if (onUpdate) await onUpdate(item.id, { title: newTitle });
                                                    else await ApiClient.updateItem(item.id, { title: newTitle });
                                                }
                                            } else if (e.key === 'Escape') {
                                                setEditedTitle(item.title);
                                                setIsEditingTitle(false);
                                            }
                                        }}
                                        className="w-full text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug bg-white dark:bg-slate-800 border-b-2 border-indigo-500 focus:outline-none px-2 rounded-t"
                                        autoFocus
                                    />
                                ) : (
                                    <h2
                                        className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug cursor-pointer hover:text-indigo-600 transition-colors pl-0"
                                        onClick={() => setIsEditingTitle(true)}
                                        title="クリックして編集"
                                    >
                                        {item.title}
                                    </h2>
                                )}
                            </div>

                            {/* Right: Quick Actions + Close */}
                            <div className="flex items-start gap-2 ml-4">
                                <button onClick={handleClose} className="p-2 -mr-2 -mt-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Main Content Area (2-Column Layout) */}
                        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">

                            {/* LEFT COLUMN: Inputs & Calendar */}
                            {/* LEFT COLUMN: Inputs & Calendar */}
                            <div className="flex-1 flex flex-col min-w-0 md:border-r border-slate-100 dark:border-slate-800 h-full">

                                {/* Top: Inputs Section (Compact) */}
                                <div className="p-3 pb-1 flex-none border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

                                        {/* Due Date */}
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center justify-between">
                                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                    <div className="w-1 h-2.5 bg-red-400 rounded-full"></div>
                                                    納期
                                                </span>
                                                <button
                                                    onClick={async () => {
                                                        const newStatus = dueStatus === 'waiting_external' ? 'confirmed' : 'waiting_external';
                                                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                                                        const newDateVal = newStatus === 'waiting_external' ? null : (dueDate || todayStr);
                                                        setDueStatus(newStatus as any);
                                                        if (newStatus === 'confirmed' && !dueDate) setDueDate(todayStr); // Only auto-set if empty
                                                        const updates: Partial<Item> = { dueStatus: newStatus as any, due_date: newDateVal };
                                                        if (onUpdate) await onUpdate(item.id, updates);
                                                        else await ApiClient.updateItem(item.id, updates);
                                                    }}
                                                    className="text-[10px] text-slate-300 hover:text-indigo-500 underline"
                                                >
                                                    {dueStatus === 'waiting_external' ? '設定' : '未定'}
                                                </button>
                                            </div>
                                            {dueStatus === 'waiting_external' ? (
                                                <div
                                                    onClick={async () => {
                                                        const todayStr = format(new Date(), 'yyyy-MM-dd');
                                                        setDueStatus('confirmed');
                                                        setDueDate(todayStr);
                                                        const updates: Partial<Item> = { dueStatus: 'confirmed', due_date: todayStr };
                                                        if (onUpdate) await onUpdate(item.id, updates);
                                                        else await ApiClient.updateItem(item.id, updates);
                                                    }}
                                                    className="bg-slate-50 dark:bg-slate-800/50 rounded px-2 py-1.5 text-xs text-slate-400 font-medium border border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 transition-colors text-center"
                                                >
                                                    未記入
                                                </div>
                                            ) : (
                                                <div className="relative group">
                                                    <div className="hidden md:block">
                                                        <SmartDateInput
                                                            value={dueDate ? new Date(dueDate) : null}
                                                            onChange={async (d) => {
                                                                const val = d ? format(d, 'yyyy-MM-dd') : '';
                                                                setDueDate(val);
                                                                if (d) setViewMonth(d);
                                                                const updates: Partial<Item> = { due_date: val, dueStatus: 'confirmed' };
                                                                if (onUpdate) await onUpdate(item.id, updates);
                                                                else await ApiClient.updateItem(item.id, updates);
                                                            }}
                                                            onFocus={() => {
                                                                setActiveDateInput('due');
                                                                if (dueDate) setViewMonth(new Date(dueDate));
                                                            }}
                                                            autoFocus={initialFocus === 'date' || !dueDate}
                                                            className="text-xs py-1"
                                                        />
                                                    </div>
                                                    <div className="md:hidden">
                                                        <input
                                                            type="date"
                                                            value={dueDate}
                                                            onChange={async (e) => {
                                                                const val = e.target.value;
                                                                setDueDate(val);
                                                                if (val) setViewMonth(new Date(val));
                                                                const updates: Partial<Item> = { due_date: val, dueStatus: 'confirmed' as any };
                                                                if (onUpdate) await onUpdate(item.id, updates);
                                                                else await ApiClient.updateItem(item.id, updates);
                                                            }}
                                                            onFocus={() => {
                                                                setActiveDateInput('due');
                                                                if (dueDate) setViewMonth(new Date(dueDate));
                                                            }}
                                                            className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded px-2 py-1.5 text-xs"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* My Date */}
                                        <div className="flex flex-col gap-0.5">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                <div className="w-1 h-2.5 bg-indigo-400 rounded-full"></div>
                                                My期限
                                            </span>
                                            <div className="relative group/mydate">
                                                <div className="hidden md:block">
                                                    <SmartDateInput
                                                        value={prepDate ? new Date(prepDate) : null}
                                                        onChange={async (d) => {
                                                            const val = d ? format(d, 'yyyy-MM-dd') : '';
                                                            setPrepDate(val);
                                                            if (d) setViewMonth(d);
                                                            const dateObj = new Date(val);
                                                            const timestamp = !isNaN(dateObj.getTime()) ? Math.floor(dateObj.getTime() / 1000) : null;
                                                            const updates = { prep_date: timestamp };
                                                            if (onUpdate) await onUpdate(item.id, updates);
                                                            else await ApiClient.updateItem(item.id, updates);
                                                        }}
                                                        onFocus={() => {
                                                            setActiveDateInput('my');
                                                            if (prepDate) setViewMonth(new Date(prepDate));
                                                        }}
                                                        placeholder="目標日..."
                                                        className={cn(
                                                            "w-full bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 transition-colors",
                                                            activeDateInput === 'my' ? "ring-1 ring-indigo-400 border-indigo-300" : "focus:ring-1 focus:ring-indigo-400"
                                                        )}
                                                    />
                                                </div>
                                                <div className="md:hidden">
                                                    <input
                                                        type="date"
                                                        value={prepDate}
                                                        onChange={async (e) => {
                                                            const val = e.target.value;
                                                            setPrepDate(val);
                                                            const dateObj = new Date(val);
                                                            const timestamp = !isNaN(dateObj.getTime()) ? Math.floor(dateObj.getTime() / 1000) : null;
                                                            const updates: Partial<Item> = { prep_date: timestamp || undefined }; // Explicit undefined
                                                            if (onUpdate) await onUpdate(item.id, updates);
                                                            else await ApiClient.updateItem(item.id, updates);
                                                        }}
                                                        onFocus={() => {
                                                            setActiveDateInput('my');
                                                            if (prepDate) setViewMonth(new Date(prepDate));
                                                        }}
                                                        className={cn(
                                                            "bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded px-2 py-1.5 text-xs text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-1 w-full transition-colors",
                                                            activeDateInput === 'my' ? "ring-1 ring-indigo-400 border-indigo-300" : "focus:ring-indigo-400"
                                                        )}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Middle: Calendar (Fills remaining space) */}
                                <div className="flex-1 min-h-0 hidden md:flex bg-slate-50/10 dark:bg-slate-900/10 flex-col overflow-hidden relative">
                                    <SideCalendarPanel
                                        selectedDate={dueDate ? new Date(dueDate) : null}
                                        onSelectDate={async (d) => {
                                            const val = format(d, 'yyyy-MM-dd');
                                            if (activeDateInput === 'my') {
                                                setPrepDate(val);
                                                const dateObj = new Date(val);
                                                const timestamp = Math.floor(dateObj.getTime() / 1000);
                                                const updates: Partial<Item> = { prep_date: timestamp };
                                                if (onUpdate) await onUpdate(item.id, updates);
                                                else await ApiClient.updateItem(item.id, updates);
                                            } else {
                                                setDueDate(val);
                                                setDueStatus('confirmed');
                                                const updates: Partial<Item> = { due_date: val, dueStatus: 'confirmed' };
                                                if (onUpdate) await onUpdate(item.id, updates);
                                                else await ApiClient.updateItem(item.id, updates);
                                            }
                                        }}
                                        prepDate={prepDate ? new Date(prepDate) : null}
                                        targetMode={activeDateInput}
                                        dailyVolumes={dailyVolumes} // [NEW] Pass heatmap data
                                    />
                                </div>

                                {/* Bottom: Boost & Note (Moved here) */}
                                <div className="flex-none p-3 space-y-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 z-10 shadow-inner">
                                    {/* Boost Button Line */}
                                    <div className="flex justify-center">
                                        <button
                                            onClick={async () => {
                                                const newBoostState = !item.is_boosted;
                                                const updates = { is_boosted: newBoostState, boosted_date: Date.now() };
                                                if (onUpdate) await onUpdate(item.id, updates);
                                                else await ApiClient.updateItem(item.id, updates);
                                            }}
                                            className={cn(
                                                "w-full flex items-center justify-center gap-2 px-3 py-1 rounded-full text-[10px] font-bold transition-colors border",
                                                item.is_boosted
                                                    ? "bg-amber-100 text-amber-700 border-amber-200"
                                                    : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                                            )}
                                        >
                                            <span className={cn("w-1.5 h-1.5 rounded-full", item.is_boosted ? "bg-amber-500" : "bg-slate-300")} />
                                            今日だけ前に出す (Boost)
                                        </button>
                                    </div>

                                    {/* Memo Input */}
                                    <div className="relative">
                                        <textarea
                                            value={note}
                                            onChange={(e) => setNote(e.target.value)}
                                            onBlur={async () => {
                                                const updates = { memo: note };
                                                if (onUpdate) await onUpdate(item.id, updates);
                                                else await ApiClient.updateItem(item.id, updates);
                                            }}
                                            placeholder="メモ・条件・懸念点..."
                                            className="w-full text-xs bg-slate-50 dark:bg-slate-800/30 rounded p-2 border-none focus:ring-1 focus:ring-indigo-300 resize-none min-h-[50px] text-slate-700 dark:text-slate-300 placeholder:text-slate-400 transition-all focus:min-h-[80px]"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* RIGHT COLUMN: Estimated Time & Subtasks */}
                            <div className="w-full md:w-[320px] lg:w-[360px] flex flex-col border-l border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-y-auto p-5 space-y-6">

                                {/* Estimated Time Preset Grid */}
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between pb-1 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                            <div className="w-1 h-3 bg-amber-400 rounded-full"></div>
                                            目安時間 (Estimate)
                                        </span>
                                        <span className="text-sm font-bold text-slate-700 dark:text-slate-200">
                                            {estimatedMinutes > 0 ? (estimatedMinutes >= 60 ? `${(estimatedMinutes / 60).toFixed(1)}h` : `${estimatedMinutes}m`) : '-'}
                                        </span>
                                    </div>

                                    {/* New Graphical Presets (8 items) */}
                                    <div className="grid grid-cols-2 gap-2">
                                        {[
                                            { label: '0.5h', val: 30, desc: '30分', icon: '⚡' },
                                            { label: '1h', val: 60, desc: '1時間', icon: '☕' },
                                            { label: '2h', val: 120, desc: '午前/午後', icon: '🏃' },
                                            { label: '4h', val: 240, desc: '半日', icon: '🌓' },
                                            { label: '8h', val: 480, desc: '1日', icon: '🌕' },
                                            { label: '1.5日', val: 720, desc: '残業含む', icon: '📅' },
                                            { label: '2日', val: 960, desc: 'じっくり', icon: '🗓️' },
                                            { label: '3日', val: 1440, desc: '長丁場', icon: '🏗️' },
                                        ].map(preset => {
                                            const isActive = estimatedMinutes === preset.val;
                                            return (
                                                <button
                                                    key={preset.label}
                                                    onClick={() => setEstimatedMinutes(preset.val)}
                                                    className={cn(
                                                        "relative group flex items-center gap-3 p-2 rounded-xl border transition-all duration-200",
                                                        isActive
                                                            ? "bg-amber-50 border-amber-300 shadow-md shadow-amber-100 dark:bg-amber-900/40 dark:border-amber-700 dark:shadow-none"
                                                            : "bg-white border-slate-200 hover:border-indigo-300 hover:bg-slate-50 hover:shadow-sm dark:bg-slate-800/50 dark:border-slate-700 dark:hover:bg-slate-800"
                                                    )}
                                                >
                                                    {/* Icon Box */}
                                                    <div className={cn(
                                                        "flex items-center justify-center w-8 h-8 rounded-lg text-sm transition-colors",
                                                        isActive
                                                            ? "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-200"
                                                            : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-indigo-500 dark:bg-slate-700 dark:text-slate-400"
                                                    )}>
                                                        {preset.icon}
                                                    </div>

                                                    {/* Text Info */}
                                                    <div className="flex flex-col items-start gap-0.5">
                                                        <span className={cn(
                                                            "text-sm font-bold leading-none",
                                                            isActive ? "text-amber-900 dark:text-amber-100" : "text-slate-700 dark:text-slate-200 group-hover:text-indigo-700"
                                                        )}>
                                                            {preset.label}
                                                        </span>
                                                        <span className="text-[10px] text-slate-400 font-medium group-hover:text-indigo-400 dark:text-slate-500">
                                                            {preset.desc}
                                                        </span>
                                                    </div>

                                                    {/* Checkmark for Active */}
                                                    {isActive && (
                                                        <div className="absolute top-2 right-2 text-amber-500 dark:text-amber-400">
                                                            <div className="w-2 h-2 rounded-full bg-current" />
                                                        </div>
                                                    )}
                                                </button>
                                            )
                                        })}
                                    </div>

                                    {/* Manual Input (Subtle) */}
                                    <div className="flex items-center justify-end gap-2 pt-1 pb-3 border-b border-slate-100 dark:border-slate-800">
                                        <span className="text-[10px] text-slate-400">微調整:</span>
                                        <input
                                            type="number"
                                            value={estimatedMinutes / 60}
                                            onChange={e => setEstimatedMinutes(Number(e.target.value) * 60)}
                                            className="w-12 bg-transparent border-b border-slate-200 text-right text-xs font-mono focus:outline-none focus:border-amber-400 transition-colors"
                                            placeholder="0"
                                        />
                                        <span className="text-[10px] text-slate-400">h</span>
                                    </div>
                                </div>

                                {/* Assignment Selection (Haruki Plan) */}
                                <div className="space-y-2 pt-1 pb-4 border-b border-slate-100 dark:border-slate-800">
                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <div className="w-1 h-2.5 bg-indigo-400 rounded-full"></div>
                                        担当者 (Assignee)
                                    </span>
                                    <div className="relative group/assignee shadow-sm">
                                        <select
                                            value={item.assignedTo || ''}
                                            onChange={async (e) => {
                                                const val = e.target.value;
                                                const updates: Partial<Item> = { assignedTo: val || undefined };
                                                if (onUpdate) await onUpdate(item.id, updates);
                                                else await ApiClient.updateItem(item.id, updates);
                                            }}
                                            className="w-full bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 outline-none focus:ring-1 focus:ring-indigo-400 focus:border-indigo-400 transition-all appearance-none cursor-pointer"
                                        >
                                            <option value="">自分 (Unassigned)</option>
                                            {members.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.display_name} {m.role ? `(${m.role})` : ''}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400 text-[10px]">
                                            ▼
                                        </div>
                                    </div>
                                </div>


                                {/* Sub-Tasks Section (Project Mode) - Moved to Right Column */}
                                {isProject && (
                                    <div className="pt-4 border-t border-slate-100 dark:border-slate-800">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="text-xs font-bold text-slate-400 flex items-center gap-1">
                                                <Folder size={12} className="text-blue-400" />
                                                サブタスク (Project Check)
                                            </div>
                                            {/* Auto-Sum Button */}
                                            {subTasks.length > 0 && (
                                                <button
                                                    onClick={async () => {
                                                        const totalMinutes = subTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0);
                                                        if (totalMinutes > 0 && totalMinutes !== estimatedMinutes) {
                                                            setEstimatedMinutes(totalMinutes);
                                                            const updates = { estimatedMinutes: totalMinutes };
                                                            if (onUpdate) await onUpdate(item.id, updates);
                                                            else await ApiClient.updateItem(item.id, updates);
                                                        }
                                                    }}
                                                    className="text-[10px] text-indigo-500 hover:bg-indigo-50 px-1.5 py-0.5 rounded transition-colors"
                                                    title={`合計: ${subTasks.reduce((sum, t) => sum + (t.estimatedMinutes || 0), 0) / 60}h を親タスクに反映`}
                                                >
                                                    合計反映
                                                </button>
                                            )}
                                        </div>

                                        {/* List */}
                                        <div className="space-y-1 mb-2">
                                            {subTasks.map(sub => (
                                                <div
                                                    key={sub.id}
                                                    onClick={() => onOpenItem?.(sub)}
                                                    className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all group"
                                                >
                                                    <CheckSquare size={14} className={cn(
                                                        "transition-colors",
                                                        sub.status === 'done' ? "text-green-500" : "text-slate-300 group-hover:text-blue-400"
                                                    )} />
                                                    <span className={cn(
                                                        "text-xs font-medium flex-1 truncate",
                                                        sub.status === 'done' ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"
                                                    )}>{sub.title}</span>

                                                    {/* Work Days & Time Display */}
                                                    <div className="flex items-center gap-1">
                                                        {sub.estimatedMinutes && sub.estimatedMinutes > 0 ? (
                                                            <span className="text-[10px] font-mono text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                                                                {sub.estimatedMinutes >= 60
                                                                    ? `${(sub.estimatedMinutes / 60).toFixed(1)}h`
                                                                    : `${sub.estimatedMinutes}m`}
                                                            </span>
                                                        ) : (
                                                            sub.work_days !== undefined && sub.work_days > 0 && (
                                                                <span className="text-[10px] sm:text-xs font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                                                                    {Number(sub.work_days).toFixed(1)}日
                                                                </span>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Add Input */}
                                        <div className="flex items-center gap-2">

                                            <input
                                                type="text"
                                                value={newSubTaskTitle}
                                                onChange={e => setNewSubTaskTitle(e.target.value)}
                                                onKeyDown={async e => {
                                                    if (e.key === 'Enter' && newSubTaskTitle.trim() && onCreateSubTask) {
                                                        e.preventDefault();
                                                        const titleToAdd = newSubTaskTitle.trim();
                                                        setNewSubTaskTitle(''); // Clear early for UX
                                                        const newId = await onCreateSubTask(item.id, titleToAdd, dueDate || item.due_date || undefined);
                                                        console.log('[Modal] Subtask created:', newId);
                                                        if (onGetSubTasks) {
                                                            const tasks = await onGetSubTasks(item.id);
                                                            setSubTasks(tasks);
                                                        }
                                                    }
                                                }}
                                                placeholder="サブタスクを追加..."
                                                className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 text-sm py-1 focus:outline-none focus:border-blue-400 transition-colors"
                                            />
                                            <button
                                                onClick={async () => {
                                                    if (newSubTaskTitle.trim() && onCreateSubTask) {
                                                        const titleToAdd = newSubTaskTitle.trim();
                                                        setNewSubTaskTitle('');
                                                        const parentDueDate = dueDate || item.due_date;
                                                        await onCreateSubTask(item.id, titleToAdd, parentDueDate || undefined);
                                                        if (onGetSubTasks) {
                                                            const tasks = await onGetSubTasks(item.id);
                                                            setSubTasks(tasks);
                                                        }
                                                    }
                                                }}
                                                className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-400 hover:text-blue-500 transition-colors"
                                            >
                                                <Plus size={16} />
                                            </button>
                                        </div>
                                    </div>
                                )}

                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex flex-col md:flex-row justify-between items-center gap-4">

                            {/* LEFT GROUP: Negative / Defer */}
                            <div className="flex items-center gap-2 w-full md:w-auto">
                                {/* NOT NOW (Menu) */}
                                <div className="relative group/notnow" ref={menuRef}>
                                    <button
                                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                                        className={cn(
                                            "flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-transparent transition-all",
                                            isMenuOpen
                                                ? "bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                                                : "hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                        )}
                                        title="ゴミ箱・その他"
                                    >
                                        <Trash2 size={18} />
                                    </button>

                                    {/* Popup Menu */}
                                    <div
                                        className={cn(
                                            "absolute bottom-full left-0 w-56 bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-slate-200 dark:border-slate-800 p-2 mb-2 z-50",
                                            isMenuOpen ? "block" : "hidden group-hover/notnow:block"
                                        )}
                                    >
                                        <div className="text-[10px] font-bold text-slate-400 px-2 py-1 mb-1">行き先を選択</div>
                                        {!isProject && (
                                            <button
                                                onClick={async () => {
                                                    setIsProject(true);
                                                    if (onUpdate) await onUpdate(item.id, { isProject: true });
                                                    else await ApiClient.updateItem(item.id, { isProject: true });
                                                    // [FIX] Explicitly refresh subtasks after projectization
                                                    if (onGetSubTasks) {
                                                        const tasks = await onGetSubTasks(item.id);
                                                        setSubTasks(tasks);
                                                    }
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded flex items-center gap-2"
                                            >
                                                <Folder size={14} className="text-blue-500" />
                                                プロジェクト化 (タスク分解)
                                            </button>
                                        )}
                                        {onDelegate && (
                                            <button
                                                onClick={() => {
                                                    setIsMenuOpen(false);
                                                    // Open delegation dialog
                                                    // For now, we'll use a simple prompt
                                                    const assignee = prompt('外注先を入力してください:');
                                                    if (assignee) {
                                                        const dueDate = prompt('期限 (YYYY-MM-DD):');
                                                        const note = prompt('メモ (任意):');
                                                        onDelegate(item.id, assignee, dueDate || undefined, note || undefined);
                                                        onClose();
                                                    }
                                                }}
                                                className="w-full text-left px-3 py-2 text-xs font-bold text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded flex items-center gap-2"
                                            >
                                                <span className="w-2 h-2 rounded-full bg-purple-400" />
                                                外注する
                                            </button>
                                        )}
                                        <button
                                            onClick={() => onDecision(item.id, 'no', 'intent')}
                                            className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded flex items-center gap-2"
                                        >
                                            <span className="w-2 h-2 rounded-full bg-amber-400" />
                                            Intent (やれたらいい)
                                        </button>
                                        <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                if (confirmDelete) onDelete(item.id);
                                                else setConfirmDelete(true);
                                            }}
                                            className={cn(
                                                "w-full text-left px-3 py-2 text-xs font-bold rounded flex items-center gap-2 transition-colors",
                                                confirmDelete ? "bg-red-500 text-white" : "text-red-500 hover:bg-red-50"
                                            )}
                                        >
                                            <Trash2 size={12} />
                                            {confirmDelete ? "本当に削除？" : "完全削除"}
                                        </button>
                                    </div>
                                </div>

                                {/* HIDE (SLEEP) - OLD HOLD */}
                                <button
                                    onClick={async () => {
                                        if (onUpdate) await onUpdate(item.id, { work_days: workDays });
                                        else await ApiClient.updateItem(item.id, { work_days: workDays });
                                        onDecision(item.id, 'hold', note);
                                    }}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 transition-all"
                                    title="今は隠す (Shelfへ移動)"
                                >
                                    <PauseCircle size={18} />
                                    <span className="text-xs font-bold">今は隠す (Sleep)</span>
                                </button>
                            </div>

                            {/* RIGHT GROUP: Positive / Action */}
                            <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                                {/* SAVE TO INBOX (New) */}
                                <button
                                    onClick={handleClose}
                                    className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-sm transition-all"
                                    title="内容を保存してInbox(スタンバイ)に置く"
                                >
                                    スタンバイに置く
                                </button>

                                {/* TODAY (Yes) */}
                                <button
                                    onClick={() => handleDecisionWithSave('yes')}
                                    className="flex items-center gap-2 px-6 py-2 rounded-lg bg-amber-400 hover:bg-amber-500 text-white shadow-md shadow-amber-200 dark:shadow-none font-bold text-sm transition-all transform active:scale-95"
                                >
                                    <CheckCircle2 size={18} />
                                    {yesButtonLabel || '今日やる'}
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
