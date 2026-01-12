import React from 'react';
import { useJBWOSViewModel } from '../../viewmodels/useJBWOSViewModel';
import { cn } from '../../../../lib/utils';
import { AlertCircle, CheckCircle2, Play, Pause } from 'lucide-react';
import { LifeChecklist } from './LifeChecklist';

export const TodayScreen: React.FC = () => {
    const vm = useJBWOSViewModel();

    // ZONE 1: Commit (Today's Focus)
    const commits = vm.readyItems.slice(0, 2); // Max 2 enforced by view logic ideally

    // ZONE 2: Execution (Active Context)
    const activeItem = vm.executionItems[0]; // Assuming single active item

    return (
        <div className="h-full w-full bg-slate-50 dark:bg-slate-950 flex flex-col items-center overflow-y-auto pb-20">

            {/* Header */}
            <div className="w-full max-w-2xl px-6 py-8">
                <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100">Today</h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    今日という一日を、無理なく終えるために。
                </p>
            </div>

            {/* ZONE 1: Commit (今日の判断) */}
            <div className="w-full max-w-2xl px-6 mb-10">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Zone 1
                    </span>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">今日の判断 (Commit)</h2>
                </div>

                <div className="space-y-3">
                    {commits.length === 0 ? (
                        <div className="p-8 text-center border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl text-slate-400">
                            今日はまだ何も約束していません。<br />
                            GDBから判断が届くのを待ちましょう。
                        </div>
                    ) : (
                        commits.map(item => (
                            <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                                <span className="font-medium text-slate-800 dark:text-slate-200">{item.title}</span>
                                { /* Actions or Status Icons here */}
                                <div className="bg-amber-50 text-amber-600 px-3 py-1 rounded-full text-xs font-bold">
                                    今日やる
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* ZONE 2: Execution (今日の実行) */}
            <div className="w-full max-w-2xl px-6 mb-16">
                <div className="flex items-center gap-2 mb-4">
                    <span className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider">
                        Zone 2
                    </span>
                    <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200">今日の実行</h2>
                </div>

                {activeItem ? (
                    <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-6 rounded-2xl shadow-lg text-white">
                        <div className="flex items-center gap-3 mb-2 opacity-80">
                            <Play size={20} className="fill-current" />
                            <span className="text-sm font-bold uppercase tracking-widest">Execution Active</span>
                        </div>
                        <h3 className="text-2xl font-bold mb-6">{activeItem.title}</h3>

                        <button className="bg-white text-blue-600 px-6 py-2 rounded-full font-bold hover:bg-blue-50 transition-colors">
                            完了する
                        </button>
                    </div>
                ) : (
                    <div className="p-6 bg-slate-100 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-400 text-center">
                        現在、実行中のコンテキストはありません。
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
            <div className="w-full max-w-2xl px-6 opacity-70 hover:opacity-100 transition-opacity">
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
