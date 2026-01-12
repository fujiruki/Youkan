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
    const dateInputRef = React.useRef<HTMLInputElement>(null);

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
    }, [item.due_status, item.due_date]);

    // Shortcuts
    React.useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
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

            // Ctrl + Enter: Decision "Yes" (Today)
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                onDecision(item.id, 'yes', note);
            }

            // Esc: Close (Keep in Inbox)
            if (e.key === 'Escape') {
                // If date picker is open, it might consume escape? 
                // Usually browser handles date picker escape.
                // We'll let it bubble or check specific conditions if needed.
                e.preventDefault();
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [item.id, dueStatus, note, onDecision, onClose, onUpdate]);

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
                        onClick={onClose}
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
                        <div className="p-6 pb-4 flex justify-between items-start">
                            <div>
                                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 mb-2">
                                    {item.category || 'ITEM'}
                                </span>
                                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 leading-snug">
                                    {item.title}
                                </h2>
                            </div>
                            <button onClick={onClose} className="p-2 -mr-2 -mt-2 hover:bg-slate-100 rounded-full transition-colors">
                                <X size={20} className="text-slate-400" />
                            </button>
                        </div>

                        {/* Content Area - Meta & Note */}
                        <div className="px-6 py-2 space-y-4">

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
                                            const newDateVal = newStatus === 'waiting_external' ? null : (dueDate || null);

                                            setDueStatus(newStatus);

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
                                    placeholder="条件、理由、その他のメモ..."
                                    className="w-full text-sm bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-lg p-3 min-h-[80px] focus:ring-2 focus:ring-amber-400 focus:outline-none resize-none"
                                />
                            </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="mt-6 p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3">

                            {/* NO / DELETE */}
                            <button
                                onClick={() => {
                                    if (confirm('本当に削除しますか？')) onDelete(item.id);
                                }}
                                className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg border border-transparent hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-all group"
                            >
                                <Trash2 size={20} className="text-slate-400 group-hover:text-red-500 mb-1" />
                                <span className="text-xs font-bold text-slate-500 group-hover:text-red-600">削除 (No)</span>
                            </button>

                            {/* HOLD */}
                            <button
                                onClick={() => onDecision(item.id, 'hold', note)}
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
                                onClick={() => onDecision(item.id, 'yes', note)}
                                className="flex flex-col items-center justify-center gap-1 p-3 rounded-lg bg-amber-400 hover:bg-amber-500 text-white shadow-md shadow-amber-200 dark:shadow-none transition-all transform active:scale-95"
                            >
                                <CheckCircle2 size={20} className="mb-1" />
                                <span className="text-xs font-bold">今日やる (Yes)</span>
                            </button>

                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
