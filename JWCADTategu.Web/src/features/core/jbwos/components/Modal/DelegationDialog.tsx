import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, UserPlus, Users } from 'lucide-react';
import { Item, Assignee } from '../../types';
import { assigneeManager } from '../../services/AssigneeManager';
import { cn } from '../../../../../lib/utils';

interface DelegationDialogProps {
    item: Item;
    isOpen: boolean;
    onClose: () => void;
    onDelegate: (assignedTo: string, dueDate?: string, note?: string) => Promise<void>;
}

export const DelegationDialog: React.FC<DelegationDialogProps> = ({
    item,
    isOpen,
    onClose,
    onDelegate
}) => {
    const [assignedTo, setAssignedTo] = useState('');
    const [dueDate, setDueDate] = useState('');
    const [note, setNote] = useState(item.memo || '');
    const [assignees, setAssignees] = useState<Assignee[]>([]);
    const [isDelegating, setIsDelegating] = useState(false);
    const [showAddAssignee, setShowAddAssignee] = useState(false);
    const [newAssigneeName, setNewAssigneeName] = useState('');
    const [newAssigneeType, setNewAssigneeType] = useState<'internal' | 'external'>('internal');

    useEffect(() => {
        if (isOpen) {
            setAssignees(assigneeManager.getAllAssignees());
        }
    }, [isOpen]);

    const handleDelegate = async () => {
        if (!assignedTo) return;

        setIsDelegating(true);

        try {
            await onDelegate(assignedTo, dueDate || undefined, note || undefined);

            // リセット
            setAssignedTo('');
            setDueDate('');
            setNote('');
            onClose();
        } catch (e) {
            console.error('Failed to delegate task', e);
        } finally {
            setIsDelegating(false);
        }
    };

    const handleAddAssignee = async () => {
        if (!newAssigneeName.trim()) return;

        try {
            const newAssignee = await assigneeManager.addAssignee({
                name: newAssigneeName,
                type: newAssigneeType
            });

            setAssignees([...assignees, newAssignee]);
            setAssignedTo(newAssignee.id);
            setNewAssigneeName('');
            setShowAddAssignee(false);
        } catch (e) {
            console.error('Failed to add assignee', e);
        }
    };

    if (!isOpen) return null;

    const selectedAssignee = assignees.find(a => a.id === assignedTo);

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Dialog */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                    className="relative z-10 w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-white/20 overflow-hidden"
                >
                    {/* Header */}
                    <div className="p-4 pb-3 flex justify-between items-center border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2">
                            <Users size={20} className="text-blue-500" />
                            <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100">
                                タスクを外注する
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 -mr-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors"
                        >
                            <X size={20} className="text-slate-400" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-5 space-y-4">
                        {/* Task Title */}
                        <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <div className="text-xs font-bold text-slate-500 mb-1">タスク</div>
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                {item.title}
                            </div>
                        </div>

                        {/* Assignee Selection */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                外注先
                            </label>
                            {!showAddAssignee ? (
                                <div className="space-y-2">
                                    <select
                                        value={assignedTo}
                                        onChange={(e) => setAssignedTo(e.target.value)}
                                        className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                    >
                                        <option value="">選択してください</option>
                                        {assignees.map(assignee => (
                                            <option key={assignee.id} value={assignee.id}>
                                                {assignee.name} ({assignee.type === 'internal' ? '社内' : '社外'})
                                            </option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={() => setShowAddAssignee(true)}
                                        className="w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                                    >
                                        <UserPlus size={16} />
                                        新しい外注先を追加
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <input
                                        type="text"
                                        value={newAssigneeName}
                                        onChange={(e) => setNewAssigneeName(e.target.value)}
                                        placeholder="担当者名"
                                        className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                                        autoFocus
                                    />
                                    <div className="flex gap-2">
                                        <label className="flex-1 flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <input
                                                type="radio"
                                                value="internal"
                                                checked={newAssigneeType === 'internal'}
                                                onChange={() => setNewAssigneeType('internal')}
                                            />
                                            <span className="text-sm">社内</span>
                                        </label>
                                        <label className="flex-1 flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50">
                                            <input
                                                type="radio"
                                                value="external"
                                                checked={newAssigneeType === 'external'}
                                                onChange={() => setNewAssigneeType('external')}
                                            />
                                            <span className="text-sm">社外</span>
                                        </label>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => {
                                                setShowAddAssignee(false);
                                                setNewAssigneeName('');
                                            }}
                                            className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                                        >
                                            キャンセル
                                        </button>
                                        <button
                                            onClick={handleAddAssignee}
                                            disabled={!newAssigneeName.trim()}
                                            className={cn(
                                                "flex-1 px-3 py-2 text-sm font-bold rounded-lg transition-all",
                                                newAssigneeName.trim()
                                                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                                            )}
                                        >
                                            追加
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Due Date */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                期限（オプション）
                            </label>
                            <input
                                type="date"
                                value={dueDate}
                                onChange={(e) => setDueDate(e.target.value)}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                        </div>

                        {/* Note */}
                        <div>
                            <label className="block text-xs font-bold text-slate-500 mb-1">
                                メモ（外注先への指示）
                            </label>
                            <textarea
                                value={note}
                                onChange={(e) => setNote(e.target.value)}
                                placeholder="作業内容や注意事項を記入..."
                                rows={3}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
                            />
                        </div>

                        {/* Selected Assignee Info */}
                        {selectedAssignee && (
                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
                                <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">
                                    外注先情報
                                </div>
                                <div className="text-sm text-slate-700 dark:text-slate-200">
                                    <div className="font-medium">{selectedAssignee.name}</div>
                                    <div className="text-xs text-slate-500 dark:text-slate-400">
                                        {selectedAssignee.type === 'internal' ? '社内' : '社外'}
                                        {selectedAssignee.contact && ` • ${selectedAssignee.contact}`}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                        >
                            キャンセル
                        </button>
                        <button
                            onClick={handleDelegate}
                            disabled={!assignedTo || isDelegating}
                            className={cn(
                                "px-6 py-2 text-sm font-bold rounded-lg transition-all",
                                assignedTo && !isDelegating
                                    ? "bg-blue-500 hover:bg-blue-600 text-white shadow-md"
                                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            )}
                        >
                            {isDelegating ? '外注中...' : '外注する'}
                        </button>
                    </div>
                </motion.div>
            </div>
        </AnimatePresence>
    );
};
