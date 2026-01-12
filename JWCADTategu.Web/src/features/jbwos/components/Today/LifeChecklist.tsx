import React, { useState, useEffect } from 'react';
import { Check, Heart } from 'lucide-react';
import { ApiClient } from '../../../../api/client';
import { cn } from '../../../../lib/utils';

// Static Life Items for MVP
const LIFE_ITEMS = [
    { id: 'clean', label: '掃除・換気' },
    { id: 'laundry', label: '洗濯・衣類整理' },
    { id: 'dishes', label: '食器洗い・片付け' },
    { id: 'rest', label: '十分な休憩' },
];

export const LifeChecklist: React.FC = () => {
    const todayStr = new Date().toISOString().split('T')[0]; // simple YYYY-MM-DD
    const storageKey = `jbwos_life_log_${todayStr}`;

    const [checkedItems, setCheckedItems] = useState<Record<string, boolean>>({});

    // Load from local storage
    useEffect(() => {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
            try {
                setCheckedItems(JSON.parse(saved));
            } catch (e) {
                console.error("Failed to parse life log", e);
            }
        }
    }, [storageKey]);

    // Save on change
    const toggleItem = async (id: string) => {
        const createNewState = (prev: Record<string, boolean>) => {
            const next = { ...prev, [id]: !prev[id] };
            localStorage.setItem(storageKey, JSON.stringify(next));
            return next;
        };

        // Optimistic update
        setCheckedItems(createNewState);

        // API Call (Fact Persistence)
        // Only log when checked (completed)
        if (!checkedItems[id]) {
            try {
                // await fetch(`/api/life/${id}/check`, { method: 'POST' });
                await ApiClient.checkLife(id);
            } catch (e) {
                console.error("Failed to log life event", e);
            }
        }
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-6">
            <div className="flex items-center gap-3 mb-4 text-slate-500 dark:text-slate-400">
                <Heart size={18} className="text-pink-400" />
                <span className="text-sm font-medium">できたこと（できなくてもOK）</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {LIFE_ITEMS.map(item => {
                    const isChecked = !!checkedItems[item.id];
                    return (
                        <div key={item.id} className="relative group">
                            <button
                                onClick={() => toggleItem(item.id)}
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
                                    "font-medium",
                                    isChecked && "line-through opacity-70"
                                )}>
                                    {item.label}
                                </span>
                            </button>

                            {/* Promote Button (Appears on hover) */}
                            <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    if (confirm(`「${item.label}」を判断（仕事）に昇格させますか？\n（Inboxに追加されます）`)) {
                                        await ApiClient.createItem({ title: item.label, status: 'inbox' });
                                        alert('Inboxに追加しました。');
                                    }
                                }}
                                title="判断（仕事）に昇格"
                                className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1.5 bg-white dark:bg-slate-700 rounded-md shadow-sm border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-indigo-500 transition-all"
                            >
                                <span className="text-[10px] font-bold">昇格</span>
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
