import React from 'react';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';
import { ApiClient } from '../../../../api/client';
import { cn } from '../../../../lib/utils';
import { CheckCircle2, Play, AlertCircle, ArrowDownCircle } from 'lucide-react';
import { LifeChecklist } from './LifeChecklist';

export const TodayScreen: React.FC = () => {
    const {
        todayCandidates,
        todayCommits,
        commitToToday,
        completeItem,
        error,
        clearError
    } = useJBWOSViewModel();

    // ZONE 1: Commit (Today's Vow)
    // Max 2 items.
    // If < 2, we show candidates to allow "Confirm".
    const canCommitMore = todayCommits.length < 2;

    // ZONE 2: Execution (The Reality)
    // Implicit Rule: The TOP item of the Commit list is the Execution Context.
    // (Optimization: In future, backend 'execution_in_progress' status ensures consistency across devices,
    // but for now, we treat the top committed item as the active one).
    const activeItem = todayCommits.length > 0 ? todayCommits[0] : null;

    // --- Phase 3 Execution Logic ---
    const [pausedItems, setPausedItems] = React.useState<Record<string, boolean>>({});

    const handlePause = async (item: any) => {
        // Optimistic UI
        setPausedItems(prev => ({ ...prev, [item.id]: true }));
        try {
            await ApiClient.pauseExecution(item.id.toString());
        } catch (e) {
            console.error("Failed to pause", e);
        }
    };

    const handleResume = async (item: any) => {
        setPausedItems(prev => ({ ...prev, [item.id]: false }));
        try {
            await ApiClient.startExecution(item.id.toString());
        } catch (e) {
            console.error("Failed to resume", e);
        }
    };

    const isPaused = activeItem ? pausedItems[activeItem.id] : false;

    return (
        <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center overflow-y-auto pb-20">

            {/* Header */}
            <div className="w-full max-w-2xl px-6 py-8">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                    <span>Today</span>
                    {todayCommits.length >= 2 && <span className="text-xs font-normal text-slate-400 bg-slate-100 px-2 py-1 rounded">Full Capacity</span>}
                </h1>

                {error && (
                    <div className="mt-4 bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle size={16} />
                        {error}
                        <button onClick={clearError} className="ml-auto font-bold opacity-50 hover:opacity-100">Dismiss</button>
                    </div>
                )}
            </div>

            {/* CANDIDATES AREA (Before Commitment) */}
            {canCommitMore && todayCandidates.length > 0 && (
                <div className="w-full max-w-2xl px-6 mb-8 animate-in fade-in slide-in-from-top-4">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Candidates (From GDB)</span>
                    </div>
                    <div className="space-y-2">
                        {todayCandidates.map(item => (
                            <div key={item.id} className="bg-white/50 dark:bg-slate-900/50 p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 flex items-center justify-between group hover:bg-white hover:border-solid hover:border-amber-400 transition-all">
                                <div>
                                    <h3 className="font-medium text-slate-600 dark:text-slate-300 group-hover:text-slate-900">{item.title}</h3>
                                    <p className="text-xs text-slate-400">RDD: {item.rdd ? new Date(item.rdd * 1000).toLocaleDateString() : 'N/A'}</p>
                                </div>
                                <button
                                    onClick={() => commitToToday(item.id)}
                                    className="bg-amber-100 text-amber-700 px-4 py-2 rounded-full text-sm font-bold hover:bg-amber-500 hover:text-white transition-all transform hover:scale-105 flex items-center gap-2"
                                >
                                    <ArrowDownCircle size={16} />
                                    Confirm
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ZONE 1: Execution (The Reality) - MOVED TO TOP */}
            <div className="w-full max-w-2xl px-6 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Zone 1
                    </span>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">今日の実行 (Execution)</h2>
                </div>

                {activeItem ? (
                    <div className={cn(
                        "p-8 rounded-3xl shadow-xl text-white relative overflow-hidden group transition-all",
                        isPaused
                            ? "bg-slate-700" // Paused style
                            : "bg-gradient-to-br from-blue-600 to-indigo-700" // Running style
                    )}>
                        {!isPaused && (
                            <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
                        )}

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4 opacity-80">
                                {isPaused ? (
                                    <div className="flex items-center gap-2 text-amber-400">
                                        <div className="w-2 h-2 rounded-full bg-amber-400"></div>
                                        <span className="text-sm font-bold uppercase tracking-widest">Paused</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <Play size={20} className="fill-current animate-pulse" />
                                        <span className="text-sm font-bold uppercase tracking-widest">Execution Context</span>
                                    </div>
                                )}
                            </div>

                            <h3 className="text-3xl font-bold mb-8 leading-tight">{activeItem.title}</h3>

                            <div className="flex items-center gap-4">
                                <button
                                    onClick={() => completeItem(activeItem.id)}
                                    className="flex-1 bg-white text-blue-700 px-6 py-4 rounded-xl font-bold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 shadow-lg"
                                >
                                    <CheckCircle2 size={20} />
                                    完了 (Complete)
                                </button>

                                {isPaused ? (
                                    <button
                                        onClick={() => handleResume(activeItem)}
                                        className="px-6 py-4 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-bold transition-colors flex items-center gap-2"
                                    >
                                        <Play size={20} fill="currentColor" />
                                        再開
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handlePause(activeItem)}
                                        className="px-4 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                                    >
                                        中断
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 text-center">
                        現在、実行中の仕事はありません。<br />
                        <span className="text-sm opacity-70">Commitリストの一番上がここに表示されます。</span>
                    </div>
                )}
            </div>

            {/* ZONE 2: Commit List (Remaining Tasks) */}
            <div className="w-full max-w-2xl px-6 mb-10 opacity-90 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Zone 2
                    </span>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">今日の判断 (Commit History)</h2>
                </div>
                <div className="space-y-3">
                    {todayCommits.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-400">
                            候補(Candidates)から選択してください。
                        </div>
                    ) : (
                        todayCommits.map((item, index) => (
                            <div key={item.id} className={cn(
                                "p-4 rounded-xl shadow-sm border flex items-center justify-between transition-all",
                                index === 0
                                    ? "bg-blue-50/50 border-blue-200 ring-1 ring-blue-100 dark:bg-slate-800 dark:border-blue-900 dark:ring-blue-900/30"
                                    : "bg-white border-slate-100 dark:bg-slate-900 dark:border-slate-800"
                            )}>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{item.title}</span>
                                </div>
                                {index === 0 && (
                                    <div className="text-blue-500 text-[10px] font-bold uppercase tracking-wide">
                                        Executing
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Divider */}
            <div className="w-full max-w-2xl px-6 mb-10">
                <div className="h-px bg-slate-200 dark:bg-slate-800 w-full relative">
                    <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-slate-50 dark:bg-slate-950 px-4 text-xs text-slate-400">
                        ここから下は任意（Life）
                    </span>
                </div>
            </div>

            {/* ZONE 3: Life (生活) */}
            <div className="w-full max-w-2xl px-6 opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Optional
                    </span>
                    <div className="flex items-baseline gap-2">
                        <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">Life（任意）</h2>
                        <span className="text-xs text-slate-400">できたらでいいこと</span>
                    </div>
                </div>
                {/* 
                   LifeChecklist normally handles its own rendering.
                   We need to inject the "Promotion" capability into it, 
                   or modify LifeChecklist directly. 
                   For now, we assume LifeChecklist is blackbox, but we need to modify it.
                   Wait, I should check LifeChecklist source if I want to add buttons.
                   Let's leave it as is for layout, and modify LifeChecklist next if needed.
                   Assuming the user asked for "Life Promotion" which likely means modifying LifeChecklist.
                */}
                <LifeChecklist />
            </div>

        </div>
    );
};
