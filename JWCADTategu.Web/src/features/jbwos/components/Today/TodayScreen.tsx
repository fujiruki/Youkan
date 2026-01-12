import React from 'react';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';
import { ApiClient } from '../../../../api/client';
import { cn } from '../../../../lib/utils';
import { CheckCircle2, Play, AlertCircle, ArrowDownCircle, PauseCircle, PlayCircle, Clock } from 'lucide-react';
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

            {/* ZONE 1: Execution (The Reality) - TOP PRIORITY */}
            <div className="w-full max-w-2xl px-6 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Execution (Work)
                    </span>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">
                        今日進める責任ある作業
                    </h2>
                </div>

                {activeItem ? (
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl shadow-blue-100/50 dark:shadow-none border-2 border-blue-500 overflow-hidden relative">
                        {/* Active Item Content */}
                        <div className="p-8">
                            <div className="flex items-start justify-between mb-6">
                                <span className="inline-block px-3 py-1 rounded bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">
                                    CURRENT FOCUS
                                </span>
                                {isPaused && (
                                    <span className="flex items-center gap-1 text-amber-500 font-bold animate-pulse">
                                        <PauseCircle size={16} /> PAUSED
                                    </span>
                                )}
                            </div>

                            <h3 className="text-3xl font-bold text-slate-800 dark:text-slate-100 leading-tight mb-4">
                                {activeItem.title}
                            </h3>

                            <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400 text-sm mb-8">
                                <span className="flex items-center gap-1">
                                    <Clock size={16} />
                                    Started: Today
                                </span>
                            </div>

                            {/* Actions */}
                            <div className="flex gap-4">
                                {!isPaused ? (
                                    <button
                                        onClick={() => handlePause(activeItem)}
                                        className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-xl font-bold hover:bg-slate-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <PauseCircle size={20} />
                                        ちょっと中断
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleResume(activeItem)}
                                        className="flex-1 bg-amber-100 text-amber-700 py-4 rounded-xl font-bold hover:bg-amber-200 transition-colors flex items-center justify-center gap-2"
                                    >
                                        <PlayCircle size={20} />
                                        再開する
                                    </button>
                                )}
                                <button
                                    onClick={() => {
                                        if (confirm('完了にしますか？')) completeItem(activeItem.id);
                                    }}
                                    className="flex-1 bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-none transition-all flex items-center justify-center gap-2"
                                >
                                    <CheckCircle2 size={20} />
                                    完了 (Done)
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="bg-slate-100 dark:bg-slate-900 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 p-8 text-center">
                        <p className="text-slate-400 font-medium">現在実行中のタスクはありません</p>
                        <p className="text-xs text-slate-400 mt-2">下の候補から選択して「Confirm」してください</p>
                    </div>
                )}
            </div>

            {/* CANDIDATES AREA (Before Commitment) */}
            {canCommitMore && todayCandidates.length > 0 && (
                <div className="w-full max-w-2xl px-6 mb-12 animate-in fade-in slide-in-from-top-4">
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
