import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, PauseCircle, CheckCircle2, Folder, Plus, CheckSquare } from 'lucide-react';
import { Item } from '../../types';
import { cn } from '../../../../../lib/utils';
import { ApiClient } from '../../../../../api/client';
import { EstimatedTimeInput } from '../Today/EstimatedTimeInput';

interface DecisionDetailModalProps {
    item: Item | null;
    onClose: () => void;
    onDecision: (id: string, decision: 'yes' | 'hold' | 'no', note?: string) => void;
    onDelete: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Item>) => Promise<void>;
    onCreateSubTask?: (parentId: string, title: string, initialDueDate?: string) => Promise<string | undefined>; // [FIX] Added initialDueDate
    onGetSubTasks?: (parentId: string) => Promise<Item[]>; // [NEW]
    onDelegate?: (taskId: string, assignedTo: string, dueDate?: string, note?: string) => Promise<void>; // [NEW]
    onOpenItem?: (item: Item) => void; // [NEW] Drill-down navigation
    onOpenParent?: (parentId: string) => void; // [NEW] Drill-up navigation
    // Custom Labels
    yesButtonLabel?: string;
    initialFocus?: 'date';
}

export const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({ item, onClose, onDecision, onDelete, onUpdate, onCreateSubTask, onGetSubTasks, onDelegate, onOpenItem, onOpenParent, initialFocus: _, yesButtonLabel }) => {
    if (!item) return null;

    const [note, setNote] = React.useState(item.memo || '');
    const [dueStatus, setDueStatus] = React.useState(item.due_status || 'waiting_external');
    const [dueDate, setDueDate] = React.useState(item.due_date || '');
    const [prepDate, setPrepDate] = React.useState(item.prep_date ? new Date(item.prep_date * 1000).toISOString().split('T')[0] : '');
    const [workDays, setWorkDays] = React.useState(item.work_days || 1);
    const [isWorkDaysDirty] = React.useState(false);
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [editedTitle, setEditedTitle] = React.useState(item.title);
    const [estimatedMinutes, setEstimatedMinutes] = React.useState(item.estimatedMinutes || 0);

    // [NEW] Sub-Task State
    const [subTasks, setSubTasks] = React.useState<Item[]>([]);
    const [newSubTaskTitle, setNewSubTaskTitle] = React.useState('');
    const [isProject, setIsProject] = React.useState(item.isProject || false);

    // [NEW] Load Sub-tasks
    React.useEffect(() => {
        if (isProject && onGetSubTasks) {
            onGetSubTasks(item.id).then(tasks => setSubTasks(tasks));
        }
    }, [item.id, isProject, onGetSubTasks]);

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
    React.useEffect(() => {
        setDueStatus(item.due_status || 'waiting_external');
        setDueDate(item.due_date || '');
        if (!isWorkDaysDirty) {
            setWorkDays(item.work_days || 1);
        }
        setEstimatedMinutes(item.estimatedMinutes || 0);
        setEditedTitle(item.title);
        setPrepDate(item.prep_date ? new Date(item.prep_date * 1000).toISOString().split('T')[0] : '');
        setIsProject(item.isProject || false); // Sync project status
    }, [item.due_status, item.due_date, item.work_days, item.title, item.estimatedMinutes, item.prep_date, item.isProject, isWorkDaysDirty]);

    // [NEW] Enhanced Keyboard Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // [FIX] Stop propagation to prevent background GDB from reacting
            e.stopPropagation();

            // Alt + D: Focus Date
            if (e.altKey && e.key.toLowerCase() === 'd') {
                e.preventDefault();
                if (dueStatus === 'waiting_external') {
                    setDueStatus('confirmed');
                    if (onUpdate) {
                        const updates: Partial<Item> = { due_status: 'confirmed' };
                        onUpdate(item.id, updates);
                    } else {
                        const updates: Partial<Item> = { due_status: 'confirmed' };
                        ApiClient.updateItem(item.id, updates);
                    }
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
    }, [item.id, dueStatus, note, workDays, onDecision, onClose, onUpdate, isWorkDaysDirty]);

    // [NEW] Unified Save Helper
    const saveChanges = async () => {
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
        if (dueDate !== (item.due_date || '')) {
            updates.due_date = dueDate;
            updates.due_status = dueStatus; // If date changed, likely status is confirmed
        }

        if (Object.keys(updates).length > 0) {
            console.log('Saving changes before close/decision:', updates);
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
        await saveChanges();
        onDecision(item.id, decision, note);
    };

    // Save note on standard decision?
    // For now, note is passed when button is clicked.

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
                        className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-white/20 overflow-hidden flex flex-col max-h-[90vh]" // [FIX] Added max-h-[90vh]
                    >
                        {/* Header Area */}
                        <div className="p-4 pb-3 flex justify-between items-start flex-none"> {/* [FIX] flex-none to prevent shrinking */}
                            <div className="flex-1">

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
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.currentTarget.blur();
                                            } else if (e.key === 'Escape') {
                                                setEditedTitle(item.title);
                                                setIsEditingTitle(false);
                                            }
                                        }}
                                        className="w-full text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug bg-transparent border-b-2 border-indigo-500 focus:outline-none"
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

                        {/* Content Area - Compact Grid */}
                        <div className="px-5 py-4 space-y-5 flex-1 overflow-y-auto min-h-0"> {/* [FIX] Added scrollable area */}

                            {/* Schedule & Volume Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

                                {/* Left Col: Schedule */}
                                <div className="space-y-4">
                                    {/* 1. Due Date */}
                                    <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                                <div className="w-1 h-3 bg-red-400 rounded-full"></div>
                                                納期 (事実)
                                            </span>
                                            <button
                                                onClick={async () => {
                                                    const newStatus = dueStatus === 'waiting_external' ? 'confirmed' : 'waiting_external';
                                                    const todayStr = new Date().toISOString().split('T')[0];
                                                    const newDateVal = newStatus === 'waiting_external' ? null : (dueDate || todayStr);
                                                    setDueStatus(newStatus);
                                                    if (newStatus === 'confirmed' && !dueDate) setDueDate(todayStr);
                                                    const updates: Partial<Item> = { due_status: newStatus, due_date: newDateVal };
                                                    if (onUpdate) await onUpdate(item.id, updates);
                                                    else await ApiClient.updateItem(item.id, updates);

                                                    if (newStatus === 'confirmed') setTimeout(() => dateInputRef.current?.focus(), 100);
                                                }}
                                                className="text-[10px] text-slate-400 hover:text-indigo-500 underline"
                                            >
                                                {dueStatus === 'waiting_external' ? '日付指定' : '未定に戻す'}
                                            </button>
                                        </div>
                                        {dueStatus === 'waiting_external' ? (
                                            <div
                                                onClick={async () => {
                                                    const todayStr = new Date().toISOString().split('T')[0];
                                                    setDueStatus('confirmed');
                                                    setDueDate(todayStr);
                                                    const updates: Partial<Item> = { due_status: 'confirmed', due_date: todayStr };
                                                    if (onUpdate) await onUpdate(item.id, updates);
                                                    else await ApiClient.updateItem(item.id, updates);
                                                    setTimeout(() => dateInputRef.current?.focus(), 100);
                                                }}
                                                className="bg-slate-50 dark:bg-slate-800/50 rounded px-3 py-2 text-sm text-slate-400 font-medium border border-dashed border-slate-200 dark:border-slate-700 cursor-pointer hover:border-indigo-400 hover:text-indigo-500 transition-colors"
                                            >
                                                未記入 (タップして入力)
                                            </div>
                                        ) : (
                                            <div className="relative group">
                                                <input
                                                    ref={dateInputRef}
                                                    type="date"
                                                    value={dueDate || ''}
                                                    onChange={async (e) => {
                                                        const val = e.target.value; // Capture value immediately
                                                        setDueDate(val);
                                                        const updates: Partial<Item> = { due_date: val, due_status: 'confirmed' };
                                                        if (onUpdate) await onUpdate(item.id, updates);
                                                        else await ApiClient.updateItem(item.id, updates);
                                                    }}
                                                    className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 py-2 text-sm font-bold text-slate-800 dark:text-slate-200 outline-none focus:ring-2 focus:ring-indigo-400 w-full"
                                                />
                                                {/* Expanded click area for Calendar Picker */}
                                                <div
                                                    className="absolute top-0 right-0 bottom-0 w-12 cursor-pointer bg-transparent"
                                                    onClick={() => dateInputRef.current?.showPicker()}
                                                    title="カレンダーを開く"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. Prep Date */}
                                    <div className="flex flex-col gap-1">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                            <div className="w-1 h-3 bg-indigo-400 rounded-full"></div>
                                            マイ期限
                                        </span>
                                        <input
                                            data-testid="prep-date-input"
                                            type="date"
                                            value={prepDate}
                                            onChange={async (e) => {
                                                const val = e.target.value;
                                                setPrepDate(val); // Local update
                                                const dateObj = new Date(val);
                                                const timestamp = !isNaN(dateObj.getTime()) ? Math.floor(dateObj.getTime() / 1000) : null;
                                                const updates = { prep_date: timestamp };
                                                if (onUpdate) await onUpdate(item.id, updates);
                                                else await ApiClient.updateItem(item.id, updates);
                                            }}
                                            className="bg-slate-50 dark:bg-slate-800/50 border border-transparent hover:border-slate-200 dark:hover:border-slate-700 rounded px-3 py-2 text-sm text-slate-700 dark:text-slate-300 outline-none focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-indigo-400 w-full transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Right Col: Volume (Estimated Time) */}
                                <div className="space-y-1">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                                        <div className="w-1 h-3 bg-amber-400 rounded-full"></div>
                                        目安時間
                                    </span>
                                    <div className="bg-slate-50 dark:bg-slate-800/30 rounded-xl p-3 border border-slate-100 dark:border-slate-800">
                                        <EstimatedTimeInput
                                            value={estimatedMinutes}
                                            onChange={(val) => setEstimatedMinutes(val)}
                                            className="w-full"
                                        />
                                    </div>
                                </div>

                            </div>

                            {/* Divider with Boost */}
                            <div className="flex items-center gap-4 py-2 opacity-80 hover:opacity-100 transition-opacity">
                                <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={async () => {
                                            const newBoostState = !item.is_boosted;
                                            const updates = { is_boosted: newBoostState, boosted_date: Date.now() };
                                            if (onUpdate) await onUpdate(item.id, updates);
                                            else await ApiClient.updateItem(item.id, updates);
                                        }}
                                        className={cn(
                                            "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition-colors border",
                                            item.is_boosted
                                                ? "bg-amber-100 text-amber-700 border-amber-200"
                                                : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                                        )}
                                    >
                                        <span className={cn("w-2 h-2 rounded-full", item.is_boosted ? "bg-amber-500" : "bg-slate-300")} />
                                        今日だけ前に出す (Boost)
                                    </button>
                                </div>
                                <div className="h-px bg-slate-100 dark:bg-slate-800 flex-1"></div>
                            </div>

                            {/* Note Input (Compact) */}
                            <div className="relative">
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    onBlur={async () => {
                                        const updates = { memo: note };
                                        if (onUpdate) await onUpdate(item.id, updates);
                                        else await ApiClient.updateItem(item.id, updates);
                                    }}
                                    placeholder="メモ・条件・懸念点など..."
                                    className="w-full text-sm bg-transparent border-none p-0 focus:ring-0 resize-none min-h-[60px] text-slate-700 dark:text-slate-300 placeholder:text-slate-300"
                                />
                                {/* Bottom Border fake */}
                                <div className="absolute bottom-0 left-0 right-0 h-px bg-slate-100 dark:bg-slate-800"></div>
                            </div>

                            {/* Sub-Tasks Section (Project Mode) */}
                            {isProject && (
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
                                    <div className="text-xs font-bold text-slate-400 mb-2 flex items-center gap-1">
                                        <Folder size={12} className="text-blue-400" />
                                        サブタスク (Project)
                                    </div>

                                    {/* List */}
                                    <div className="space-y-1 mb-2">
                                        {subTasks.map(sub => (
                                            <div
                                                key={sub.id}
                                                onClick={() => onOpenItem?.(sub)}
                                                className="flex items-center gap-2 p-2 bg-slate-50 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 hover:bg-white dark:hover:bg-slate-800 hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer transition-all"
                                            >
                                                <CheckSquare size={14} className="text-slate-300" />
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-200 flex-1">{sub.title}</span>

                                                {/* [NEW] Estimated Days Display */}
                                                {sub.work_days !== undefined && sub.work_days > 0 && (
                                                    <span className="text-[10px] sm:text-xs font-mono text-slate-400 dark:text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-100 dark:border-slate-800">
                                                        {Number(sub.work_days).toFixed(1)}日
                                                    </span>
                                                )}
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
                                                    // Call create with parentId
                                                    // [FIX] Pass parent's due_date (item.due_date) for inheritance
                                                    const newId = await onCreateSubTask?.(item.id, newSubTaskTitle, item.due_date || undefined);
                                                    if (newId) {
                                                        setNewSubTaskTitle('');
                                                        if (onGetSubTasks) onGetSubTasks(item.id).then(setSubTasks);
                                                    }
                                                }
                                            }}
                                            placeholder="サブタスクを追加..."
                                            className="flex-1 bg-transparent border-b border-slate-200 dark:border-slate-800 text-sm py-1 focus:outline-none focus:border-blue-400 transition-colors"
                                        />
                                        <button
                                            onClick={async () => {
                                                if (newSubTaskTitle.trim() && onCreateSubTask) {
                                                    await onCreateSubTask(item.id, newSubTaskTitle);
                                                    setNewSubTaskTitle('');
                                                    if (onGetSubTasks) onGetSubTasks(item.id).then(setSubTasks);
                                                }
                                            }}
                                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-blue-500"
                                        >
                                            <Plus size={16} />
                                        </button>
                                    </div>
                                </div>
                            )}
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
