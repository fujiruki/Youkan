import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, PauseCircle, CheckCircle2 } from 'lucide-react';
import { Item } from '../../types';
import { cn } from '../../../../lib/utils';
import { ApiClient } from '../../../../api/client';
import { EstimatedTimeInput } from '../Today/EstimatedTimeInput'; // [NEW]

interface DecisionDetailModalProps {
    item: Item | null;
    onClose: () => void;
    onDecision: (id: string, decision: 'yes' | 'hold' | 'no', note?: string) => void;
    onDelete: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Item>) => Promise<void>; // [NEW] Live
    // [NEW] Custom Labels
    yesButtonLabel?: string;
    initialFocus?: 'date'; // [NEW]
}

export const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({ item, onClose, onDecision, onDelete, onUpdate, initialFocus, yesButtonLabel }) => {
    if (!item) return null;

    const [note, setNote] = React.useState(item.memo || '');
    const [dueStatus, setDueStatus] = React.useState(item.due_status || 'waiting_external');
    const [dueDate, setDueDate] = React.useState(item.due_date || '');
    const [prepDate, setPrepDate] = React.useState(item.prep_date ? new Date(item.prep_date * 1000).toISOString().split('T')[0] : ''); // [NEW] State
    const [workDays, setWorkDays] = React.useState(item.work_days || 1);
    const [isWorkDaysDirty] = React.useState(false); // [NEW] Track dirty state
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [editedTitle, setEditedTitle] = React.useState(item.title);
    const [estimatedMinutes, setEstimatedMinutes] = React.useState(item.estimatedMinutes || 0); // [NEW]

    // [NEW] Menu Latching State
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState(false); // [NEW] Confirmation state
    const menuRef = React.useRef<HTMLDivElement>(null);

    const dateInputRef = React.useRef<HTMLInputElement>(null);
    const titleInputRef = React.useRef<HTMLInputElement>(null);

    // Initial Focus Logic
    React.useEffect(() => {
        if (initialFocus === 'date') {
            // Force status to confirmed locally for instant UI
            if (dueStatus === 'waiting_external') {
                setDueStatus('confirmed');
                // Fire API in background
                ApiClient.updateItem(item.id, { due_status: 'confirmed' });
            }

            setTimeout(() => {
                dateInputRef.current?.focus();
            }, 100);
        }
    }, [initialFocus, item.id, dueStatus]); // trigger when ID changes (new item opened)

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

    // Sync prop changes if item updates from outside (optional but good practice)
    React.useEffect(() => {
        setDueStatus(item.due_status || 'waiting_external');
        setDueDate(item.due_date || '');
        if (!isWorkDaysDirty) {
            setWorkDays(item.work_days || 1);
        }
        setEstimatedMinutes(item.estimatedMinutes || 0); // [NEW]
        setEditedTitle(item.title);
        setPrepDate(item.prep_date ? new Date(item.prep_date * 1000).toISOString().split('T')[0] : ''); // [NEW] Sync
    }, [item.due_status, item.due_date, item.work_days, item.title, item.estimatedMinutes, item.prep_date, isWorkDaysDirty]);

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

    // [NEW] Save work_days AND estimatedMinutes and close
    const handleClose = async () => {
        const updates: Partial<Item> = {};

        console.log('handleClose called. estimatedMinutes:', estimatedMinutes, 'item.estimated:', item.estimatedMinutes);

        // Check dirty work_days
        if (isWorkDaysDirty || workDays !== item.work_days) {
            updates.work_days = workDays;
        }

        // Check dirty estimatedMinutes
        if (estimatedMinutes !== (item.estimatedMinutes || 0)) {
            updates.estimatedMinutes = estimatedMinutes;
        }

        console.log('updates:', updates);

        if (Object.keys(updates).length > 0) {
            if (onUpdate) {
                await onUpdate(item.id, updates);
            } else {
                await ApiClient.updateItem(item.id, updates);
            }
        }
        onClose();
    };

    // [NEW] Helper to save work_days before decision
    const handleDecisionWithSave = async (decision: 'yes' | 'hold' | 'no') => {
        const updates: Partial<Item> = {};

        if (workDays !== item.work_days) {
            updates.work_days = workDays;
        }
        if (estimatedMinutes !== (item.estimatedMinutes || 0)) {
            updates.estimatedMinutes = estimatedMinutes;
        }

        if (Object.keys(updates).length > 0) {
            if (onUpdate) {
                await onUpdate(item.id, updates);
            } else {
                await ApiClient.updateItem(item.id, updates);
            }
        }
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
                        className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-white/20 overflow-hidden flex flex-col"
                    >
                        {/* Header Area */}
                        <div className="p-4 pb-3 flex justify-between items-start">
                            <div className="flex-1">
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 mb-1">
                                    {item.category || 'ITEM'}
                                </span>
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
                                        className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug cursor-pointer hover:text-indigo-600 transition-colors"
                                        onClick={() => setIsEditingTitle(true)}
                                        title="クリックして編集"
                                    >
                                        {item.title}
                                    </h2>
                                )}
                            </div>

                            {/* Right: Quick Actions + Close */}
                            <div className="flex items-start gap-2 ml-4">
                                <button
                                    onClick={async () => {
                                        if (onUpdate) {
                                            await onUpdate(item.id, { work_days: workDays });
                                        } else {
                                            await ApiClient.updateItem(item.id, { work_days: workDays });
                                        }
                                        onDecision(item.id, 'hold', note);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all bg-purple-100 hover:bg-purple-200 text-purple-700 border border-purple-200"
                                    title="保留"
                                >
                                    保留
                                </button>
                                <button
                                    onClick={async () => {
                                        if (onUpdate) {
                                            await onUpdate(item.id, { work_days: workDays });
                                        } else {
                                            await ApiClient.updateItem(item.id, { work_days: workDays });
                                        }
                                        onDecision(item.id, 'yes', note);
                                    }}
                                    className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all bg-amber-400 hover:bg-amber-500 text-white shadow-md"
                                    title="今日やる"
                                >
                                    今日やる
                                </button>
                                <button onClick={handleClose} className="p-2 -mr-2 -mt-2 hover:bg-slate-100 rounded-full transition-colors">
                                    <X size={20} className="text-slate-400" />
                                </button>
                            </div>
                        </div>

                        {/* Content Area - Compact Grid */}
                        <div className="px-5 py-4 space-y-5">

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
                                            <div className="bg-slate-50 dark:bg-slate-800/50 rounded px-3 py-2 text-sm text-slate-500 font-medium border border-slate-100 dark:border-slate-800">
                                                相手都合 (未定)
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
                                            備え (目安)
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
                                        制作目安 (見積)
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
                        </div>

                        {/* Actions Footer */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3">

                            {/* NOT NOW (Menu) */}
                            <div className="relative group/notnow" ref={menuRef}>
                                <button
                                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                                    className={cn(
                                        "w-full flex flex-col items-center justify-center gap-1 p-3 rounded-lg border border-transparent transition-all",
                                        isMenuOpen
                                            ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                                            : "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                                    )}
                                >
                                    <Trash2 size={20} className="mb-1" />
                                    <span className="text-xs font-bold">今回見送り...</span>
                                </button>

                                {/* Popup Menu */}
                                <div
                                    className={cn(
                                        "absolute bottom-full left-0 w-48 bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-slate-200 dark:border-slate-800 p-2 mb-2 z-50",
                                        isMenuOpen ? "block" : "hidden group-hover/notnow:block"
                                    )}
                                    tabIndex={0}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Delete') {
                                            e.preventDefault();
                                            if (confirm('この操作は取り消せません。完全に削除しますか？')) {
                                                onDelete(item.id);
                                            }
                                        }
                                    }}
                                >
                                    <div className="text-[10px] font-bold text-slate-400 px-2 py-1 mb-1">行き先を選択</div>
                                    <button
                                        onClick={() => onDecision(item.id, 'no', 'intent')}
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded flex items-center gap-2"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                                        Intent (やれたらいい)
                                    </button>
                                    <button
                                        onClick={() => onDecision(item.id, 'no', 'life')}
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded flex items-center gap-2"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-green-400" />
                                        Life (習慣・生活)
                                    </button>
                                    <div className="h-px bg-slate-100 dark:bg-slate-800 my-1" />
                                    <button
                                        onClick={() => onDecision(item.id, 'no', 'history')}
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded flex items-center gap-2"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-slate-400" />
                                        History (却下・ログ)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (confirmDelete) {
                                                onDelete(item.id);
                                            } else {
                                                setConfirmDelete(true);
                                            }
                                        }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-xs font-bold rounded flex items-center gap-2 transition-colors",
                                            confirmDelete
                                                ? "bg-red-500 text-white hover:bg-red-600"
                                                : "text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                                        )}
                                    >
                                        <Trash2 size={12} />
                                        {confirmDelete ? "本当に削除しますか？" : "完全削除"}
                                    </button>
                                </div>
                            </div>

                            {/* HOLD */}
                            <button
                                onClick={async () => {
                                    // Save work_days before decision
                                    if (onUpdate) {
                                        await onUpdate(item.id, { work_days: workDays });
                                    } else {
                                        await ApiClient.updateItem(item.id, { work_days: workDays });
                                    }
                                    onDecision(item.id, 'hold', note);
                                }}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1 p-3 rounded-lg border border-transparent transition-all group",
                                    item.status === 'decision_hold'
                                        ? "bg-purple-50 text-purple-700 border-purple-200"
                                        : "hover:bg-purple-50 hover:text-purple-600 hover:border-purple-100"
                                )}
                            >
                                <PauseCircle size={20} className={cn(
                                    "mb-1 transition-colors",
                                    item.status === 'decision_hold' ? "text-purple-600" : "text-slate-400 group-hover:text-purple-500"
                                )} />
                                <span className={cn(
                                    "text-xs font-bold",
                                    item.status === 'decision_hold' ? "text-purple-700" : "text-slate-500 group-hover:text-purple-600"
                                )}>保留 (Hold)</span>
                            </button>

                            {/* YES / READY */}
                            <button
                                onClick={async () => {
                                    // Save work_days before decision
                                    if (onUpdate) {
                                        await onUpdate(item.id, { work_days: workDays });
                                    } else {
                                        await ApiClient.updateItem(item.id, { work_days: workDays });
                                    }
                                    onDecision(item.id, 'yes', note);
                                }}
                                className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg shadow-md shadow-amber-200 dark:shadow-none transition-all transform active:scale-95 bg-amber-400 hover:bg-amber-500 text-white"
                            >
                                <CheckCircle2 size={20} className="mb-1" />
                                <span className="text-xs font-bold">{yesButtonLabel || '今日やる (Yes)'}</span>
                            </button>

                        </div>
                    </motion.div>
                </div >
            )}
        </AnimatePresence >
    );
};
