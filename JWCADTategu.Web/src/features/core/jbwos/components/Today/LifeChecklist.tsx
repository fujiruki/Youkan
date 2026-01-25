import React from 'react';
import { Check, Heart, X } from 'lucide-react';
import { cn } from '../../../../../lib/utils';
import { useLifeLog } from '../../hooks/useLifeLog';

export const LifeChecklist: React.FC = () => {
    // Use Hook
    const { items, checkedItems, toggleCheck } = useLifeLog();

    const allItems = items;

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3 text-slate-500 dark:text-slate-400">
                    <Heart size={18} className="text-pink-400" />
                    <span className="text-sm font-medium">できたこと（できなくてもOK）</span>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                {allItems.map(item => {
                    const isChecked = !!checkedItems[item.id];
                    return (
                        <div key={item.id} className="relative group">
                            <button
                                onClick={() => toggleCheck(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left",
                                    isChecked
                                        ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300"
                                        : "bg-slate-50 border-transparent text-slate-600 hover:bg-slate-100 dark:bg-slate-900/50 dark:text-slate-400 dark:hover:bg-slate-800"
                                )}
                            >
                                <div className={cn(
                                    "w-5 h-5 rounded flex items-center justify-center border transition-colors shrink-0",
                                    isChecked
                                        ? "bg-green-500 border-green-500 text-white"
                                        : "border-slate-300 dark:border-slate-600"
                                )}>
                                    {isChecked && <Check size={14} strokeWidth={3} />}
                                </div>
                                <span className={cn(
                                    "font-medium truncate",
                                    isChecked && "line-through opacity-70"
                                )}>
                                    {item.label}
                                </span>
                            </button>

                            {/* Custom Item Actions (Disabled for Cloud MVP Phase 1) */}
                            {item.isCustom && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        // deleteCustomItem(item.id);
                                    }}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded text-slate-400 hover:text-red-500 transition-all"
                                    title="削除"
                                >
                                    <X size={14} />
                                </button>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="text-xs text-slate-400 text-center mt-2">
                ※クラウド移行中: カスタム項目の追加は一時的に制限されています
            </div>
        </div>
    );
};
