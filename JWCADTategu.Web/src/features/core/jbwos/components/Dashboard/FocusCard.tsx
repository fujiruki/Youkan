import React from 'react';
import { Item } from '../../types';
import { Check, ArrowDown, Zap } from 'lucide-react';

interface FocusCardProps {
    item: Item;
    onSetIntent: (id: string, isIntent: boolean) => void;
    onComplete: (id: string) => void;
    onDrop: (id: string) => void;
    onClick: () => void;
}

export const FocusCard: React.FC<FocusCardProps> = ({ item, onSetIntent, onComplete, onDrop, onClick }) => {
    const isIntent = item.isIntent;

    return (
        <div
            className={`
                relative w-full p-6 rounded-2xl shadow-sm border transition-all duration-300
                ${isIntent
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 border-transparent shadow-lg shadow-indigo-200 text-white'
                    : 'bg-white border-slate-200 hover:border-indigo-200'
                }
            `}
            onClick={onClick}
        >
            {/* Header / Context */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex gap-2">
                    {item.dueStatus === 'today' && (
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full tracking-wide ${isIntent ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'}`}>
                            今日
                        </span>
                    )}
                    {item.tenantName && (
                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full tracking-wide ${isIntent ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                            {item.tenantName}
                        </span>
                    )}
                </div>

                {/* Time Estimate */}
                {item.estimatedMinutes && item.estimatedMinutes > 0 ? (
                    <div className={`text-xs font-mono ${isIntent ? 'text-indigo-100' : 'text-slate-400'}`}>
                        {item.estimatedMinutes} min
                    </div>
                ) : null}
            </div>

            {/* Main Title */}
            <h3 className={`text-2xl font-bold leading-tight mb-8 ${isIntent ? 'text-white' : 'text-slate-800'}`}>
                {item.title}
            </h3>

            {/* Actions Bar */}
            <div className="flex items-center gap-4">
                {/* Primary Action: Do Today (Intent) */}
                <button
                    onClick={(e) => { e.stopPropagation(); onSetIntent(item.id, !isIntent); }}
                    className={`
                        flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all
                        ${isIntent
                            ? 'bg-white text-indigo-600 shadow-md hover:bg-slate-50'
                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200'
                        }
                    `}
                >
                    <Zap size={18} className={isIntent ? 'fill-indigo-600' : 'fill-amber-400 text-amber-400'} />
                    {isIntent ? '実行中' : '今日やる!'}
                </button>

                {/* Secondary: Done */}
                <button
                    onClick={(e) => { e.stopPropagation(); onComplete(item.id); }}
                    className={`
                        w-12 h-12 flex items-center justify-center rounded-xl transition-colors
                        ${isIntent
                            ? 'bg-white/20 text-white hover:bg-white/30'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                        }
                    `}
                    title="Complete"
                >
                    <Check size={20} />
                </button>

                {/* Tertiary: Drop */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDrop(item.id); }}
                    className={`
                        w-12 h-12 flex items-center justify-center rounded-xl transition-colors
                        ${isIntent
                            ? 'bg-white/10 text-indigo-100 hover:bg-white/20'
                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200'
                        }
                    `}
                    title="Move to Inbox"
                >
                    <ArrowDown size={20} />
                </button>
            </div>
        </div>
    );
};
