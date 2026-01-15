import React, { useState, useEffect, useRef } from 'react';
import { Item } from '../../types';
import { ApiClient } from '../../../../api/client';
import { ArrowDownCircle, X, Calendar, Edit2 } from 'lucide-react';
import { EstimatedTimeInput } from '../Today/EstimatedTimeInput'; // [NEW]

interface Props {
    item: Item;
    onClose: () => void;
    onConfirm: (id: string) => void;
    onUpdate?: (id: string, updates: Partial<Item>) => Promise<void>;
}

export const TodayCandidateDetailModal: React.FC<Props> = ({ item, onClose, onConfirm, onUpdate }) => {
    // --- Local State for Immediate Editing ---
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [editedTitle, setEditedTitle] = useState(item.title);
    const [memo, setMemo] = useState(item.memo || '');
    const [estimatedMinutes, setEstimatedMinutes] = useState(item.estimatedMinutes || 0); // [NEW]
    const [isDirty, setIsDirty] = useState(false);

    const titleInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isEditingTitle && titleInputRef.current) {
            titleInputRef.current.focus();
        }
    }, [isEditingTitle]);

    // [NEW] Sync props unless dirty
    useEffect(() => {
        if (!isDirty) {
            setEstimatedMinutes(item.estimatedMinutes || 0);
        }
        setMemo(item.memo || '');
        setEditedTitle(item.title);
    }, [item.estimatedMinutes, item.memo, item.title, isDirty]);

    const handleSaveUpdate = async (updates: Partial<Item>) => {
        if ('estimatedMinutes' in updates) {
            setIsDirty(true);
        }

        if (onUpdate) {
            await onUpdate(item.id, updates);
        } else {
            await ApiClient.updateItem(item.id, updates);
        }
    };

    const formatDate = (dateStr?: string | null) => {
        if (!dateStr) return '未設定';
        const date = new Date(dateStr);
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'short'
        });
    };

    // [NEW] Save estimatedMinutes and close
    const handleClose = async () => {
        if (isDirty || estimatedMinutes !== (item.estimatedMinutes || 0)) {
            await handleSaveUpdate({ estimatedMinutes });
        }
        onClose();
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Backdrop click to close */}
            <div className="absolute inset-0" onClick={handleClose} />

            <div className="relative z-10 w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-xl border border-white/20 overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">

                {/* Header */}
                <div className="p-4 pb-3 flex justify-between items-start bg-slate-50/50 dark:bg-slate-800/50">
                    <div className="flex-1">
                        <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 mb-1">
                            {item.category || 'CANDIDATE'}
                        </span>

                        {isEditingTitle ? (
                            <input
                                ref={titleInputRef}
                                type="text"
                                value={editedTitle}
                                onChange={(e) => setEditedTitle(e.target.value)}
                                onBlur={() => {
                                    setIsEditingTitle(false);
                                    if (editedTitle !== item.title) {
                                        handleSaveUpdate({ title: editedTitle });
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.currentTarget.blur();
                                }}
                                className="w-full text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug bg-transparent border-b-2 border-indigo-500 focus:outline-none"
                            />
                        ) : (
                            <h2
                                className="text-lg font-bold text-slate-800 dark:text-slate-100 leading-snug cursor-pointer hover:text-indigo-600 transition-colors flex items-center gap-2"
                                onClick={() => setIsEditingTitle(true)}
                                title="クリックして編集"
                            >
                                {editedTitle}
                                <Edit2 size={14} className="text-slate-300" />
                            </h2>
                        )}
                    </div>

                    <button onClick={handleClose} className="p-2 -mr-2 -mt-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                        <X size={20} className="text-slate-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-4 space-y-4">

                    {/* Info Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Due Date */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <label className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1 mb-1">
                                <Calendar size={12} /> 取付日 (納期)
                            </label>
                            <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                                {formatDate(item.due_date)}
                            </div>
                        </div>

                        {/* Estimated Time (New Component) */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                            <EstimatedTimeInput
                                value={estimatedMinutes}
                                onChange={(val) => {
                                    setEstimatedMinutes(val);
                                    handleSaveUpdate({ estimatedMinutes: val });
                                }}
                            />
                        </div>
                    </div>

                    {/* Memo */}
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400 mb-1 block">
                            MEMO / 備考
                        </label>
                        <textarea
                            value={memo}
                            onChange={(e) => setMemo(e.target.value)}
                            onBlur={() => {
                                if (memo !== item.memo) {
                                    handleSaveUpdate({ memo });
                                }
                            }}
                            placeholder="補足事項があれば..."
                            className="w-full h-24 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 rounded-lg text-sm text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-amber-400/50 resize-none"
                        />
                    </div>

                    {/* Action Button */}
                    <div className="pt-2">
                        <button
                            onClick={() => {
                                // Save any pending changes first just in case
                                handleSaveUpdate({ title: editedTitle, memo, estimatedMinutes });
                                onConfirm(item.id);
                                onClose();
                            }}
                            className="w-full py-3 bg-amber-400 hover:bg-amber-500 text-white font-bold rounded-xl shadow-lg shadow-amber-200/50 dark:shadow-none transition-all transform hover:scale-[1.02] flex items-center justify-center gap-2"
                        >
                            <ArrowDownCircle size={20} />
                            今日やることを確定
                        </button>
                    </div>
                </div>

            </div>
        </div>
    );
};
