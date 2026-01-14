import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Trash2, Clock, PauseCircle, CheckCircle2 } from 'lucide-react';
import { Item } from '../../types';
import { cn } from '../../../../lib/utils';
import { ApiClient } from '../../../../api/client';

interface DecisionDetailModalProps {
    item: Item | null;
    onClose: () => void;
    onDecision: (id: string, decision: 'yes' | 'hold' | 'no', note?: string) => void;
    onDelete: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Item>) => Promise<void>; // [NEW] Live updates
    initialFocus?: 'date'; // [NEW]
}

export const DecisionDetailModal: React.FC<DecisionDetailModalProps> = ({ item, onClose, onDecision, onDelete, onUpdate, initialFocus }) => {
    if (!item) return null;

    const [note, setNote] = React.useState(item.memo || '');
    const [dueStatus, setDueStatus] = React.useState(item.due_status || 'waiting_external');
    const [dueDate, setDueDate] = React.useState(item.due_date || '');
    const [workDays, setWorkDays] = React.useState(item.work_days || 1); // [NEW] Local state
    const [isEditingTitle, setIsEditingTitle] = React.useState(false);
    const [editedTitle, setEditedTitle] = React.useState(item.title);
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

    // Sync prop changes if item updates from outside (optional but good practice)
    React.useEffect(() => {
        setDueStatus(item.due_status || 'waiting_external');
        setDueDate(item.due_date || '');
        setWorkDays(item.work_days || 1);
        setEditedTitle(item.title);
    }, [item.due_status, item.due_date, item.work_days, item.title]);

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
                        onUpdate(item.id, { due_status: 'confirmed' });
                    } else {
                        ApiClient.updateItem(item.id, { due_status: 'confirmed' });
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
    }, [item.id, dueStatus, note, workDays, onDecision, onClose, onUpdate]);

    // [NEW] Save work_days and close
    const handleClose = async () => {
        // Ensure work_days is saved before closing
        if (workDays !== item.work_days) {
            if (onUpdate) {
                await onUpdate(item.id, { work_days: workDays });
            } else {
                await ApiClient.updateItem(item.id, { work_days: workDays });
            }
        }
        onClose();
    };

    // [NEW] Helper to save work_days before decision
    const handleDecisionWithSave = async (decision: 'yes' | 'hold' | 'no') => {
        if (workDays !== item.work_days) {
            if (onUpdate) {
                await onUpdate(item.id, { work_days: workDays });
            } else {
                await ApiClient.updateItem(item.id, { work_days: workDays });
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
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={handleClose}
                        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px]"
                    />

                    {/* Modal */}
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

                        {/* Content Area - Meta & Note */}
                        <div className="px-4 py-2 space-y-3">

                            {/* [Fact Check] Due Date Section */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    【判断材料】事実確認 <span className="text-[10px] text-slate-300 ml-2">(Alt+D)</span>
                                </label>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex-1">
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 block mb-1">
                                            取付日（納期）
                                        </span>

                                        {dueStatus === 'waiting_external' ? (
                                            <span className="text-slate-500 font-medium">未確定（相手都合）</span>
                                        ) : (
                                            <input
                                                ref={dateInputRef}
                                                type="date"
                                                value={dueDate}
                                                onChange={async (e) => {
                                                    const val = e.target.value;
                                                    setDueDate(val);
                                                    if (onUpdate) {
                                                        await onUpdate(item.id, { due_date: val, due_status: 'confirmed' });
                                                    } else {
                                                        await ApiClient.updateItem(item.id, { due_date: val, due_status: 'confirmed' });
                                                    }
                                                }}
                                                className="bg-transparent text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none focus:border-b border-indigo-500 w-full"
                                            />
                                        )}
                                    </div>
                                    <button
                                        id="due-toggle-btn"
                                        onClick={async () => {
                                            const newStatus = dueStatus === 'waiting_external' ? 'confirmed' : 'waiting_external';
                                            // Set today's date as default when entering date input mode
                                            const todayStr = new Date().toISOString().split('T')[0];
                                            const newDateVal = newStatus === 'waiting_external' ? null : (dueDate || todayStr);

                                            setDueStatus(newStatus);
                                            if (newStatus === 'confirmed' && !dueDate) {
                                                setDueDate(todayStr); // Set default date in local state
                                            }

                                            if (onUpdate) {
                                                await onUpdate(item.id, { due_status: newStatus, due_date: newDateVal });
                                            } else {
                                                await ApiClient.updateItem(item.id, { due_status: newStatus, due_date: newDateVal });
                                            }

                                            if (newStatus === 'confirmed') {
                                                setTimeout(() => dateInputRef.current?.focus(), 100);
                                            }
                                        }}
                                        className="text-xs text-slate-400 underline hover:text-indigo-500 whitespace-nowrap"
                                    >
                                        {dueStatus === 'waiting_external' ? '[日付を入力する]' : '[未確定にする]'}
                                    </button>
                                </div>
                            </div>


                            {/* [Preparation] Prep Date Section */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    【目安】備え完了目安 <span className="text-[10px] text-slate-300 ml-2">(Blurry)</span>
                                </label>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex-1">
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 block mb-1">
                                            備え完了目安
                                        </span>
                                        <input
                                            type="date"
                                            value={item.prep_date ? new Date(item.prep_date * 1000).toISOString().split('T')[0] : ''}
                                            onChange={async (e) => {
                                                const val = e.target.value;
                                                // Convert to timestamp (seconds)
                                                const dateObj = new Date(val);
                                                const timestamp = !isNaN(dateObj.getTime()) ? Math.floor(dateObj.getTime() / 1000) : null;

                                                if (onUpdate) {
                                                    await onUpdate(item.id, { prep_date: timestamp });
                                                } else {
                                                    await ApiClient.updateItem(item.id, { prep_date: timestamp });
                                                }
                                            }}
                                            className="bg-transparent text-slate-800 dark:text-slate-200 font-mono focus:outline-none focus:border-b border-indigo-500 w-full"
                                        />
                                    </div>
                                    <div className="text-xs text-slate-400 text-right">
                                        <p>約束ではありません</p>
                                        <p>緩やかな目標です</p>
                                    </div>
                                </div>
                            </div>

                            {/* [Work Days] 制作目安日数 */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    【量感】制作目安 (日) <span className="text-[10px] text-slate-300 ml-2">(Volume)</span>
                                </label>
                                <div className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-800">
                                    <div className="flex-1">
                                        <span className="text-sm font-bold text-slate-600 dark:text-slate-300 block mb-1">
                                            制作目安日数
                                        </span>
                                        <input
                                            type="number"
                                            min="1"
                                            max="30"
                                            value={workDays}
                                            onChange={async (e) => {
                                                const val = parseInt(e.target.value, 10);
                                                if (!isNaN(val) && val > 0) {
                                                    setWorkDays(val); // Update local state immediately
                                                    if (onUpdate) {
                                                        await onUpdate(item.id, { work_days: val });
                                                    } else {
                                                        await ApiClient.updateItem(item.id, { work_days: val });
                                                    }
                                                }
                                            }}
                                            className="bg-transparent text-slate-800 dark:text-slate-200 font-mono font-bold focus:outline-none focus:border-b border-indigo-500 w-20 text-center"
                                        />
                                        <span className="text-slate-500 dark:text-slate-400 ml-2">日</span>
                                    </div>
                                    <div className="text-xs text-slate-400 text-right">
                                        <p>カレンダーの量感に反映</p>
                                        <p>予定ではありません</p>
                                    </div>
                                </div>
                            </div>

                            {/* [Intent Boost] Today Only Forward */}
                            <div className="bg-amber-50 dark:bg-amber-900/10 p-4 rounded-lg border border-amber-100 dark:border-amber-800/20 flex items-center justify-between">
                                <div>
                                    <span className="text-sm font-bold text-amber-800 dark:text-amber-200 block">
                                        今日だけ前に出す
                                    </span>
                                    <span className="text-xs text-amber-600 dark:text-amber-400">
                                        判断はせず、視界に入れるだけ
                                    </span>
                                </div>
                                <button
                                    onClick={async () => {
                                        const newBoostState = !item.is_boosted;
                                        if (onUpdate) {
                                            // Optimistic update handled by onUpdate usually
                                            await onUpdate(item.id, { is_boosted: newBoostState, boosted_date: Date.now() });
                                        } else {
                                            await ApiClient.updateItem(item.id, { is_boosted: newBoostState, boosted_date: Date.now() });
                                        }
                                    }}
                                    className={cn(
                                        "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2",
                                        item.is_boosted ? "bg-amber-500" : "bg-slate-200 dark:bg-slate-700"
                                    )}
                                >
                                    <span
                                        className={cn(
                                            "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                                            item.is_boosted ? "translate-x-6" : "translate-x-1"
                                        )}
                                    />
                                </button>
                            </div>

                            {/* Meta Info */}
                            <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 pt-2">
                                <div className="flex items-center gap-1 bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-100 dark:border-slate-700">
                                    <Clock size={12} />
                                    <span>Created: {new Date(item.createdAt).toLocaleDateString()}</span>
                                </div>
                                {item.projectId && (
                                    <div className="flex items-center gap-1 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded border border-blue-100 dark:border-blue-900/30">
                                        <span>Project: {item.projectId}</span>
                                    </div>
                                )}
                            </div>

                            {/* Note Input */}
                            <div>
                                <label className="block text-xs font-bold text-slate-400 mb-1 uppercase tracking-wide">
                                    Memo / Reasoning
                                </label>
                                <textarea
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    onBlur={async () => {
                                        if (onUpdate) {
                                            await onUpdate(item.id, { memo: note });
                                        } else {
                                            await ApiClient.updateItem(item.id, { memo: note });
                                        }
                                    }}
                                    placeholder="条件、理由、その他のメモ..."
                                    className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
                                />
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3">

                            {/* NOT NOW (Menu) */}
                            <div className="relative group/notnow">
                                <button
                                    className="w-full flex flex-col items-center justify-center gap-1 p-3 rounded-lg border border-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-all"
                                >
                                    <Trash2 size={20} className="mb-1" />
                                    <span className="text-xs font-bold">今回見送り...</span>
                                </button>

                                {/* Popup Menu */}
                                <div
                                    className="absolute bottom-full left-0 w-48 bg-white dark:bg-slate-900 shadow-xl rounded-xl border border-slate-200 dark:border-slate-800 p-2 mb-2 hidden group-hover/notnow:block z-50"
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
                                        onClick={() => {
                                            if (confirm('この操作は取り消せません。完全に削除しますか？')) onDelete(item.id);
                                        }}
                                        className="w-full text-left px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded flex items-center gap-2"
                                    >
                                        <Trash2 size={12} />
                                        完全削除
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
                                <span className="text-xs font-bold">今日やる (Yes)</span>
                            </button>

                        </div>
                    </motion.div>
                </div >
            )}
        </AnimatePresence >
    );
};
