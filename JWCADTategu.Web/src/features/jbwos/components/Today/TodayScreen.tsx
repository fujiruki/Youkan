import React from 'react';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';
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

            {/* ZONE 1: Commit (The Vow) */}
            <div className="w-full max-w-2xl px-6 mb-10">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Zone 1
                    </span>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">今日の判断 (Commit)</h2>
                </div>

                <div className="space-y-3">
                    {todayCommits.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
                            今日はまだ何も約束していません。<br />
                            <span className="text-xs opacity-70">Candidatesから選んでConfirmしてください。</span>
                        </div>
                    ) : (
                        todayCommits.map((item, index) => (
                            <div key={item.id} className={cn(
                                "p-4 rounded-xl shadow-sm border flex items-center justify-between transition-all",
                                index === 0
                                    ? "bg-white border-blue-200 ring-2 ring-blue-100 dark:bg-slate-800 dark:border-blue-900 dark:ring-blue-900/30"
                                    : "bg-slate-50 border-slate-100 opacity-70 dark:bg-slate-900 dark:border-slate-800"
                            )}>
                                <div className="flex items-center gap-3">
                                    <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
                                    <span className="font-medium text-slate-800 dark:text-slate-200">{item.title}</span>
                                </div>
                                {index === 0 && (
                                    <div className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide">
                                        Next / Active
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ZONE 2: Execution (The Reality) */}
            <div className="w-full max-w-2xl px-6 mb-16">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Zone 2
                    </span>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">今日の実行</h2>
                </div>

                {activeItem ? (
                    <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-8 rounded-3xl shadow-xl text-white relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-32 bg-white/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

                        <div className="relative z-10">
                            <div className="flex items-center gap-3 mb-4 opacity-80">
                                <Play size={20} className="fill-current animate-pulse" />
                                <span className="text-sm font-bold uppercase tracking-widest">Execution Context</span>
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
                                {/* [NEW] Pause Logic will be handled here */}
                                <button className="px-4 py-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors">
                                    中断
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="p-8 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 text-center">
                        現在、実行対象はありません。<br />
                        <span className="text-sm">Zone 1 にタスクを追加すると、一番上がここに表示されます。</span>
                    </div>
                )}
            </div>

            {/* Divider */}
            <div className="w-full max-w-2xl px-6 mb-10">
                <div className="h-px bg-slate-200 dark:bg-slate-800 w-full relative">
                    <span className="absolute left-1/2 -translate-x-1/2 -top-3 bg-slate-50 dark:bg-slate-950 px-4 text-xs text-slate-400">
                        ここから下は評価しません
                    </span>
                </div>
            </div>

            {/* ZONE 3: Life (生活) */}
            <div className="w-full max-w-2xl px-6 opacity-80 hover:opacity-100 transition-opacity">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Zone 3
                    </span>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">生活のこと</h2>
                </div>
                <LifeChecklist />
            </div>

        </div>
    );
};
