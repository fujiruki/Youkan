import React, { useState, useEffect } from 'react';
import { Item } from '../../types';
import { Check, ArrowDown, Zap, Inbox, Clock, Calendar } from 'lucide-react';
import { addMinutes, format } from 'date-fns';

interface FocusCardProps {
    item: Item;
    onSetEngaged: (id: string, isEngaged: boolean) => void;
    onComplete: (id: string) => void;
    onDrop: (id: string) => void; // Move to Inbox
    onSkip: (id: string) => void; // Skip/Demote
    onClick: () => void;
}

export const FocusCard: React.FC<FocusCardProps> = ({ item, onSetEngaged, onComplete, onDrop, onSkip, onClick }) => {
    const isEngaged = item.isEngaged;
    const [currentTime, setCurrentTime] = useState(new Date());

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 60000); // Update every minute
        return () => clearInterval(timer);
    }, []);

    // Prediction Calculations
    const estimatedMins = item.estimatedMinutes || 0;
    // ... (middle parts unchanged, handled by context) ...
    // Around line 121
    const workDays = item.work_days || 1;
    const predictedFinish = estimatedMins > 0 ? addMinutes(currentTime, estimatedMins) : null;

    return (
        <div
            className={`
                relative w-full p-6 rounded-2xl shadow-sm border transition-all duration-300 group
                ${isEngaged
                    ? 'bg-gradient-to-br from-indigo-500 to-violet-600 border-transparent shadow-lg shadow-indigo-200 text-white'
                    : 'bg-white border-slate-200 hover:border-indigo-200'
                }
            `}
            onClick={onClick}
        >
            {/* Header / Context & Stats */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex flex-col gap-1.5 flex-1 min-w-0 pr-4">
                    {/* Breadcrumbs: Tenant > Project */}
                    <div className={`flex items-center gap-2 text-xs font-medium uppercase tracking-wider ${isEngaged ? 'text-indigo-200' : 'text-slate-400'}`}>
                        <span className="flex items-center gap-1">
                            {item.tenantName || 'Private'}
                            {item.projectTitle && (
                                <>
                                    <span className="opacity-50">/</span>
                                    <span className={isEngaged ? 'text-white' : 'text-indigo-600'}>{item.projectTitle}</span>
                                </>
                            )}
                        </span>
                    </div>

                    <div className="flex gap-2">
                        {item.dueStatus === 'today' && (
                            <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full tracking-wide ${isEngaged ? 'bg-white/20 text-white' : 'bg-rose-100 text-rose-600'}`}>
                                今日
                            </span>
                        )}
                    </div>
                </div>

                {/* Estimate & Forecast Information */}
                <div className={`flex flex-col items-end text-right ${isEngaged ? 'text-indigo-100' : 'text-slate-500'}`}>
                    <div className="flex items-center gap-3 mb-1">
                        {/* Work Days */}
                        {workDays > 0 && (
                            <div className="flex items-center gap-1" title="目安日数">
                                <Calendar size={12} className="opacity-70" />
                                <span className="text-xs font-mono font-bold">{workDays}日</span>
                            </div>
                        )}
                        {/* Estimated Time */}
                        {estimatedMins > 0 && (
                            <div className="flex items-center gap-1" title="見積もり時間">
                                <Clock size={12} className="opacity-70" />
                                <span className="text-xs font-mono font-bold">{estimatedMins}min</span>
                            </div>
                        )}
                    </div>
                    {/* Forecast */}
                    {predictedFinish && (
                        <div className={`text-[10px] font-mono flex items-center gap-1 ${isEngaged ? 'text-indigo-200' : 'text-slate-400'}`}>
                            <span>予想完了: {format(predictedFinish, 'HH:mm')}</span>
                            <span className="opacity-70">(あと{estimatedMins}分)</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Title */}
            <h3 className={`text-2xl font-bold leading-tight mb-8 ${isEngaged ? 'text-white' : 'text-slate-800'}`}>
                {item.title}
            </h3>

            {/* Actions Bar */}
            <div className="flex items-center gap-3">
                {/* Primary Action: Do Today (Intent) */}
                <button
                    onClick={(e) => { e.stopPropagation(); onSetEngaged(item.id, !isEngaged); }}
                    className={`
                        flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-bold transition-all
                        ${isEngaged
                            ? 'bg-white text-indigo-600 shadow-md hover:bg-slate-50'
                            : 'bg-slate-900 text-white hover:bg-slate-800 shadow-lg shadow-slate-200'
                        }
                    `}
                >
                    <Zap size={18} className={isEngaged ? 'fill-indigo-600' : 'fill-amber-400 text-amber-400'} />
                    {isEngaged ? '実行中' : '今日やる!'}
                </button>

                {/* Secondary: Done */}
                <button
                    onClick={(e) => { e.stopPropagation(); onComplete(item.id); }}
                    className={`
                        w-12 h-12 flex items-center justify-center rounded-xl transition-colors
                        ${isEngaged
                            ? 'bg-white/20 text-white hover:bg-white/30'
                            : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200'
                        }
                    `}
                    title="完了 (Complete)"
                >
                    <Check size={20} />
                </button>

                {/* Tertiary: Skip (Demote to Queue) */}
                {/* Tertiary: Skip (Demote to Queue) */}
                <button
                    onClick={(e) => { e.stopPropagation(); onSkip(item.id); }}
                    className={`
                        w-12 h-12 flex items-center justify-center rounded-xl transition-colors
                        ${isEngaged
                            ? 'bg-white/10 text-indigo-100 hover:bg-white/20'
                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200'
                        }
                    `}
                    title="次に回す (Skip)"
                >
                    <ArrowDown size={20} />
                </button>

                {/* Quaternary: Return to Inbox */}
                <button
                    onClick={(e) => { e.stopPropagation(); onDrop(item.id); }}
                    className={`
                        w-12 h-12 flex items-center justify-center rounded-xl transition-colors
                        ${isEngaged
                            ? 'bg-white/10 text-indigo-100 hover:bg-white/20'
                            : 'bg-slate-50 text-slate-400 hover:bg-slate-100 border border-slate-200'
                        }
                    `}
                    title="Inboxに戻す"
                >
                    <Inbox size={20} />
                </button>
            </div>
        </div>
    );
};
